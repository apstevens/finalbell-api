# Order Automation System - Implementation Guide

## Overview

This guide explains the automated order management system that has been implemented for Final Bell API. The system automatically creates orders when Stripe payments are completed, sends email notifications, and provides admin tools to manage order statuses.

## System Architecture

### 1. Database Models

Three new models have been added to the Prisma schema:

#### Order Model
- **Purpose**: Main order record
- **Key Fields**:
  - `orderNumber`: Unique identifier (format: `FB-YYYY-####`)
  - Customer information (name, email, phone)
  - Shipping and billing addresses
  - Order status, totals, and payment information
  - Fulfillment details (tracking number, carrier)

#### OrderItem Model
- **Purpose**: Line items in each order
- **Key Fields**:
  - Product information (snapshot at time of order)
  - Quantity, pricing, SKU
  - Weight and image URL

#### OrderStatusHistory Model
- **Purpose**: Audit trail of status changes
- **Key Fields**:
  - Status, timestamp, notes
  - Who made the change (admin user ID)

### 2. Order Status Flow

```
PENDING → PROCESSING → SHIPPED → DELIVERED
            ↓
        CANCELLED / REFUNDED
```

- **PENDING**: Order just created, payment received
- **PROCESSING**: Admin is working on fulfillment
- **SHIPPED**: Order sent to customer with tracking
- **DELIVERED**: Customer received the order
- **CANCELLED**: Order cancelled before shipping
- **REFUNDED**: Order refunded after payment

## Automated Features

### 1. Automatic Order Creation

**When**: Stripe checkout session completes successfully

**What happens**:
1. Stripe webhook fires (`checkout.session.completed`)
2. System extracts order details from Stripe session
3. Generates unique order number (e.g., `FB-2025-0001`)
4. Creates order in database with:
   - Customer information
   - Shipping address
   - Order items with product snapshots
   - Payment details
5. Creates initial status history entry
6. Sends confirmation email to customer
7. Sends notification email to admin

