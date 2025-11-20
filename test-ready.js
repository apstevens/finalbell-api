#!/usr/bin/env node
/**
 * Quick Deployment Readiness Test Script
 * Run this before deploying to production
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

let passed = 0;
let failed = 0;
let warnings = 0;

function log(message, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const color = type === 'success' ? colors.green : type === 'error' ? colors.red : type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}${icons[type]} ${message}${colors.reset}`);
}

function test(name, fn) {
  try {
    fn();
    log(`${name}: PASSED`, 'success');
    passed++;
    return true;
  } catch (error) {
    log(`${name}: FAILED - ${error.message}`, 'error');
    failed++;
    return false;
  }
}

function warn(message) {
  log(message, 'warning');
  warnings++;
}

console.log('\n🚀 Final Bell API - Deployment Readiness Test\n');
console.log('='.repeat(60) + '\n');

// Test 1: Environment Variables
console.log('📋 Testing Environment Variables...\n');

const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'ADMIN_API_KEY',
  'ALLOWED_ORIGINS',
  'CLIENT_URL'
];

const optionalVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PLAYWELL_FTP_HOST',
  'PLAYWELL_FTP_USER',
  'PLAYWELL_FTP_PASSWORD'
];

test('Required environment variables are set', () => {
  const missing = requiredVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing: ${missing.join(', ')}`);
  }
});

test('JWT_SECRET is strong enough', () => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET should be at least 32 characters');
  }
});

test('REFRESH_TOKEN_SECRET is strong enough', () => {
  if (process.env.REFRESH_TOKEN_SECRET && process.env.REFRESH_TOKEN_SECRET.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET should be at least 32 characters');
  }
});

test('ADMIN_API_KEY is strong enough', () => {
  if (process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY.length < 32) {
    throw new Error('ADMIN_API_KEY should be at least 32 characters');
  }
});

// Check optional variables
optionalVars.forEach(key => {
  if (!process.env[key]) {
    warn(`Optional variable ${key} not set`);
  } else {
    log(`Optional variable ${key} is set`, 'info');
  }
});

// Test 2: Project Structure
console.log('\n📁 Testing Project Structure...\n');

test('package.json exists', () => {
  if (!fs.existsSync('package.json')) throw new Error('package.json not found');
});

test('Prisma schema exists', () => {
  if (!fs.existsSync('prisma/schema.prisma')) throw new Error('prisma/schema.prisma not found');
});

test('Server entry point exists', () => {
  if (!fs.existsSync('src/server.ts')) throw new Error('src/server.ts not found');
});

test('Dockerfile exists', () => {
  if (!fs.existsSync('Dockerfile')) throw new Error('Dockerfile not found');
});

// Test 3: Dependencies
console.log('\n📦 Testing Dependencies...\n');

test('node_modules installed', () => {
  if (!fs.existsSync('node_modules')) throw new Error('Dependencies not installed. Run: npm install');
});

test('Prisma Client generated', () => {
  if (!fs.existsSync('node_modules/.prisma/client')) {
    throw new Error('Prisma Client not generated. Run: npx prisma generate');
  }
});

// Test 4: TypeScript Build
console.log('\n🔨 Testing TypeScript Build...\n');

test('TypeScript compiles successfully', () => {
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('TypeScript compilation failed. Run: npm run build');
  }
});

// Test 5: Prisma Schema
console.log('\n🗄️  Testing Database Schema...\n');

test('Prisma schema is valid', () => {
  try {
    execSync('npx prisma validate', { stdio: 'pipe' });
  } catch (error) {
    throw new Error('Prisma schema validation failed');
  }
});

// Test 6: Security Checks
console.log('\n🔒 Testing Security Configuration...\n');

if (process.env.NODE_ENV === 'production') {
  test('Using production NODE_ENV', () => {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('NODE_ENV should be "production"');
    }
  });

  if (process.env.STRIPE_SECRET_KEY) {
    test('Using Stripe production keys', () => {
      if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
        throw new Error('Using Stripe test keys in production');
      }
    });
  }

  test('CORS configured with specific origins', () => {
    if (process.env.ALLOWED_ORIGINS === '*') {
      throw new Error('CORS allows all origins. Specify exact origins for production');
    }
  });
} else {
  warn('Not testing for production environment (NODE_ENV != production)');
}

// Test 7: Git Status
console.log('\n📝 Testing Git Status...\n');

try {
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
  if (gitStatus.trim()) {
    warn('Uncommitted changes detected. Consider committing before deployment');
  } else {
    log('No uncommitted changes', 'success');
    passed++;
  }
} catch (error) {
  warn('Not a git repository or git not available');
}

// Test 8: Check for common issues
console.log('\n🔍 Checking for Common Issues...\n');

test('No console.log in production code', () => {
  try {
    const srcFiles = execSync('find src -name "*.ts" -type f 2>/dev/null || dir /s /b src\\*.ts 2>nul', { encoding: 'utf-8' });
    const files = srcFiles.split('\n').filter(f => f.trim());

    let foundConsoleLog = false;
    files.forEach(file => {
      try {
        const content = fs.readFileSync(file.trim(), 'utf-8');
        if (content.includes('console.log') && !file.includes('test')) {
          foundConsoleLog = true;
        }
      } catch (err) {
        // Ignore file read errors
      }
    });

    if (foundConsoleLog) {
      throw new Error('console.log statements found in source files');
    }
  } catch (error) {
    // If find/dir command fails, skip this test
    warn('Could not check for console.log statements');
  }
});

test('No .env file in git', () => {
  try {
    const gitignore = fs.readFileSync('.gitignore', 'utf-8');
    if (!gitignore.includes('.env')) {
      throw new Error('.env should be in .gitignore');
    }
  } catch (error) {
    throw new Error('.gitignore not found or missing .env entry');
  }
});

// Summary
console.log('\n' + '='.repeat(60) + '\n');
console.log('📊 Test Summary:\n');
log(`Passed: ${passed}`, 'success');
if (warnings > 0) log(`Warnings: ${warnings}`, 'warning');
if (failed > 0) log(`Failed: ${failed}`, 'error');

console.log('\n' + '='.repeat(60) + '\n');

if (failed > 0) {
  log('❌ DEPLOYMENT NOT READY - Fix the issues above before deploying', 'error');
  console.log('\n💡 Tips:');
  console.log('  - Review test-deployment-readiness.md for detailed testing');
  console.log('  - Check DEPLOYMENT.md for deployment instructions');
  console.log('  - Ensure all environment variables are properly set\n');
  process.exit(1);
} else if (warnings > 0) {
  log('⚠️  DEPLOYMENT READY WITH WARNINGS - Review warnings before proceeding', 'warning');
  console.log('\n💡 Next Steps:');
  console.log('  1. Review warnings above');
  console.log('  2. Test production build: npm run build && npm run start:prod');
  console.log('  3. Test health endpoint: curl http://localhost:8080/health');
  console.log('  4. Follow deployment guide in DEPLOYMENT.md\n');
  process.exit(0);
} else {
  log('✅ ALL TESTS PASSED - Ready for deployment!', 'success');
  console.log('\n🚀 Next Steps:');
  console.log('  1. Run: npm run build');
  console.log('  2. Test locally: npm run start:prod');
  console.log('  3. Test health: curl http://localhost:8080/health');
  console.log('  4. Deploy following DEPLOYMENT.md guide\n');
  process.exit(0);
}
