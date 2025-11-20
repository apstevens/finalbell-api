# Testing Checkout Function and Shipping Costs

Complete guide to test your Stripe checkout integration and shipping cost calculations.

## 📋 Table of Contents

1. [Current Implementation](#current-implementation)
2. [Testing Checkout (Current)](#testing-checkout-current)
3. [Adding Shipping Costs](#adding-shipping-costs)
4. [Testing with Shipping](#testing-with-shipping)
5. [Stripe Test Cards](#stripe-test-cards)
6. [Common Issues](#common-issues)

---

## 🔍 Current Implementation

Your current checkout implementation:

- ✅ Collects shipping address (UK only)
- ✅ Collects billing address
- ✅ Processes payments via Stripe
- ❌ **Does NOT calculate shipping costs** (needs to be added)
- ❌ **Does NOT use product weights** from CSV (available but not used)

### Current Flow:
```
1. User adds items to cart →
2. Frontend calls POST /api/v1/stripe/create-checkout-session →
3. Stripe Checkout opens with items (no shipping cost) →
4. User enters address and pays →
5. Webhook notifies your server →
6. Order complete
```

---

## 🧪 Testing Checkout (Current)

### Step 1: Start Your API Server

```bash
# Development mode
npm run dev

# Or production mode
npm run start:prod
```

Verify the server is running:
```bash
curl http://localhost:8080/health
```

### Step 2: Test Checkout Session Creation

Create a test request file `test-checkout-request.json`:

```json
{
  "items": [
    {
      "id": 1,
      "name": "Muay Thai Boxing Gloves",
      "price": 49.99,
      "quantity": 1,
      "image": "https://example.com/gloves.jpg"
    },
    {
      "id": 2,
      "name": "Hand Wraps",
      "price": 12.99,
      "quantity": 2,
      "image": "https://example.com/wraps.jpg"
    }
  ]
}
```

Test the checkout endpoint:

```bash
# Create checkout session
curl -X POST http://localhost:8080/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d @test-checkout-request.json
```

**Expected Response:**
```json
{
  "sessionId": "cs_test_xxxxxxxxxxxxxxxxxxxxx"
}
```

### Step 3: Test Invalid Requests

**Test 1: Missing items**
```bash
curl -X POST http://localhost:8080/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** `400 Bad Request` - "Invalid request: items array is required"

**Test 2: Invalid item format**
```bash
curl -X POST http://localhost:8080/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": 1,
        "name": "Test Product"
      }
    ]
  }'
```

**Expected:** `400 Bad Request` - "Invalid item format: id, name, price, and quantity are required"

### Step 4: Test Checkout in Browser

1. **Get the session ID** from Step 2
2. **Visit Stripe Checkout** at:
   ```
   https://checkout.stripe.com/pay/{SESSION_ID}
   ```
   Replace `{SESSION_ID}` with the actual session ID

3. **Complete checkout with test card:**
   - Email: Any valid email
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - Postal Code: Any UK postcode (e.g., `SW1A 1AA`)

### Step 5: Retrieve Session Details

After completing checkout:

```bash
# Replace cs_test_xxx with your actual session ID
curl http://localhost:8080/api/v1/stripe/session/cs_test_xxxxxxxxxxxxx
```

**Expected Response:**
```json
{
  "id": "cs_test_xxxxxxxxxxxxx",
  "status": "complete",
  "customer_email": "test@example.com",
  "amount_total": 7597,
  "currency": "gbp",
  "payment_status": "paid"
}
```

---

## 💰 Adding Shipping Costs

### Current Issue
Your checkout **does NOT include shipping costs**. Customers only pay for products.

### Solution Options

#### Option 1: Fixed Shipping Rate (Simplest)

Add a fixed shipping cost to all orders:

**Update `stripeService.ts`:**

```typescript
// Add after line 53 (shipping_address_collection)
shipping_options: [
    {
        shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
                amount: 495, // £4.95 in pence
                currency: 'gbp',
            },
            display_name: 'Standard Shipping',
            delivery_estimate: {
                minimum: {
                    unit: 'business_day',
                    value: 3,
                },
                maximum: {
                    unit: 'business_day',
                    value: 5,
                },
            },
        },
    },
    {
        shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
                amount: 995, // £9.95 in pence
                currency: 'gbp',
            },
            display_name: 'Express Shipping',
            delivery_estimate: {
                minimum: {
                    unit: 'business_day',
                    value: 1,
                },
                maximum: {
                    unit: 'business_day',
                    value: 2,
                },
            },
        },
    },
],
```

#### Option 2: Weight-Based Shipping (Recommended)

Calculate shipping based on product weights from your CSV:

**Create new file `src/services/shippingService.ts`:**

```typescript
import { CheckoutItem } from './stripeService';
import { productService, Product } from './productService';

