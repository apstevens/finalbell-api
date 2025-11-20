# Dropshipping Configuration Guide

Complete setup guide for dropshipping via muaythai-boxing.com.

## 📋 Business Model Overview

**Your Dropshipping Flow:**
1. Customer buys from **finalbell.co.uk**
2. You receive payment via **Stripe**
3. Customer provides **their shipping address**
4. You place order on **muaythai-boxing.com** with:
   - **Shipping address**: Customer's address
   - **Billing address**: Your business address
5. muaythai-boxing.com ships directly to your customer
6. You keep the profit margin

---

## 🗄️ Database Schema Updates Needed

### Add Order Model for Dropshipping

Add to `prisma/schema.prisma`:

```prisma
// E-commerce Order Status
enum OrderStatus {
  PENDING           // Payment received, not yet ordered from supplier
  PROCESSING        // Order placed with supplier
  SHIPPED           // Shipped by supplier
  DELIVERED         // Delivered to customer
  CANCELLED         // Order cancelled
  REFUNDED          // Order refunded
  FAILED            // Order failed (supplier issue)
}

enum OrderSource {
  ECOMMERCE         // From finalbell.co.uk store
  TRAINER_PORTAL    // From trainer portal (if applicable)
}

// E-commerce Order (for dropshipping)
model Order {
  id                    String       @id @default(uuid())
  orderNumber           String       @unique // User-friendly order number (e.g., "FB-2025-0001")

  // Stripe Information
  stripeSessionId       String?      @unique
  stripePaymentIntentId String?
  stripeChargeId        String?

  // Customer Information
  customerEmail         String
  customerName          String
  customerPhone         String?

  // Shipping Address (Customer's address)
  shippingName          String
  shippingAddressLine1  String
  shippingAddressLine2  String?
  shippingCity          String
  shippingCounty        String?
  shippingPostcode      String
  shippingCountry       String       @default("GB")

  // Billing Address (Your business address - optional, Stripe has this)
  billingName           String?
  billingAddressLine1   String?
  billingAddressLine2   String?
  billingCity           String?
  billingCounty         String?
  billingPostcode       String?
  billingCountry        String?

  // Order Details
  subtotal              Float        // Product total
  shippingCost          Float        // Shipping cost
  tax                   Float        @default(0) // VAT if applicable
  total                 Float        // Grand total
  currency              String       @default("GBP")

  // Order Status
  status                OrderStatus  @default(PENDING)
  source                OrderSource  @default(ECOMMERCE)

  // Dropshipping Info
  supplierOrderId       String?      // Order ID from muaythai-boxing.com
  supplierOrderDate     DateTime?    // When order was placed with supplier
  supplierTrackingNumber String?     // Tracking number from supplier
  supplierNotes         String?      @db.Text

  // Fulfillment
  estimatedDelivery     DateTime?
  actualDeliveryDate    DateTime?

  // Internal Notes
  internalNotes         String?      @db.Text
  customerNotes         String?      @db.Text

  // Timestamps
  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt
  paidAt                DateTime?
  cancelledAt           DateTime?
  refundedAt            DateTime?

  // Relations
  items                 OrderItem[]
  statusHistory         OrderStatusHistory[]

  @@index([orderNumber])
  @@index([customerEmail])
  @@index([status])
  @@index([createdAt])
  @@index([stripeSessionId])
}

// Order Items
model OrderItem {
  id              String   @id @default(uuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  // Product Info (snapshot at time of order)
  productName     String
  productSku      String?
  productHandle   String?  // From CSV
  variantName     String?

  // Pricing
  unitPrice       Float
  quantity        Int
  subtotal        Float

  // Supplier Info
  supplierSku     String?  // SKU on muaythai-boxing.com
  supplierPrice   Float?   // What you pay to supplier (for profit calculation)

  // Product Details (optional)
  productImage    String?
  productWeight   Float?   // in grams

  createdAt       DateTime @default(now())

  @@index([orderId])
  @@index([productSku])
}

// Order Status History (for tracking)
model OrderStatusHistory {
  id          String      @id @default(uuid())
  orderId     String
  order       Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status      OrderStatus
  notes       String?     @db.Text
  createdBy   String?     // Admin/system user who made the change
  createdAt   DateTime    @default(now())

  @@index([orderId, createdAt])
}
```

