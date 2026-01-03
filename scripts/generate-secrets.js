#!/usr/bin/env node
/**
 * Generate secure secrets for Railway environment variables
 * Run: node scripts/generate-secrets.js
 */

const crypto = require('crypto');

console.log('\n🔐 Generating Secure Secrets for Railway\n');
console.log('=' .repeat(60));

// Generate JWT Secret (64 bytes)
const jwtSecret = crypto.randomBytes(64).toString('base64');
console.log('\n📝 JWT_SECRET:');
console.log(jwtSecret);

// Generate Refresh Token Secret (64 bytes)
const refreshTokenSecret = crypto.randomBytes(64).toString('base64');
console.log('\n📝 REFRESH_TOKEN_SECRET:');
console.log(refreshTokenSecret);

// Generate Admin API Key (32 bytes)
const adminApiKey = crypto.randomBytes(32).toString('base64');
console.log('\n📝 ADMIN_API_KEY:');
console.log(adminApiKey);

console.log('\n' + '='.repeat(60));
console.log('\n✅ Secrets Generated Successfully!\n');
console.log('📋 Next Steps:');
console.log('1. Copy each secret above');
console.log('2. Go to Railway Dashboard → Your Project → Variables');
console.log('3. Add/Update these environment variables');
console.log('4. DO NOT commit these secrets to git!\n');
console.log('⚠️  IMPORTANT: These are production secrets.');
console.log('   Never share them or commit them to version control.\n');
