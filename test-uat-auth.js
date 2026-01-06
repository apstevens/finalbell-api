/**
 * Quick Test Script for UAT Authentication
 *
 * This script tests that UAT authentication is working correctly
 *
 * Usage:
 * 1. Start your server with UAT_ENABLED=true
 * 2. Run: node test-uat-auth.js
 */

const http = require('http');

const PORT = process.env.PORT || 8080;
const HOST = 'localhost';

// Test 1: Request without auth should return 401
console.log('\n=== Test 1: Request without authentication ===');
const testNoAuth = http.get(`http://${HOST}:${PORT}/`, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Expected: 401`);
  console.log(`Result: ${res.statusCode === 401 ? '✓ PASS' : '✗ FAIL'}`);

  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response:', data);

    // Test 2: Request with valid auth
    runTest2();
  });
});

testNoAuth.on('error', (err) => {
  console.error('Error:', err.message);
  console.log('\nMake sure your server is running with UAT_ENABLED=true');
  console.log('Run: npm run dev');
});

function runTest2() {
  console.log('\n=== Test 2: Request with authentication ===');

  const username = process.env.UAT_USERNAME || 'uat_user';
  const password = process.env.UAT_PASSWORD || 'testpassword123';
  const auth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  const options = {
    hostname: HOST,
    port: PORT,
    path: '/',
    headers: {
      'Authorization': auth
    }
  };

  const testWithAuth = http.get(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Expected: 200`);
    console.log(`Result: ${res.statusCode === 200 ? '✓ PASS' : '✗ FAIL'}`);

    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Response:', data);

      // Test 3: Health check (should work without auth)
      runTest3();
    });
  });

  testWithAuth.on('error', (err) => {
    console.error('Error:', err.message);
  });
}

function runTest3() {
  console.log('\n=== Test 3: Health check without auth (should always work) ===');

  const testHealth = http.get(`http://${HOST}:${PORT}/health`, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Expected: 200`);
    console.log(`Result: ${res.statusCode === 200 ? '✓ PASS' : '✗ FAIL'}`);

    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Response:', data);
      console.log('\n=== All Tests Complete ===\n');
    });
  });

  testHealth.on('error', (err) => {
    console.error('Error:', err.message);
  });
}