export interface ShippingRate {
  name: string;
  amount: number; // in pence
  minDays: number;
  maxDays: number;
}

/**
 * UK Shipping Rate Tiers (example rates - adjust to your needs)
 */
const SHIPPING_TIERS = [
  { maxWeight: 500, standard: 395, express: 695 },     // Up to 500g: £3.95 / £6.95
  { maxWeight: 1000, standard: 495, express: 895 },    // Up to 1kg: £4.95 / £8.95
  { maxWeight: 2000, standard: 695, express: 1195 },   // Up to 2kg: £6.95 / £11.95
  { maxWeight: 5000, standard: 995, express: 1695 },   // Up to 5kg: £9.95 / £16.95
  { maxWeight: 10000, standard: 1495, express: 2495 }, // Up to 10kg: £14.95 / £24.95
  { maxWeight: Infinity, standard: 1995, express: 2995 }, // Over 10kg: £19.95 / £29.95
];

/**
 * Calculate total weight of items in cart
 */
async function calculateTotalWeight(items: CheckoutItem[]): Promise<number> {
  let totalWeight = 0;

  for (const item of items) {
    // Try to find product by name (you may need to adjust this logic)
    const products = await productService.getAllProducts();
    const product = products.find(p =>
      p.title.toLowerCase().includes(item.name.toLowerCase())
    );

    if (product && product.variants.length > 0) {
      // Use first variant's weight (or you could match by SKU)
      const weight = product.variants[0].weightGrams;
      totalWeight += weight * item.quantity;
    } else {
      // Default weight if product not found (500g)
      console.warn(`Product weight not found for: ${item.name}, using default 500g`);
      totalWeight += 500 * item.quantity;
    }
  }

  return totalWeight;
}

/**
 * Get shipping rates based on total cart weight
 */
export async function getShippingRates(items: CheckoutItem[]): Promise<ShippingRate[]> {
  const totalWeight = await calculateTotalWeight(items);
  console.log(`[Shipping] Total cart weight: ${totalWeight}g`);

  // Find applicable tier
  const tier = SHIPPING_TIERS.find(t => totalWeight <= t.maxWeight);

  if (!tier) {
    throw new Error('Weight exceeds maximum shipping limit');
  }

  return [
    {
      name: 'Standard Shipping (3-5 business days)',
      amount: tier.standard,
      minDays: 3,
      maxDays: 5,
    },
    {
      name: 'Express Shipping (1-2 business days)',
      amount: tier.express,
      minDays: 1,
      maxDays: 2,
    },
  ];
}

/**
 * Format shipping rates for Stripe
 */
export function formatShippingRatesForStripe(rates: ShippingRate[]) {
  return rates.map(rate => ({
    shipping_rate_data: {
      type: 'fixed_amount' as const,
      fixed_amount: {
        amount: rate.amount,
        currency: 'gbp',
      },
      display_name: rate.name,
      delivery_estimate: {
        minimum: {
          unit: 'business_day' as const,
          value: rate.minDays,
        },
        maximum: {
          unit: 'business_day' as const,
          value: rate.maxDays,
        },
      },
    },
  }));
}
```

**Update `stripeService.ts` to use shipping service:**

```typescript
import { getShippingRates, formatShippingRatesForStripe } from './shippingService';

// Inside createCheckoutSession function, before stripe.checkout.sessions.create:
const shippingRates = await getShippingRates(items);
const stripeShippingOptions = formatShippingRatesForStripe(shippingRates);