**Location**: [src/controllers/stripeController.ts:58-140](src/controllers/stripeController.ts#L58-L140)

### 2. Email Notifications

Three types of automated emails:

#### Order Confirmation (Customer)
- **When**: Order is created after payment
- **Contains**:
  - Order number and date
  - List of items purchased
  - Total amount breakdown
  - Shipping address
  - Professional HTML formatting

#### Shipping Notification (Customer)
- **When**: Order status updated to SHIPPED
- **Contains**:
  - Tracking number and link
  - Carrier information
  - Estimated delivery time
  - Shipping address

#### New Order Alert (Admin)
- **When**: Order is created
- **Contains**:
  - Order summary
  - Customer details
  - Items ordered
  - Action required reminder

**Location**: [src/services/emailService.ts](src/services/emailService.ts)

### 3. Admin Order Management API

All endpoints require admin authentication.

#### Get All Orders
```
GET /orders?status=PENDING&limit=50&offset=0
```
Filter by status, customer email, date range, etc.

#### Get Pending Orders
```
GET /orders/pending
```
Returns orders needing fulfillment (PENDING or PROCESSING status).

#### Search Orders
```
GET /orders/search?q=customer@example.com
```
Search by email, order number, or customer name.

#### Get Order Details
```
GET /orders/:id
GET /orders/number/FB-2025-0001
```

#### Update Order Status
```
PATCH /orders/:id/status
Body: {
  "status": "SHIPPED",
  "trackingNumber": "1Z999AA10123456784",
  "trackingUrl": "https://track.royal-mail.com/...",
  "carrier": "Royal Mail",
  "notes": "Shipped via Royal Mail 48"
}
```
**Note**: When status is set to SHIPPED, shipping notification email is automatically sent.

#### Add Internal Notes
```
PATCH /orders/:id/notes
Body: {
  "notes": "Customer requested gift wrapping"
}
```

#### Cancel Order
```
POST /orders/:id/cancel
Body: {
  "reason": "Customer requested cancellation"
}
```

#### Get Statistics
```
GET /orders/stats?dateFrom=2025-01-01&dateTo=2025-12-31
```
Returns counts by status and total revenue.

**Location**: [src/routes/orderRoutes.ts](src/routes/orderRoutes.ts)

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Email Configuration (Optional - will log if not configured)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=Final Bell <noreply@finalbell.co.uk>
ADMIN_EMAIL=admin@finalbell.co.uk

# Stripe (Required for webhooks)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database (Required)
DATABASE_URL=postgresql://...
```

### Email Setup

**If SMTP is not configured**: Emails will be logged to console only (development mode).

**Recommended Email Providers**:
- Gmail (App Passwords)
- SendGrid
- Mailgun
- AWS SES

**To enable emails**:
1. Configure SMTP settings in `.env`
2. Set `ADMIN_EMAIL` for admin notifications
3. Restart the server

## Database Setup

### Run Migration

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

Or if using migrations:
```bash
npx prisma migrate dev --name add-order-models
```

## Testing the System

### 1. Test Order Creation (Manual)

You can test order creation without Stripe by using the order service directly:

```typescript
import orderService from './src/services/orderService';
import { OrderSource } from '@prisma/client';

const testOrder = await orderService.createOrder({
  customerEmail: 'test@example.com',
  customerFirstName: 'John',
  customerLastName: 'Doe',
  shippingStreet: '123 Test Street',
  shippingCity: 'London',
  shippingPostcode: 'SW1A 1AA',
  source: OrderSource.MANUAL,
  subtotal: 50.00,
  shippingCost: 0,
  tax: 0,
  total: 50.00,
  items: [{
    productId: 'test-sku',
    productName: 'Test Product',
    sku: 'TEST-001',
    quantity: 1,
    unitPrice: 50.00,
    totalPrice: 50.00,
  }],
});

console.log('Order created:', testOrder.orderNumber);
```

### 2. Test Stripe Webhook (Local Development)

Use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8080/stripe/webhook

# Trigger a test event
stripe trigger checkout.session.completed
```

### 3. Test Email Notifications

```typescript
import emailService from './src/services/emailService';
import orderService from './src/services/orderService';

const order = await orderService.getOrderByNumber('FB-2025-0001');
if (order) {
  await emailService.sendOrderConfirmation(order);
  console.log('Confirmation email sent');
}
```

### 4. Test Admin API

```bash
# Get admin token first (login as admin user)
TOKEN="your-admin-jwt-token"

# Get pending orders
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/orders/pending

# Update order status
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"PROCESSING","notes":"Starting fulfillment"}' \
  http://localhost:8080/orders/ORDER_ID/status

# Mark as shipped
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status":"SHIPPED",
    "trackingNumber":"1Z999AA10123456784",
    "carrier":"Royal Mail"
  }' \
  http://localhost:8080/orders/ORDER_ID/status
```

## Workflow for Dropshipping

### Daily Order Fulfillment Process

1. **Morning: Check New Orders**
   ```
   GET /orders/pending
   ```
   Review all pending orders that need fulfillment.

2. **Place Orders with Supplier**
   - Log into muaythai-boxing.com
   - Place orders using customer shipping addresses
   - Note the supplier order ID

3. **Update Order Status to PROCESSING**
   ```
   PATCH /orders/:id/status
   Body: {
     "status": "PROCESSING",
     "supplierOrderId": "MTB-12345",
     "notes": "Order placed with supplier"
   }
   ```

4. **When Supplier Ships: Update to SHIPPED**
   ```
   PATCH /orders/:id/status
   Body: {
     "status": "SHIPPED",
     "trackingNumber": "1Z999AA10123456784",
     "trackingUrl": "https://track.royal-mail.com/...",
     "carrier": "Royal Mail",
     "notes": "Shipped by supplier"
   }
   ```
   **Automatic**: Customer receives shipping notification email.

5. **When Delivered: Update to DELIVERED**
   ```
   PATCH /orders/:id/status
   Body: {
     "status": "DELIVERED",
     "notes": "Confirmed delivery"
   }
   ```

### Handling Issues

#### Customer Wants to Cancel
```
POST /orders/:id/cancel
Body: {
  "reason": "Customer requested cancellation before shipping"
}
```

#### Problem with Order
```
PATCH /orders/:id/notes
Body: {
  "notes": "Customer reports damaged item. Contacted supplier for replacement."
}
```

## Monitoring and Maintenance

### View Order Statistics

```bash
# Get stats for current month
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/orders/stats?dateFrom=2025-01-01&dateTo=2025-01-31"

# Response:
{
  "success": true,
  "stats": {
    "totalOrders": 45,
    "pendingOrders": 3,
    "processingOrders": 5,
    "shippedOrders": 30,
    "deliveredOrders": 7,
    "cancelledOrders": 0,
    "totalRevenue": 2250.50
  }
}
```

### Search Orders

```bash
# Find orders by customer email
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/orders/search?q=customer@example.com"

# Find orders by order number
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/orders/search?q=FB-2025-0042"
```

### Filter Orders by Date

```bash
# Get all orders from last week
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/orders?dateFrom=2025-01-01&dateTo=2025-01-07"
```

## Security Features

- **Admin Authentication**: All order management endpoints require admin JWT token
- **Status History**: All status changes are logged with timestamp and user
- **Duplicate Prevention**: Webhook handler checks for existing orders before creating
- **Error Handling**: Webhook failures don't crash the system - errors are logged

## Future Enhancements

Consider adding:

1. **Supplier API Integration**: Automate order placement with muaythai-boxing.com if they provide an API
2. **Automatic Status Updates**: Poll tracking APIs to auto-update delivery status
3. **Customer Portal**: Let customers track their orders on your website
4. **Inventory Sync**: Automatically update stock levels when orders are placed
5. **Return Management**: Add endpoints for handling returns and refunds
6. **Analytics Dashboard**: Build charts and reports for order trends

## Troubleshooting

### Orders Not Being Created from Stripe

1. Check Stripe webhook secret is configured:
   ```bash
   echo $STRIPE_WEBHOOK_SECRET
   ```

2. Check webhook endpoint is accessible:
   ```bash
   curl -X POST http://localhost:8080/stripe/webhook
   ```

3. Check server logs for webhook errors:
   ```bash
   # Look for "[Stripe Webhook]" logs
   ```

4. Verify webhook is registered in Stripe Dashboard:
   - Go to Developers → Webhooks
   - Check endpoint URL matches your server
   - Check for failed webhook attempts

### Emails Not Sending

1. Check SMTP configuration in `.env`
2. Check server logs for email errors
3. Verify credentials work (test with nodemailer directly)
4. Check spam folder for test emails

### Orders Stuck in PENDING

- This is expected! Orders need manual fulfillment
- Use `GET /orders/pending` to see what needs attention
- Update status as you fulfill orders

## Files Modified/Created

### Created Files
- [src/services/orderService.ts](src/services/orderService.ts) - Order business logic
- [src/services/emailService.ts](src/services/emailService.ts) - Email notifications
- [src/controllers/orderController.ts](src/controllers/orderController.ts) - Order API endpoints
- [src/routes/orderRoutes.ts](src/routes/orderRoutes.ts) - Order routes
- [ORDER-AUTOMATION-GUIDE.md](ORDER-AUTOMATION-GUIDE.md) - This file

### Modified Files
- [prisma/schema.prisma](prisma/schema.prisma) - Added Order, OrderItem, OrderStatusHistory models
- [src/controllers/stripeController.ts](src/controllers/stripeController.ts) - Added automatic order creation
- [src/services/stripeService.ts](src/services/stripeService.ts) - Expanded session retrieval
- [src/config/env.ts](src/config/env.ts) - Added ADMIN_EMAIL config
- [src/server.ts](src/server.ts) - Registered order routes
- [package.json](package.json) - Added nodemailer dependency

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Test individual components (database, email, API) separately
4. Check that all environment variables are configured correctly

## Summary

You now have a complete automated order management system that:

✅ Automatically creates orders when customers pay via Stripe
✅ Sends beautiful confirmation emails to customers
✅ Notifies admins of new orders
✅ Provides API endpoints to manage order statuses
✅ Sends shipping notifications when orders are marked as shipped
✅ Tracks order history and changes
✅ Supports your dropshipping workflow

The system is production-ready and will help you efficiently manage orders from Final Bell customers!
