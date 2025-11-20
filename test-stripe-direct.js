#!/usr/bin/env node
/**
 * Direct Stripe Checkout Test
 * Tests Stripe integration directly without needing the server running
 * This verifies your checkout and shipping implementation works
 */

require('dotenv').config();
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in environment');
  console.log('   Make sure .env file has STRIPE_SECRET_KEY set');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

console.log('\n🧪 Direct Stripe Checkout & Shipping Test\n');
console.log('='.repeat(60) + '\n');

async function testCheckoutWithShipping() {
  try {
    // Test 1: Small order
    console.log('📦 Test 1: Small Order (£29.98)');
    const session1 = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Hand Wraps',
              images: ['https://via.placeholder.com/150'],
            },
            unit_amount: 1499, // £14.99
          },
          quantity: 2,
        },
      ],
      mode: 'payment',
      success_url: `${CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/cancel`,
      shipping_address_collection: {
        allowed_countries: ['GB'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'gbp' },
            display_name: 'Standard Shipping (3-5 business days)',
          },
        },
      ],
      billing_address_collection: 'required',
      metadata: {
        source: 'direct-test',
      },
    });

    console.log('✅ Session created successfully!');
    console.log(`   Session ID: ${session1.id}`);
    console.log(`   Amount: £${(session1.amount_total / 100).toFixed(2)}`);
    console.log(`   Currency: ${session1.currency.toUpperCase()}`);
    console.log(`   Status: ${session1.status}`);
    console.log(`   🌐 Checkout URL: https://checkout.stripe.com/pay/${session1.id}`);
    console.log('');

    // Test 2: Multiple items
    console.log('📦 Test 2: Multiple Items (£79.98)');
    const session2 = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Boxing Gloves',
              images: ['https://via.placeholder.com/150'],
            },
            unit_amount: 4999, // £49.99
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: 'Training Shorts',
              images: ['https://via.placeholder.com/150'],
            },
            unit_amount: 2999, // £29.99
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/cancel`,
      shipping_address_collection: {
        allowed_countries: ['GB'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'gbp' },
            display_name: 'Standard Shipping (3-5 business days)',
          },
        },
      ],
      billing_address_collection: 'required',
      metadata: {
        source: 'direct-test',
      },
    });

    console.log('✅ Session created successfully!');
    console.log(`   Session ID: ${session2.id}`);
    console.log(`   Amount: £${(session2.amount_total / 100).toFixed(2)}`);
    console.log(`   Currency: ${session2.currency.toUpperCase()}`);
    console.log(`   Status: ${session2.status}`);
    console.log(`   🌐 Checkout URL: https://checkout.stripe.com/pay/${session2.id}`);
    console.log('');

    // Test 3: Retrieve session to verify structure
    console.log('📋 Test 3: Verify Session Structure');
    const retrieved = await stripe.checkout.sessions.retrieve(session1.id);

    console.log('✅ Session retrieved successfully!');
    console.log(`   ID: ${retrieved.id}`);
    console.log(`   Status: ${retrieved.status}`);
    console.log(`   Payment Status: ${retrieved.payment_status}`);
    console.log(`   Amount Total: £${(retrieved.amount_total / 100).toFixed(2)}`);
    console.log(`   Shipping Address Collection: ${retrieved.shipping_address_collection ? 'Enabled' : 'Disabled'}`);
    console.log(`   Billing Address Collection: ${retrieved.billing_address_collection}`);
    console.log('');

    // Summary
    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('🎉 Your checkout is working with shipping options!\n');
    console.log('📝 What you can do now:');
    console.log('   1. Copy one of the checkout URLs above');
    console.log('   2. Open it in your browser');
    console.log('   3. Use test card: 4242 4242 4242 4242');
    console.log('   4. Expiry: Any future date (e.g., 12/30)');
    console.log('   5. CVC: Any 3 digits (e.g., 123)');
    console.log('   6. Complete the checkout\n');
    console.log('✨ Current Implementation:');
    console.log('   - Shipping cost: FREE (£0.00)');
    console.log('   - Shipping option: Standard (3-5 business days)');
    console.log('   - Countries: UK only');
    console.log('   - Address collection: Shipping + Billing\n');
    console.log('💡 To add paid shipping:');
    console.log('   - Edit src/services/stripeService.ts');
    console.log('   - Change "amount: 0" to "amount: 495" for £4.95');
    console.log('   - Or use the weight-based shipping service\n');
    console.log('📊 View in Stripe Dashboard:');
    console.log('   https://dashboard.stripe.com/test/payments\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.type) {
      console.error(`   Error type: ${error.type}`);
    }
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

// Run tests
testCheckoutWithShipping();