// Then in the session creation, add:
shipping_options: stripeShippingOptions,
```

#### Option 3: Pre-created Stripe Shipping Rates

Use Stripe Dashboard to create reusable shipping rates:

**Step 1: Create shipping rates in Stripe Dashboard:**
1. Go to https://dashboard.stripe.com/test/shipping-rates
2. Click "New shipping rate"
3. Create rates (e.g., Standard, Express)
4. Copy the rate IDs (e.g., `shr_xxxxxxxxxxxxx`)

**Step 2: Use in your code:**

```typescript
// In stripeService.ts
shipping_options: [
    {
        shipping_rate: 'shr_1ABCDEFGHIJ12345678', // Your Standard rate ID
    },
    {
        shipping_rate: 'shr_1KLMNOPQRST98765432', // Your Express rate ID
    },
],
```

---

## 🧪 Testing with Shipping

### Test 1: Create Checkout with Shipping

After implementing shipping (choose one option above), test:

```bash
curl -X POST http://localhost:8080/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": 1,
        "name": "Muay Thai Boxing Gloves",
        "price": 49.99,
        "quantity": 1,
        "image": "https://example.com/gloves.jpg"
      }
    ]
  }'
```

### Test 2: Complete Checkout with Shipping

1. Get session ID from response
2. Open in browser: `https://checkout.stripe.com/pay/{SESSION_ID}`
3. **Verify shipping options appear**
4. Select a shipping option
5. Enter delivery address
6. Complete payment with test card

### Test 3: Verify Total Amount

After checkout, retrieve session:

```bash
curl http://localhost:8080/api/v1/stripe/session/cs_test_xxxxxxxxxxxxx
```

**Verify:**
- `amount_total` includes product + shipping
- Example: £49.99 product + £4.95 shipping = £54.94 = 5494 pence

---

## 💳 Stripe Test Cards

Use these test cards for different scenarios:

### Successful Payments
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

### Payment Requires Authentication (3D Secure)
```
Card: 4000 0027 6000 3184
Expiry: Any future date
CVC: Any 3 digits
```

### Declined Payment
```
Card: 4000 0000 0000 0002
Expiry: Any future date
CVC: Any 3 digits
```

### Insufficient Funds
```
Card: 4000 0000 0000 9995
Expiry: Any future date
CVC: Any 3 digits
```

### Expired Card
```
Card: 4000 0000 0000 0069
Expiry: Any past date
CVC: Any 3 digits
```

### Card Number with Spaces (should work)
```
Card: 4242 4242 4242 4242
(Stripe accepts cards with/without spaces)
```

---

## 🎯 Complete Testing Script

Create `test-checkout.sh` (Linux/Mac) or `test-checkout.ps1` (Windows):

### Linux/Mac (`test-checkout.sh`):

```bash
#!/bin/bash

API_URL="http://localhost:8080"

echo "🧪 Testing Final Bell Checkout Flow"
echo "===================================="

# Test 1: Health Check
echo -e "\n✅ Test 1: Health Check"
curl -s $API_URL/health | jq

# Test 2: Create Checkout Session
echo -e "\n✅ Test 2: Create Checkout Session"
SESSION_RESPONSE=$(curl -s -X POST $API_URL/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "id": 1,
        "name": "Test Product",
        "price": 29.99,
        "quantity": 2,
        "image": "https://via.placeholder.com/150"
      }
    ]
  }')

echo $SESSION_RESPONSE | jq

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId')

if [ "$SESSION_ID" != "null" ]; then
  echo -e "\n✅ Session created: $SESSION_ID"
  echo "   Open in browser: https://checkout.stripe.com/pay/$SESSION_ID"

  # Test 3: Retrieve Session
  echo -e "\n✅ Test 3: Retrieve Session Details"
  sleep 2
  curl -s $API_URL/api/v1/stripe/session/$SESSION_ID | jq
else
  echo "❌ Failed to create session"
fi

# Test 4: Invalid Request
echo -e "\n✅ Test 4: Invalid Request (should fail)"
curl -s -X POST $API_URL/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{}' | jq

echo -e "\n✅ Testing Complete!"
```

Make it executable:
```bash
chmod +x test-checkout.sh
./test-checkout.sh
```

### Windows PowerShell (`test-checkout.ps1`):

```powershell
$API_URL = "http://localhost:8080"

Write-Host "🧪 Testing Final Bell Checkout Flow" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n✅ Test 1: Health Check" -ForegroundColor Green
Invoke-RestMethod -Uri "$API_URL/health" -Method Get | ConvertTo-Json

# Test 2: Create Checkout Session
Write-Host "`n✅ Test 2: Create Checkout Session" -ForegroundColor Green
$body = @{
    items = @(
        @{
            id = 1
            name = "Test Product"
            price = 29.99
            quantity = 2
            image = "https://via.placeholder.com/150"
        }
    )
} | ConvertTo-Json

