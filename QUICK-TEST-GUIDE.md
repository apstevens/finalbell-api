# Quick Testing Guide - Checkout & Shipping

Fast reference for testing your checkout and shipping functionality.

## 🚀 Quick Start (5 Minutes)

### Step 1: Start Your Server
```bash
npm run dev
```

### Step 2: Run Test Script
**Windows:**
```powershell
.\test-checkout.ps1
```

**Mac/Linux/Any:**
```bash
node test-checkout-simple.js
```

### Step 3: Test in Browser
Copy one of the checkout URLs from the test output and open in browser:
```
https://checkout.stripe.com/pay/cs_test_xxxxxxxxxxxxx
```

Use test card: **4242 4242 4242 4242**

---

## 📊 Current Status

### ✅ What's Working Now:
- Checkout session creation
- Product pricing
- Payment processing
- Shipping address collection (UK only)
- Billing address collection
- Webhook handling

### ⚠️ What's NOT Implemented Yet:
- **Shipping cost calculation** (customers don't pay for shipping)
- Weight-based shipping rates
- Free shipping threshold

---

## 💰 Adding Shipping Costs (Choose One)

### Option 1: Quick Fixed Rate (5 minutes)

Edit `src/services/stripeService.ts`, add after line 53:

```typescript
shipping_options: [
    {
        shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
                amount: 495, // £4.95
                currency: 'gbp',
            },
            display_name: 'Standard Shipping',
        },
    },
],
```

### Option 2: Weight-Based (Already created! - 10 minutes)

1. **The shipping service is already created** at:
   `src/services/shippingService.ts`

2. **Update `src/services/stripeService.ts`:**

Add import at top:
```typescript
import { getShippingRates, formatShippingRatesForStripe } from './shippingService';
```

Replace the `createCheckoutSession` function around line 27:
```typescript
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
    const { items, successUrl, cancelUrl, customerEmail } = params;

    // Create line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => ({
        price_data: {
            currency: 'gbp',
            product_data: {
                name: item.name,
                images: item.image ? [item.image] : [],
            },
            unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
    }));

    // Calculate shipping rates based on cart weight
    const shippingRates = await getShippingRates(items);
    const stripeShippingOptions = formatShippingRatesForStripe(shippingRates);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        shipping_address_collection: {
            allowed_countries: ['GB'],
        },
        shipping_options: stripeShippingOptions, // ADD THIS LINE
        billing_address_collection: 'required',
        metadata: {
            source: 'final-bell-marketing',
        },
    });

    return session;
}
```

3. **Test it:**
```bash
node test-checkout-simple.js
```

---

## 🧪 Testing Checklist

### Manual Testing:
- [ ] Server starts without errors
- [ ] Health endpoint returns 200 OK
- [ ] Create checkout session succeeds
- [ ] Checkout URL opens in browser
- [ ] Shipping options appear in checkout (after adding shipping)
- [ ] Can complete payment with test card
- [ ] Webhook receives event
- [ ] Session details show correct amount

### Test Cards:
```
Success:     4242 4242 4242 4242
Requires 3D: 4000 0027 6000 3184
Declined:    4000 0000 0000 0002
```

### Quick Test Commands:

**Health Check:**
```bash
curl http://localhost:8080/health
```

**Create Checkout:**
```bash
curl -X POST http://localhost:8080/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{
      "id": 1,
      "name": "Test Product",
      "price": 29.99,
      "quantity": 1,
      "image": "https://via.placeholder.com/150"
    }]
  }'
```

**Get Session:**
```bash
curl http://localhost:8080/api/v1/stripe/session/cs_test_xxxxx
```

---

## 📁 Files Created for You

1. **TESTING-CHECKOUT-SHIPPING.md** - Complete testing guide with all details
2. **src/services/shippingService.ts** - Ready-to-use shipping cost calculator
3. **test-checkout.ps1** - Windows PowerShell test script
4. **test-checkout-simple.js** - Cross-platform Node.js test script
5. **QUICK-TEST-GUIDE.md** - This file

---

## 🔧 Shipping Rate Configuration

Edit `src/services/shippingService.ts` to adjust:

### Shipping Tiers (lines 13-19):
```typescript
const SHIPPING_TIERS = [
  { maxWeight: 500, standard: 395, express: 695 },     // Up to 500g
  { maxWeight: 1000, standard: 495, express: 895 },    // Up to 1kg
  { maxWeight: 2000, standard: 695, express: 1195 },   // Up to 2kg
  // ... add more tiers
];
```

### Free Shipping Threshold (line 29):
```typescript
const FREE_SHIPPING_THRESHOLD = 10000; // £100 = 10000 pence
```

### Default Weight (line 24):
```typescript
const DEFAULT_PRODUCT_WEIGHT = 500; // 500 grams
```

---

## 🐛 Common Issues

### "Server not running"
```bash
# Make sure server is started:
npm run dev
```

### "STRIPE_SECRET_KEY not defined"
```bash
# Check your .env file has:
STRIPE_SECRET_KEY=sk_test_xxxxx
```

### "Shipping options not appearing"
1. Make sure you added `shipping_options` to session creation
2. Check server logs for shipping calculation
3. Verify weight calculation is working

### "Product weight not found"
- Shipping service will use 500g default
- Make sure CSV file exists: `data/mtb-product-export.csv`
- Or adjust product matching logic in `shippingService.ts`

---

## 📊 Expected Results

### Small Order (< £100):
- Products: £29.99
- Shipping: £3.95 - £6.95 (depending on weight)
- **Total: ~£33.94 - £36.94**

### Large Order (> £100):
- Products: £149.98
- Shipping: **FREE standard** (or £4.95 express)
- **Total: £149.98 - £154.93**

---

## 🚀 Production Checklist

Before going live:
- [ ] Change to production Stripe keys (`sk_live_...`)
- [ ] Test with real bank cards in test mode first
- [ ] Configure webhook in Stripe Dashboard
- [ ] Adjust shipping rates for your business
- [ ] Set appropriate free shipping threshold
- [ ] Update product weights in CSV
- [ ] Test all test cards scenarios
- [ ] Verify amounts in Stripe Dashboard

---

## 📞 Quick Links

- **Detailed Guide:** [TESTING-CHECKOUT-SHIPPING.md](TESTING-CHECKOUT-SHIPPING.md)
- **Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Stripe Docs:** https://stripe.com/docs/testing
- **Stripe Dashboard:** https://dashboard.stripe.com/test

---

## ⚡ Commands Reference

```bash
# Start server
npm run dev

# Run tests
node test-checkout-simple.js          # Cross-platform
.\test-checkout.ps1                   # Windows

# Test manually
curl http://localhost:8080/health     # Health check
curl -X POST http://localhost:8080/api/v1/stripe/create-checkout-session \
  -H "Content-Type: application/json" -d @test-data.json

# Stripe CLI (for webhooks)
stripe login
stripe listen --forward-to localhost:8080/api/v1/stripe/webhook

# Build for production
npm run build
npm run start:prod
```

---

**Good luck with your testing!** 🎉

For detailed explanations, see [TESTING-CHECKOUT-SHIPPING.md](TESTING-CHECKOUT-SHIPPING.md)