---

## 🔧 Implementation Steps

### Step 1: Update Stripe Webhook Handler

Update `src/controllers/stripeController.ts`:

```typescript
import { prisma } from '../config/database';

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
        const event = await handleWebhook(req.body, signature);

        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object;
                console.log('[Stripe Webhook] Checkout session completed:', session.id);

                // Get full session details with shipping info
                const fullSession = await stripe.checkout.sessions.retrieve(
                    session.id,
                    { expand: ['line_items', 'customer_details'] }
                );

                // Save order to database
                await saveOrder(fullSession);

                // TODO: Optionally send confirmation email to customer
                // TODO: Optionally notify admin to place order with supplier

                break;

            case 'payment_intent.succeeded':
                const paymentIntent = event.data.object;
                console.log('[Stripe Webhook] Payment succeeded:', paymentIntent.id);
                break;

            case 'payment_intent.payment_failed':
                const failedPayment = event.data.object;
                console.log('[Stripe Webhook] Payment failed:', failedPayment.id);
                break;

            default:
                console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(400).json({
            error: 'Webhook error',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

// Helper function to save order
async function saveOrder(session: any) {
    try {
        const shipping = session.shipping_details || session.shipping;
        const customer = session.customer_details;

        // Generate order number
        const orderNumber = await generateOrderNumber();

        // Calculate totals
        const subtotal = session.amount_subtotal || 0;
        const shippingCost = session.total_shipping_cost || session.shipping_cost?.amount_total || 0;
        const total = session.amount_total || 0;

        // Create order
        const order = await prisma.order.create({
            data: {
                orderNumber,
                stripeSessionId: session.id,
                stripePaymentIntentId: session.payment_intent,

                // Customer info
                customerEmail: customer?.email || session.customer_email,
                customerName: customer?.name || shipping?.name || 'Unknown',
                customerPhone: customer?.phone || null,

                // Shipping address (customer's address)
                shippingName: shipping?.name || customer?.name || 'Unknown',
                shippingAddressLine1: shipping?.address?.line1 || '',
                shippingAddressLine2: shipping?.address?.line2 || null,
                shippingCity: shipping?.address?.city || '',
                shippingCounty: shipping?.address?.state || null,
                shippingPostcode: shipping?.address?.postal_code || '',
                shippingCountry: shipping?.address?.country || 'GB',

                // Amounts (convert from pence to pounds)
                subtotal: subtotal / 100,
                shippingCost: shippingCost / 100,
                tax: 0, // Add VAT calculation if needed
                total: total / 100,
                currency: session.currency?.toUpperCase() || 'GBP',

                status: 'PENDING',
                paidAt: new Date(),

                // Create order items
                items: {
                    create: session.line_items?.data?.map((item: any, index: number) => ({
                        productName: item.description || item.price.product.name,
                        productSku: item.price.product.metadata?.sku || null,
                        unitPrice: item.price.unit_amount / 100,
                        quantity: item.quantity,
                        subtotal: (item.amount_total || item.amount_subtotal) / 100,
                        productImage: item.price.product.images?.[0] || null,
                    })) || [],
                },

                // Create status history
                statusHistory: {
                    create: {
                        status: 'PENDING',
                        notes: 'Order received and payment confirmed',
                    },
                },
            },
            include: {
                items: true,
            },
        });

        console.log(`[Order Created] Order ${orderNumber} saved successfully`);
        console.log(`[Order Details] Customer: ${order.customerEmail}`);
        console.log(`[Order Details] Shipping: ${order.shippingCity}, ${order.shippingPostcode}`);
        console.log(`[Order Details] Total: £${order.total}`);

        return order;
    } catch (error) {
        console.error('[Order Save Error]', error);
        throw error;
    }
}

// Generate unique order number
async function generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FB-${year}-`;

    // Find last order number for this year
    const lastOrder = await prisma.order.findFirst({
        where: {
            orderNumber: {
                startsWith: prefix,
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    let nextNumber = 1;
    if (lastOrder) {
        const lastNumber = parseInt(lastOrder.orderNumber.split('-')[2]);
        nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}
```

### Step 2: Create Order Service

Create `src/services/orderService.ts`:

```typescript
import { prisma } from '../config/database';
import { OrderStatus } from '@prisma/client';

export class OrderService {
    /**
     * Get all orders with filters
     */
    async getOrders(filters?: {
        status?: OrderStatus;
        customerEmail?: string;
        startDate?: Date;
        endDate?: Date;
    }) {
        return await prisma.order.findMany({
            where: {
                status: filters?.status,
                customerEmail: filters?.customerEmail,
                createdAt: {
                    gte: filters?.startDate,
                    lte: filters?.endDate,
                },
            },
            include: {
                items: true,
                statusHistory: {
                    orderBy: { createdAt: 'desc' },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    /**
     * Get order by ID
     */
    async getOrderById(id: string) {
        return await prisma.order.findUnique({
            where: { id },
            include: {
                items: true,
                statusHistory: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
    }

    /**
     * Get order by order number
     */
    async getOrderByNumber(orderNumber: string) {
        return await prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: true,
                statusHistory: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
    }

    /**
     * Update order status
     */
    async updateOrderStatus(
        orderId: string,
        newStatus: OrderStatus,
        notes?: string,
        trackingNumber?: string
    ) {
        const updates: any = {
            status: newStatus,
            statusHistory: {
                create: {
                    status: newStatus,
                    notes: notes || `Status updated to ${newStatus}`,
                },
            },
        };

        if (trackingNumber) {
            updates.supplierTrackingNumber = trackingNumber;
        }

        if (newStatus === 'PROCESSING' && !updates.supplierOrderDate) {
            updates.supplierOrderDate = new Date();
        }

        if (newStatus === 'DELIVERED') {
            updates.actualDeliveryDate = new Date();
        }

        if (newStatus === 'CANCELLED') {
            updates.cancelledAt = new Date();
        }

        if (newStatus === 'REFUNDED') {
            updates.refundedAt = new Date();
        }

        return await prisma.order.update({
            where: { id: orderId },
            data: updates,
            include: {
                items: true,
                statusHistory: true,
            },
        });
    }

    /**
     * Get pending orders (need to be ordered from supplier)
     */
    async getPendingOrders() {
        return await prisma.order.findMany({
            where: {
                status: 'PENDING',
            },
            include: {
                items: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
    }

    /**
     * Mark order as placed with supplier
     */
    async markAsOrderedWithSupplier(
        orderId: string,
        supplierOrderId: string,
        notes?: string
    ) {
        return await this.updateOrderStatus(
            orderId,
            'PROCESSING',
            notes || `Order placed with supplier. Supplier Order ID: ${supplierOrderId}`,
            undefined
        );
    }

    /**
     * Get order statistics
     */
    async getOrderStats() {
        const [total, pending, processing, shipped, delivered] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { status: 'PENDING' } }),
            prisma.order.count({ where: { status: 'PROCESSING' } }),
            prisma.order.count({ where: { status: 'SHIPPED' } }),
            prisma.order.count({ where: { status: 'DELIVERED' } }),
        ]);

        const revenue = await prisma.order.aggregate({
            _sum: { total: true },
            where: {
                status: {
                    in: ['PROCESSING', 'SHIPPED', 'DELIVERED'],
                },
            },
        });

        return {
            total,
            pending,
            processing,
            shipped,
            delivered,
            totalRevenue: revenue._sum.total || 0,
        };
    }
}

export const orderService = new OrderService();
```

### Step 3: Create Order Routes and Controller

Create `src/routes/orderRoutes.ts`:

```typescript
import express from 'express';
import {
    getOrders,
    getOrderById,
    updateOrderStatus,
    getPendingOrders,
    getOrderStats
} from '../controllers/orderController';
import { adminAuth } from '../middleware/auth'; // Implement admin authentication

const router = express.Router();

// Get all orders (admin only)
router.get('/', adminAuth, getOrders);

// Get pending orders (admin only)
router.get('/pending', adminAuth, getPendingOrders);

// Get order statistics (admin only)
router.get('/stats', adminAuth, getOrderStats);

// Get specific order (admin only)
router.get('/:id', adminAuth, getOrderById);

// Update order status (admin only)
router.patch('/:id/status', adminAuth, updateOrderStatus);

export default router;
```

Create `src/controllers/orderController.ts`:

```typescript
import { Request, Response } from 'express';
import { orderService } from '../services/orderService';
import { OrderStatus } from '@prisma/client';

export const getOrders = async (req: Request, res: Response) => {
    try {
        const { status, customerEmail, startDate, endDate } = req.query;

        const orders = await orderService.getOrders({
            status: status as OrderStatus,
            customerEmail: customerEmail as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
        });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};

export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const order = await orderService.getOrderById(id);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes, trackingNumber, supplierOrderId } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const order = await orderService.updateOrderStatus(
            id,
            status as OrderStatus,
            notes,
            trackingNumber
        );

        res.json(order);
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: 'Failed to update order' });
    }
};

export const getPendingOrders = async (req: Request, res: Response) => {
    try {
        const orders = await orderService.getPendingOrders();
        res.json(orders);
    } catch (error) {
        console.error('Error fetching pending orders:', error);
        res.status(500).json({ error: 'Failed to fetch pending orders' });
    }
};

export const getOrderStats = async (req: Request, res: Response) => {
    try {
        const stats = await orderService.getOrderStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching order stats:', error);
        res.status(500).json({ error: 'Failed to fetch order stats' });
    }
};
```

### Step 4: Update Server to Include Order Routes

In `src/server.ts`, add:

```typescript
import orderRoutes from './routes/orderRoutes';

// Add after other routes
app.use('/api/v1/orders', orderRoutes);
```

---

## 🔐 Stripe Configuration

Your current Stripe setup is already correct for dropshipping:

```typescript
// In stripeService.ts - Already configured!
shipping_address_collection: {
    allowed_countries: ['GB'], // UK only ✅
},
billing_address_collection: 'required', // Collects billing info ✅
```

**What Stripe will collect:**
- ✅ Customer's shipping address (where to send products)
- ✅ Customer's billing address (for card verification)
- ✅ Customer's email and name
- ✅ Payment method

---

## 📦 Dropshipping Workflow

### Manual Process (Initial Setup)

1. **Customer Places Order**
   - Customer completes checkout on your site
   - Stripe processes payment
   - Webhook saves order to database with status `PENDING`

2. **View Pending Orders (Admin Dashboard)**
   ```bash
   GET /api/v1/orders/pending
   ```

   Response will include:
   - Customer's shipping address
   - Products ordered
   - Quantities
   - Customer email/phone

3. **Place Order with Supplier**
   - Go to muaythai-boxing.com
   - Log in to your account
   - Add products to cart
   - At checkout:
     - **Shipping Address**: Enter customer's address from order
     - **Billing Address**: Enter your business address
   - Complete purchase

4. **Update Order Status**
   ```bash
   PATCH /api/v1/orders/:orderId/status
   {
     "status": "PROCESSING",
     "supplierOrderId": "MTB-12345",
     "notes": "Order placed with muaythai-boxing.com"
   }
   ```

5. **When Supplier Ships**
   ```bash
   PATCH /api/v1/orders/:orderId/status
   {
     "status": "SHIPPED",
     "trackingNumber": "RM123456789GB",
     "notes": "Shipped via Royal Mail"
   }
   ```

6. **When Delivered**
   ```bash
   PATCH /api/v1/orders/:orderId/status
   {
     "status": "DELIVERED"
   }
   ```

### Automated Process (Future Enhancement)

For automation, you would need:
1. **muaythai-boxing.com API** (if available)
2. **Automated order placement script**
3. **Webhook integration** for tracking updates

---

## 💰 Profit Calculation

Add supplier cost tracking in `OrderItem`:

```typescript
// When creating order items, include:
supplierPrice: 35.99, // What you pay muaythai-boxing.com
unitPrice: 49.99,     // What customer pays you
// Profit per item: £14.00
```

To calculate total profit:

```typescript
const profit = orderItems.reduce((sum, item) => {
    const itemProfit = (item.unitPrice - (item.supplierPrice || 0)) * item.quantity;
    return sum + itemProfit;
}, 0);
```

---

## 📧 Email Notifications (Optional)

Set up email notifications for:

1. **Customer Order Confirmation**
   - Sent when payment succeeds
   - Includes order number, items, shipping address
   - Expected delivery time

2. **Shipping Notification**
   - Sent when order status changes to `SHIPPED`
   - Includes tracking number

3. **Admin Notification**
   - Email admin when new order received
   - Include customer shipping details for easy copy/paste

---

## 🎯 Admin Dashboard Requirements

Your admin dashboard should show:

1. **Pending Orders Table**
   - Order number
   - Customer name
   - Shipping address (formatted for easy copy/paste)
   - Products ordered
   - Total paid
   - Action button: "Place Order with Supplier"

2. **Order Details View**
   ```
   Order #FB-2025-0001

   Customer: John Smith (john@example.com)

   Shipping Address:
   123 Main Street
   London
   SW1A 1AA
   United Kingdom
   Phone: +44 7700 900000

   Products:
   - Boxing Gloves 16oz x1 @ £49.99
   - Hand Wraps x2 @ £12.99

   Subtotal: £75.97
   Shipping: £0.00
   Total: £75.97

   Status: PENDING
   ```

3. **Order Actions**
   - Mark as Processing
   - Add tracking number
   - Mark as Shipped
   - Mark as Delivered
   - Cancel/Refund

---

## 🚀 Testing the Full Flow

1. **Complete a test purchase**:
   ```bash
   node test-stripe-direct.js
   ```
   Open checkout URL and complete purchase

2. **Check webhook received order**:
   - Look for console log: `[Order Created] Order FB-2025-XXXX saved`

3. **Query pending orders**:
   ```bash
   curl http://localhost:8080/api/v1/orders/pending \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

4. **View order details** to get shipping address

5. **Simulate placing order with supplier**:
   ```bash
   curl -X PATCH http://localhost:8080/api/v1/orders/:orderId/status \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -d '{
       "status": "PROCESSING",
       "supplierOrderId": "MTB-TEST-123",
       "notes": "Test order placed"
     }'
   ```

---

## 📝 Next Steps

1. **Apply database migration**:
   ```bash
   npx prisma migrate dev --name add-orders-for-dropshipping
   ```

2. **Update webhook handler** with order saving logic

3. **Create order service and routes**

4. **Build admin dashboard** to view/manage orders

5. **Set up email notifications** (optional)

6. **Test full workflow** end-to-end

---

## 💡 Pro Tips

1. **Track Supplier Costs**: Always record what you pay muaythai-boxing.com for profit tracking

2. **Automate Where Possible**: Consider automating:
   - Order confirmation emails
   - Low stock alerts
   - Pending order notifications to admin

3. **Customer Communication**: Keep customers informed about:
   - Order confirmation (immediate)
   - Shipping notification (when supplier ships)
   - Delivery updates

4. **Inventory Sync**: Since you're using CSV sync, make sure:
   - Products shown are in stock at muaythai-boxing.com
   - Prices include your margin
   - Regular CSV updates (daily/weekly)

5. **Returns/Refunds**: Plan your returns policy:
   - Who handles returns? (You or supplier)
   - Refund processing
   - Restocking fees

---

## 📞 Support

For questions about:
- **Stripe Integration**: [TESTING-CHECKOUT-SHIPPING.md](TESTING-CHECKOUT-SHIPPING.md)
- **Database Schema**: [README.md](README.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

**Your dropshipping setup is ready to implement!** 🚀