$session = Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/create-checkout-session" -Method Post -Body $body -ContentType "application/json"
$session | ConvertTo-Json

if ($session.sessionId) {
    Write-Host "`n✅ Session created: $($session.sessionId)" -ForegroundColor Green
    Write-Host "   Open in browser: https://checkout.stripe.com/pay/$($session.sessionId)"

    # Test 3: Retrieve Session
    Write-Host "`n✅ Test 3: Retrieve Session Details" -ForegroundColor Green
    Start-Sleep -Seconds 2
    Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/session/$($session.sessionId)" -Method Get | ConvertTo-Json
} else {
    Write-Host "❌ Failed to create session" -ForegroundColor Red
}

# Test 4: Invalid Request
Write-Host "`n✅ Test 4: Invalid Request (should fail)" -ForegroundColor Green
try {
    Invoke-RestMethod -Uri "$API_URL/api/v1/stripe/create-checkout-session" -Method Post -Body '{}' -ContentType "application/json"
} catch {
    Write-Host "Expected error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n✅ Testing Complete!" -ForegroundColor Cyan
```

Run it:
```powershell
.\test-checkout.ps1
```

---

## 🐛 Common Issues

### Issue 1: "STRIPE_SECRET_KEY is not defined"
**Solution:**
```bash
# Check your .env file has:
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
```

### Issue 2: "Invalid API Key"
**Solution:** Verify your Stripe key:
```bash
# Should start with sk_test_ (test mode) or sk_live_ (production)
echo $STRIPE_SECRET_KEY
```

### Issue 3: Webhook not receiving events
**Solution:**
1. Use Stripe CLI for local testing:
```bash
stripe listen --forward-to localhost:8080/api/v1/stripe/webhook
```
2. Update `.env` with webhook secret:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### Issue 4: Session not found
**Solution:** Make sure you're using the correct session ID format:
```bash
# Correct: cs_test_xxxxxxxxxxxxxxxxxxxxx
# Wrong: cus_xxxxx (customer ID)
```

### Issue 5: Shipping options not appearing
**Solution:**
- Verify `shipping_options` is added to session creation
- Check Stripe Dashboard → Checkout Sessions → View session → Should show shipping options
- Test with different weights/cart values

### Issue 6: Amount mismatch
**Solution:**
- Verify prices are in pence (multiply by 100)
- Check shipping amount is also in pence
- Example: £49.99 = 4999 pence

---

## 📊 Expected Test Results Summary

| Test | Expected Result | Pass/Fail |
|------|----------------|-----------|
| Health check returns 200 | ✅ `{"status":"ok"}` | ✅ |
| Create session with valid items | ✅ Returns sessionId | ✅ |
| Create session with invalid items | ✅ Returns 400 error | ✅ |
| Open checkout URL in browser | ✅ Stripe checkout loads | Manual |
| Complete payment with test card | ✅ Redirects to success | Manual |
| Webhook receives event | ✅ Logs "Checkout session completed" | ✅ |
| Session details match payment | ✅ amount_total correct | ✅ |
| Shipping options available | ✅ Shows in checkout | After adding shipping |

---

## 🚀 Next Steps

1. **Choose shipping implementation** (Fixed, Weight-based, or Pre-created)
2. **Add shipping code** to your `stripeService.ts`
3. **Test locally** with the scripts above
4. **Verify in Stripe Dashboard** at https://dashboard.stripe.com/test/payments
5. **Test webhook** handling with Stripe CLI
6. **Deploy to production** with live Stripe keys

---

## 📝 Checklist Before Production

- [ ] Shipping costs implemented and tested
- [ ] Test all Stripe test cards
- [ ] Webhook receiving and processing events correctly
- [ ] Order data being saved to database
- [ ] Confirmation emails being sent (if implemented)
- [ ] Inventory being updated (if implemented)
- [ ] Using production Stripe keys (`sk_live_...`)
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] SSL/HTTPS enabled for webhooks
- [ ] Error handling tested for failed payments
- [ ] Refund process tested (manual in Stripe Dashboard)

---

## 📞 Resources

- **Stripe Testing Docs**: https://stripe.com/docs/testing
- **Stripe Checkout Guide**: https://stripe.com/docs/checkout/quickstart
- **Stripe CLI**: https://stripe.com/docs/stripe-cli
- **Shipping Rates**: https://stripe.com/docs/payments/checkout/shipping

Good luck with your checkout testing! 🎉
