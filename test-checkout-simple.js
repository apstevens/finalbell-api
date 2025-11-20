#!/usr/bin/env node
/**
 * Simple Checkout Testing Script
 * Tests checkout functionality without shipping (current implementation)
 * Run: node test-checkout-simple.js
 */

const http = require('http');

const API_URL = 'http://localhost:8080';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test cases
async function runTests() {
  console.log('\n🧪 Final Bell API - Checkout Test\n');
  console.log('='.repeat(50) + '\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Health Check
  console.log('📋 Test 1: Health Check');
  try {
    const { status, data } = await makeRequest('GET', '/health');
    if (status === 200 && data.status === 'ok') {
      console.log('✅ PASSED - Server is healthy\n');
      passed++;
    } else {
      console.log('❌ FAILED - Unexpected response\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED - ${error.message}`);
    console.log('   Make sure server is running: npm run dev\n');
    failed++;
    process.exit(1);
  }

  // Test 2: Create Checkout Session
  console.log('📋 Test 2: Create Checkout Session');
  try {
    const { status, data } = await makeRequest('POST', '/api/v1/stripe/create-checkout-session', {
      items: [
        {
          id: 1,
          name: 'Boxing Gloves',
          price: 49.99,
          quantity: 1,
          image: 'https://via.placeholder.com/150',
        },
      ],
    });

    if (status === 200 && data.sessionId) {
      console.log('✅ PASSED - Checkout session created');
      console.log(`   Session ID: ${data.sessionId}`);
      console.log(`   🌐 Open: https://checkout.stripe.com/pay/${data.sessionId}\n`);
      passed++;

      // Test 3: Retrieve Session
      console.log('📋 Test 3: Retrieve Session Details');
      try {
        const { status: status2, data: data2 } = await makeRequest(
          'GET',
          `/api/v1/stripe/session/${data.sessionId}`
        );

        if (status2 === 200 && data2.id) {
          console.log('✅ PASSED - Session retrieved');
          console.log(`   Status: ${data2.status}`);
          console.log(`   Payment Status: ${data2.payment_status}`);
          console.log(`   Amount: £${(data2.amount_total / 100).toFixed(2)}\n`);
          passed++;
        } else {
          console.log('❌ FAILED - Could not retrieve session\n');
          failed++;
        }
      } catch (error) {
        console.log(`❌ FAILED - ${error.message}\n`);
        failed++;
      }
    } else {
      console.log('❌ FAILED - Invalid response\n');
      console.log(data);
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED - ${error.message}\n`);
    failed++;
  }

  // Test 4: Multiple Items
  console.log('📋 Test 4: Multiple Items in Cart');
  try {
    const { status, data } = await makeRequest('POST', '/api/v1/stripe/create-checkout-session', {
      items: [
        {
          id: 1,
          name: 'Boxing Gloves',
          price: 49.99,
          quantity: 1,
          image: 'https://via.placeholder.com/150',
        },
        {
          id: 2,
          name: 'Hand Wraps',
          price: 12.99,
          quantity: 2,
          image: 'https://via.placeholder.com/150',
        },
      ],
    });

    if (status === 200 && data.sessionId) {
      console.log('✅ PASSED - Multiple items checkout created');
      console.log(`   Session ID: ${data.sessionId}\n`);
      passed++;
    } else {
      console.log('❌ FAILED - Could not create multi-item checkout\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED - ${error.message}\n`);
    failed++;
  }

  // Test 5: Invalid Request (Missing Items)
  console.log('📋 Test 5: Invalid Request - Missing Items (Should Fail)');
  try {
    const { status, data } = await makeRequest('POST', '/api/v1/stripe/create-checkout-session', {});

    if (status === 400) {
      console.log('✅ PASSED - Correctly rejected invalid request');
      console.log(`   Error: ${data.error}\n`);
      passed++;
    } else {
      console.log('❌ FAILED - Should have returned 400\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED - ${error.message}\n`);
    failed++;
  }

  // Test 6: Invalid Request (Missing Required Fields)
  console.log('📋 Test 6: Invalid Request - Missing Required Fields (Should Fail)');
  try {
    const { status, data } = await makeRequest('POST', '/api/v1/stripe/create-checkout-session', {
      items: [
        {
          id: 1,
          name: 'Test Product',
          // Missing price and quantity
        },
      ],
    });

    if (status === 400) {
      console.log('✅ PASSED - Correctly rejected invalid item format');
      console.log(`   Error: ${data.error}\n`);
      passed++;
    } else {
      console.log('❌ FAILED - Should have returned 400\n');
      failed++;
    }
  } catch (error) {
    console.log(`❌ FAILED - ${error.message}\n`);
    failed++;
  }

  // Summary
  console.log('='.repeat(50));
  console.log('📊 Test Summary\n');
  console.log(`✅ Passed: ${passed}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}`);
  }
  console.log('');

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Open a checkout URL above in your browser');
    console.log('   2. Use test card: 4242 4242 4242 4242');
    console.log('   3. Complete checkout to test end-to-end');
    console.log('   4. Check webhook logs in server console');
    console.log('   5. Review TESTING-CHECKOUT-SHIPPING.md for shipping implementation\n');
  } else {
    console.log('❌ Some tests failed. Review the errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
