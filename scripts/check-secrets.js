#!/usr/bin/env node
/**
 * Pre-commit hook to check for secrets in staged files
 * Install: npm install --save-dev
 *
 * This script prevents accidentally committing:
 * - .env files (except .env.example)
 * - Files containing potential secrets
 * - Hardcoded credentials
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Patterns that indicate potential secrets
const SECRET_PATTERNS = [
  /(?:password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]{8,}["']?/i,
  /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[^"'\s]{16,}["']?/i,
  /(?:secret|token)\s*[:=]\s*["']?[^"'\s]{16,}["']?/i,
  /(?:private[_-]?key)\s*[:=]/i,
  /-----BEGIN (?:RSA |DSA )?PRIVATE KEY-----/,
  /(?:access[_-]?token)\s*[:=]\s*["']?[^"'\s]{16,}["']?/i,
  /(?:auth[_-]?token)\s*[:=]\s*["']?[^"'\s]{16,}["']?/i,
  /sk_live_[a-zA-Z0-9]{24,}/,  // Stripe live secret key
  /pk_live_[a-zA-Z0-9]{24,}/,  // Stripe live publishable key
  /whsec_[a-zA-Z0-9]{32,}/,    // Stripe webhook secret
];

// Files that should never be committed
const FORBIDDEN_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test',
];

// Files that are allowed (exceptions)
const ALLOWED_FILES = [
  '.env.example',
];

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
}

function checkFileForSecrets(filePath) {
  const issues = [];

  // Check if file is forbidden
  const fileName = path.basename(filePath);
  if (FORBIDDEN_FILES.includes(fileName) && !ALLOWED_FILES.includes(fileName)) {
    issues.push({
      type: 'FORBIDDEN_FILE',
      message: `File "${fileName}" should never be committed`,
      severity: 'ERROR'
    });
    return issues;
  }

  // Skip binary files and large files
  try {
    const stats = fs.statSync(filePath);
    if (stats.size > 1000000) return issues; // Skip files > 1MB
  } catch (error) {
    return issues;
  }

  // Read file content
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return issues;
  }

  // Check for secret patterns
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    SECRET_PATTERNS.forEach(pattern => {
      if (pattern.test(line)) {
        // Skip comments and example values
        if (line.trim().startsWith('#')) return;
        if (line.includes('example') || line.includes('EXAMPLE')) return;
        if (line.includes('your-') || line.includes('YOUR-')) return;
        if (line.includes('GENERATE_NEW_SECRET')) return;
        if (line.includes('change-this')) return;

        issues.push({
          type: 'POTENTIAL_SECRET',
          message: `Potential secret found in ${filePath}:${index + 1}`,
          line: index + 1,
          content: line.trim(),
          severity: 'WARNING'
        });
      }
    });
  });

  return issues;
}

function main() {
  console.log('\n🔍 Checking for secrets in staged files...\n');

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(`${GREEN}✓ No files staged${RESET}\n`);
    return 0;
  }

  let hasErrors = false;
  let hasWarnings = false;
  const allIssues = [];

  stagedFiles.forEach(file => {
    const issues = checkFileForSecrets(file);
    if (issues.length > 0) {
      allIssues.push({ file, issues });

      issues.forEach(issue => {
        if (issue.severity === 'ERROR') hasErrors = true;
        if (issue.severity === 'WARNING') hasWarnings = true;
      });
    }
  });

  if (allIssues.length === 0) {
    console.log(`${GREEN}✓ No secrets detected in staged files${RESET}\n`);
    return 0;
  }

  // Display issues
  allIssues.forEach(({ file, issues }) => {
    console.log(`${YELLOW}File: ${file}${RESET}`);
    issues.forEach(issue => {
      const color = issue.severity === 'ERROR' ? RED : YELLOW;
      console.log(`  ${color}${issue.severity}: ${issue.message}${RESET}`);
      if (issue.line) {
        console.log(`  ${color}Line ${issue.line}: ${issue.content}${RESET}`);
      }
    });
    console.log('');
  });

  if (hasErrors) {
    console.log(`${RED}❌ COMMIT BLOCKED: Secrets detected!${RESET}\n`);
    console.log('Please remove secrets before committing:\n');
    console.log('1. Remove .env files from staging:');
    console.log('   git reset HEAD .env .env.production\n');
    console.log('2. Remove hardcoded secrets from code\n');
    console.log('3. Use environment variables instead\n');
    return 1;
  }

  if (hasWarnings) {
    console.log(`${YELLOW}⚠️  WARNING: Potential secrets detected${RESET}\n`);
    console.log('Please verify these are not real secrets.\n');
    console.log('To bypass this check (use with caution):');
    console.log('  git commit --no-verify\n');

    // Allow commit but warn
    return 0;
  }

  return 0;
}

process.exit(main());
