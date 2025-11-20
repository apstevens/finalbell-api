# Dropshipping Quick Start Guide

Fast reference for setting up dropshipping via muaythai-boxing.com.

## 🎯 Your Current Setup

✅ **Already Working:**
- Stripe checkout collects customer shipping address
- Stripe checkout collects billing information
- Payments are processed
- Webhooks receive checkout events

❌ **What's Missing:**
- Order storage in database
- Order management system
- Workflow to place orders with supplier

---

## 🚀 Quick Implementation (30 minutes)

### Step 1: Add Orders to Database (5 min)

Copy the schema from [DROPSHIPPING-SETUP.md](DROPSHIPPING-SETUP.md#add-order-model-for-dropshipping) and add to `prisma/schema.prisma`.

Then run:
```bash
npx prisma migrate dev --name add-orders-for-dropshipping
npx prisma generate
```

### Step 2: Update Webhook to Save Orders (10 min)

Add to `src/controllers/stripeController.ts`:

```typescript
// At top of file
import { prisma } from '../config/database';
import { stripe } from '../services/stripeService';

// Replace the checkout.session.completed case:
case 'checkout.session.completed':
    const session = event.data.object;
    console.log('[Webhook] Checkout completed:', session.id);

    // Get full session with shipping details
    const fullSession = await stripe.checkout.sessions.retrieve(
        session.id,
        { expand: ['line_items'] }
    );

    // Extract shipping address
    const shipping = fullSession.shipping_details;
    const customer = fullSession.customer_details;

    // Save order
    const orderNumber = `FB-${Date.now()}`;

    await prisma.order.create({
        data: {
            orderNumber,
            stripeSessionId: session.id,
            customerEmail: customer.email,
            customerName: customer.name,

            // Customer's shipping address
            shippingName: shipping.name,
            shippingAddressLine1: shipping.address.line1,
            shippingAddressLine2: shipping.address.line2,
            shippingCity: shipping.address.city,
            shippingPostcode: shipping.address.postal_code,
            shippingCountry: shipping.address.country,

            subtotal: fullSession.amount_subtotal / 100,
            shippingCost: (fullSession.shipping_cost?.amount_total || 0) / 100,
            total: fullSession.amount_total / 100,
            currency: 'GBP',
            status: 'PENDING',
            paidAt: new Date(),

            items: {
                create: fullSession.line_items.data.map(item => ({
                    productName: item.description,
                    unitPrice: item.price.unit_amount / 100,
                    quantity: item.quantity,
                    subtotal: item.amount_total / 100,
                })),
            },
        },
    });

    console.log(`[Order Saved] ${orderNumber} - ${customer.email}`);
    break;
```

### Step 3: Query Orders to Get Shipping Info (5 min)

View pending orders in your database:

```bash
# Using Prisma Studio (visual interface)
npx prisma studio
```

Or query programmatically:

```typescript
// Get all pending orders
const pendingOrders = await prisma.order.findMany({
    where: { status: 'PENDING' },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
});

// Print shipping addresses for easy copy/paste
pendingOrders.forEach(order => {
    console.log(`
Order: ${order.orderNumber}
Customer: ${order.customerName} (${order.customerEmail})

Shipping Address (use this on muaythai-boxing.com):
${order.shippingName}
${order.shippingAddressLine1}
${order.shippingAddressLine2 || ''}
${order.shippingCity}
${order.shippingPostcode}
${order.shippingCountry}

Products:
${order.items.map(i => `- ${i.productName} x${i.quantity} @ £${i.unitPrice}`).join('\n')}

Total: £${order.total}
    `);
});
```

### Step 4: Manual Dropshipping Process (10 min per order)

1. **Check for new orders:**
   ```bash
   npx prisma studio
   ```
   Look for orders with status = `PENDING`

2. **Go to muaythai-boxing.com:**
   - Add products to cart
   - At checkout, enter:
     - **Shipping Address**: Customer's address (from order)
     - **Billing Address**: Your business address

3. **Complete purchase on supplier site**

4. **Update order status** (optional - in database or via API)

---

## 📦 Complete Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Customer Checkout                                     │
│    - Customer visits finalbell.co.uk                     │
│    - Adds products to cart                               │
│    - Completes Stripe checkout                           │
│    - Enters their shipping address                       │
│    - Payment processed ✅                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Stripe Webhook                                        │
│    - Receives checkout.session.completed event           │
│    - Saves order to database                             │
│    - Status: PENDING                                     │
│    - Includes customer's shipping address                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. You Check Pending Orders                              │
│    - View orders in Prisma Studio or admin dashboard     │
│    - See customer shipping address                       │
│    - See products ordered                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. You Place Order with Supplier                         │
│    - Go to muaythai-boxing.com                           │
│    - Add products to cart                                │
│    - Shipping Address: Customer's address ← from DB      │
│    - Billing Address: Your business address              │
│    - Complete purchase                                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Supplier Ships Directly to Customer                   │
│    - muaythai-boxing.com ships to customer               │
│    - Customer receives product                           │
│    - You keep the profit margin 💰                       │
└─────────────────────────────────────────────────────────┘
```

---

## 💰 Pricing Strategy Example

| Product | Supplier Cost | Your Price | Profit |
|---------|--------------|------------|--------|
| Boxing Gloves 16oz | £35.99 | £49.99 | £14.00 |
| Hand Wraps | £8.99 | £12.99 | £4.00 |
| Training Shorts | £19.99 | £29.99 | £10.00 |

**Plus:**
- Shipping: FREE to customer (you pay supplier's shipping)
- Or: Charge customer £4.95, pay supplier £3.50 = £1.45 profit

---

## 🎯 Immediate Action Items

- [ ] **Apply database migration** (5 min)
  ```bash
  # Copy Order schema to prisma/schema.prisma
  npx prisma migrate dev --name add-orders-for-dropshipping
  ```

- [ ] **Update webhook handler** (10 min)
  - Add order saving code to stripeController.ts

- [ ] **Test with real checkout** (5 min)
  ```bash
  node test-stripe-direct.js
  ```
  Complete checkout, verify order saved

- [ ] **View orders** (2 min)
  ```bash
  npx prisma studio
  ```
  Check Orders table for new entry

- [ ] **Process first test order** (10 min)
  - Copy shipping address from database
  - Place test order on muaythai-boxing.com (if possible)

---

## 📊 What You'll See in Database

After a customer checkout, `Order` table will have:

```json
{
  "orderNumber": "FB-2025-0001",
  "customerEmail": "customer@example.com",
  "customerName": "John Smith",

  "shippingName": "John Smith",
  "shippingAddressLine1": "123 Main Street",
  "shippingCity": "London",
  "shippingPostcode": "SW1A 1AA",
  "shippingCountry": "GB",

  "subtotal": 49.99,
  "shippingCost": 0.00,
  "total": 49.99,

  "status": "PENDING",

  "items": [
    {
      "productName": "Boxing Gloves",
      "quantity": 1,
      "unitPrice": 49.99
    }
  ]
}
```

---

## 🔧 Optional Enhancements

### Add Admin API to View Orders

Create `src/routes/orderRoutes.ts`:

```typescript
import express from 'express';
import { prisma } from '../config/database';

const router = express.Router();

// Get all pending orders
router.get('/pending', async (req, res) => {
    const orders = await prisma.order.findMany({
        where: { status: 'PENDING' },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
});

// Get order details
router.get('/:id', async (req, res) => {
    const order = await prisma.order.findUnique({
        where: { id: req.params.id },
        include: { items: true },
    });
    res.json(order);
});

export default router;
```

Add to `src/server.ts`:
```typescript
import orderRoutes from './routes/orderRoutes';
app.use('/api/v1/orders', orderRoutes);
```

Then query:
```bash
curl http://localhost:8080/api/v1/orders/pending
```

---

## 📧 Email Notifications (Future)

Consider sending:

1. **To Customer:**
   - Order confirmation (immediately)
   - Shipping notification (when you ship)
   - Delivery confirmation

2. **To You (Admin):**
   - New order alert
   - Includes shipping address for easy copy/paste
   - Daily summary of pending orders

---

## 🎓 Learning Resources

- **Full Setup Guide**: [DROPSHIPPING-SETUP.md](DROPSHIPPING-SETUP.md)
- **Stripe Testing**: [TESTING-CHECKOUT-SHIPPING.md](TESTING-CHECKOUT-SHIPPING.md)
- **Database Schema**: `prisma/schema.prisma`
- **Prisma Docs**: https://www.prisma.io/docs

---

## 💡 Pro Tips

1. **Start Small**: Process first few orders manually to understand the workflow

2. **Track Everything**: Record supplier order IDs in the database

3. **Monitor Inventory**: Regularly sync CSV to ensure products are in stock

4. **Calculate Profit**: Track what you pay supplier vs what customer pays

5. **Automate Later**: Once comfortable with manual process, consider automation

---

## 🚨 Important Notes

1. **Your Stripe setup is already correct!** ✅
   - Already collecting shipping address
   - Already collecting billing address
   - No changes needed to stripeService.ts

2. **Customer sees shipping to their address** ✅
   - Stripe Checkout shows their address
   - They can edit it before paying

3. **You just need to:**
   - Save order to database (webhook)
   - Query orders to get shipping info
   - Place order with supplier using that info

---

**Ready to start?** Follow Step 1 above! 🚀

For complete details, see [DROPSHIPPING-SETUP.md](DROPSHIPPING-SETUP.md)
