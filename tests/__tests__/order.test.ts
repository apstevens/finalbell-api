import request from 'supertest';
import { PrismaClient, OrderStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import app from '../../src/server';

const prisma = new PrismaClient();

describe('Order Management and Tracking Tests', () => {
  let testUser: any;
  let adminUser: any;
  let accessToken: string;
  let adminToken: string;
  let testOrder: any;

  const testUserData = {
    email: 'ordertest@example.com',
    password: 'TestPassword123!@#',
    firstName: 'Order',
    lastName: 'Test',
  };

  const adminUserData = {
    email: 'admin@example.com',
    password: 'AdminPassword123!@#',
    firstName: 'Admin',
    lastName: 'User',
  };

  beforeAll(async () => {
    // Clean up existing test data
    await prisma.order.deleteMany({
      where: { customerEmail: { in: [testUserData.email, adminUserData.email] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUserData.email, adminUserData.email] } },
    });

    // Create test user
    const userResponse = await request(app)
      .post('/auth/register')
      .send(testUserData);

    testUser = userResponse.body.user;
    accessToken = userResponse.body.accessToken;

    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        email: adminUserData.email,
        passwordHash: await bcrypt.hash(adminUserData.password, 12),
        firstName: adminUserData.firstName,
        lastName: adminUserData.lastName,
        role: 'ADMIN',
      },
    });

    const adminLoginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: adminUserData.email,
        password: adminUserData.password,
      });

    adminToken = adminLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await prisma.order.deleteMany({
      where: { customerEmail: { in: [testUserData.email, adminUserData.email] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [testUserData.email, adminUserData.email] } },
    });
    await prisma.$disconnect();
  });

  describe('Order Creation', () => {
    it('should create order with valid data', async () => {
      const orderData = {
        customerEmail: testUserData.email,
        customerFirstName: testUserData.firstName,
        customerLastName: testUserData.lastName,
        customerPhone: '+44 7700 900000',
        shippingStreet: '123 Test Street',
        shippingCity: 'London',
        shippingPostcode: 'SW1A 1AA',
        shippingCountry: 'GB',
        items: [
          {
            productId: 'TEST-SKU-001',
            productName: 'Test Boxing Gloves',
            sku: 'TEST-SKU-001',
            quantity: 2,
            unitPrice: 49.99,
            totalPrice: 99.98,
            weight: 500,
            imageUrl: 'https://example.com/gloves.jpg',
          },
          {
            productId: 'TEST-SKU-002',
            productName: 'Test Hand Wraps',
            sku: 'TEST-SKU-002',
            quantity: 1,
            unitPrice: 12.99,
            totalPrice: 12.99,
            weight: 100,
          },
        ],
        subtotal: 112.97,
        shippingCost: 4.99,
        tax: 0,
        total: 117.96,
      };

      // This would typically be called from Stripe webhook
      // You may need to create a test endpoint or directly use the service
      const order = await prisma.order.create({
        data: {
          orderNumber: `FB-2025-${Date.now()}`,
          ...orderData,
          items: {
            create: orderData.items,
          },
          status: 'PENDING',
          source: 'MANUAL',
        },
        include: {
          items: true,
        },
      });

      testOrder = order;

      expect(order).toHaveProperty('id');
      expect(order.orderNumber).toContain('FB-2025');
      expect(order.customerEmail).toBe(testUserData.email);
      expect(order.items).toHaveLength(2);
      expect(order.status).toBe('PENDING');
      expect(order.total).toBe(117.96);
    });

    it('should generate unique order numbers', async () => {
      const order1 = await prisma.order.create({
        data: {
          orderNumber: `FB-2025-${Date.now()}-1`,
          customerEmail: testUserData.email,
          customerFirstName: testUserData.firstName,
          customerLastName: testUserData.lastName,
          shippingStreet: '123 Test Street',
          shippingCity: 'London',
          shippingPostcode: 'SW1A 1AA',
          subtotal: 50,
          total: 50,
          status: 'PENDING',
          source: 'MANUAL',
        },
      });

      const order2 = await prisma.order.create({
        data: {
          orderNumber: `FB-2025-${Date.now()}-2`,
          customerEmail: testUserData.email,
          customerFirstName: testUserData.firstName,
          customerLastName: testUserData.lastName,
          shippingStreet: '123 Test Street',
          shippingCity: 'London',
          shippingPostcode: 'SW1A 1AA',
          subtotal: 50,
          total: 50,
          status: 'PENDING',
          source: 'MANUAL',
        },
      });

      expect(order1.orderNumber).not.toBe(order2.orderNumber);

      // Clean up
      await prisma.order.deleteMany({
        where: { id: { in: [order1.id, order2.id] } },
      });
    });
  });

  describe('GET /orders', () => {
    it('should get all orders (admin only)', async () => {
      const response = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should reject non-admin users from viewing all orders', async () => {
      const response = await request(app)
        .get('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/orders?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((order: any) => {
        expect(order.status).toBe('PENDING');
      });
    });

    it('should filter orders by email', async () => {
      const response = await request(app)
        .get(`/orders?email=${testUserData.email}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((order: any) => {
        expect(order.customerEmail).toBe(testUserData.email);
      });
    });

    it('should filter orders by date range', async () => {
      const startDate = new Date('2025-01-01').toISOString();
      const endDate = new Date('2025-12-31').toISOString();

      const response = await request(app)
        .get(`/orders?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /orders/pending', () => {
    it('should get pending orders (admin only)', async () => {
      const response = await request(app)
        .get('/orders/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((order: any) => {
        expect(order.status).toBe('PENDING');
      });
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/orders/pending')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /orders/:id', () => {
    it('should get order by ID with items', async () => {
      const response = await request(app)
        .get(`/orders/${testOrder.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(testOrder.id);
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('should allow customers to view their own orders', async () => {
      const response = await request(app)
        .get(`/orders/${testOrder.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testOrder.id);
      expect(response.body.customerEmail).toBe(testUserData.email);
    });

    it('should reject request for non-existent order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/orders/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get(`/orders/${testOrder.id}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /orders/:id/status', () => {
    it('should update order status to PROCESSING', async () => {
      const response = await request(app)
        .put(`/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'PROCESSING',
          notes: 'Order confirmed and being prepared',
        })
        .expect(200);

      expect(response.body.status).toBe('PROCESSING');

      // Verify status history was created
      const statusHistory = await prisma.orderStatusHistory.findMany({
        where: { orderId: testOrder.id },
      });
      expect(statusHistory.length).toBeGreaterThan(0);
    });

    it('should update order status to SHIPPED with tracking', async () => {
      const trackingData = {
        status: 'SHIPPED',
        trackingNumber: 'RM123456789GB',
        carrier: 'Royal Mail',
        trackingUrl: 'https://www.royalmail.com/track/RM123456789GB',
        notes: 'Shipped via Royal Mail 48',
      };

      const response = await request(app)
        .put(`/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(trackingData)
        .expect(200);

      expect(response.body.status).toBe('SHIPPED');
      expect(response.body.trackingNumber).toBe(trackingData.trackingNumber);
      expect(response.body.carrier).toBe(trackingData.carrier);
      expect(response.body.trackingUrl).toBe(trackingData.trackingUrl);
      expect(response.body.shippedAt).toBeDefined();
    });

    it('should update order status to DELIVERED', async () => {
      const response = await request(app)
        .put(`/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'DELIVERED',
          notes: 'Package delivered successfully',
        })
        .expect(200);

      expect(response.body.status).toBe('DELIVERED');
      expect(response.body.deliveredAt).toBeDefined();
    });

    it('should update order status to CANCELLED', async () => {
      // Create a new order to cancel
      const cancelOrder = await prisma.order.create({
        data: {
          orderNumber: `FB-2025-CANCEL-${Date.now()}`,
          customerEmail: testUserData.email,
          customerFirstName: testUserData.firstName,
          customerLastName: testUserData.lastName,
          shippingStreet: '123 Test Street',
          shippingCity: 'London',
          shippingPostcode: 'SW1A 1AA',
          subtotal: 50,
          total: 50,
          status: 'PENDING',
          source: 'MANUAL',
        },
      });

      const response = await request(app)
        .put(`/orders/${cancelOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'CANCELLED',
          cancellationReason: 'Customer requested cancellation',
        })
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
      expect(response.body.cancellationReason).toBe('Customer requested cancellation');

      // Clean up
      await prisma.order.delete({ where: { id: cancelOrder.id } });
    });

    it('should reject invalid status values', async () => {
      const response = await request(app)
        .put(`/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'INVALID_STATUS',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-admin users from updating status', async () => {
      const response = await request(app)
        .put(`/orders/${testOrder.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'PROCESSING',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .put(`/orders/${testOrder.id}/status`)
        .send({
          status: 'PROCESSING',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Order Status History', () => {
    it('should maintain complete status history', async () => {
      // Create a new order
      const historyOrder = await prisma.order.create({
        data: {
          orderNumber: `FB-2025-HISTORY-${Date.now()}`,
          customerEmail: testUserData.email,
          customerFirstName: testUserData.firstName,
          customerLastName: testUserData.lastName,
          shippingStreet: '123 Test Street',
          shippingCity: 'London',
          shippingPostcode: 'SW1A 1AA',
          subtotal: 100,
          total: 100,
          status: 'PENDING',
          source: 'MANUAL',
        },
      });

      // Update through multiple statuses
      const statuses: OrderStatus[] = ['PROCESSING', 'SHIPPED', 'DELIVERED'];

      for (const status of statuses) {
        await request(app)
          .put(`/orders/${historyOrder.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status });
      }

      // Check status history
      const statusHistory = await prisma.orderStatusHistory.findMany({
        where: { orderId: historyOrder.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(statusHistory.length).toBe(statuses.length);
      statuses.forEach((status, index) => {
        expect(statusHistory[index].status).toBe(status);
      });

      // Clean up
      await prisma.orderStatusHistory.deleteMany({
        where: { orderId: historyOrder.id },
      });
      await prisma.order.delete({ where: { id: historyOrder.id } });
    });
  });

  describe('Customer Order Tracking', () => {
    it('should allow customers to track their own orders', async () => {
      const response = await request(app)
        .get(`/orders/${testOrder.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testOrder.id);
      expect(response.body.status).toBeDefined();
      expect(response.body.trackingNumber).toBeDefined();
    });

    it('should not allow customers to view other customers orders', async () => {
      // Create another customer
      const otherCustomer = await request(app)
        .post('/auth/register')
        .send({
          email: 'other@example.com',
          password: 'OtherPassword123!@#',
          firstName: 'Other',
          lastName: 'Customer',
        });

      const otherToken = otherCustomer.body.accessToken;

      // Try to view testOrder
      const response = await request(app)
        .get(`/orders/${testOrder.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Clean up
      await prisma.user.delete({ where: { id: otherCustomer.body.user.id } });
    });

    it('should get all orders for current user', async () => {
      const response = await request(app)
        .get('/users/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((order: any) => {
        expect(order.customerEmail).toBe(testUserData.email);
      });
    });
  });

  describe('Order Search and Filtering', () => {
    it('should search orders by order number', async () => {
      const response = await request(app)
        .get(`/orders?orderNumber=${testOrder.orderNumber}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].orderNumber).toBe(testOrder.orderNumber);
    });

    it('should search orders by customer name', async () => {
      const response = await request(app)
        .get(`/orders?customerName=${testUserData.firstName}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter orders by price range', async () => {
      const response = await request(app)
        .get('/orders?minTotal=50&maxTotal=200')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((order: any) => {
        expect(order.total).toBeGreaterThanOrEqual(50);
        expect(order.total).toBeLessThanOrEqual(200);
      });
    });
  });

  describe('Order Data Integrity', () => {
    it('should store complete shipping address', async () => {
      expect(testOrder.shippingStreet).toBeDefined();
      expect(testOrder.shippingCity).toBeDefined();
      expect(testOrder.shippingPostcode).toBeDefined();
      expect(testOrder.shippingCountry).toBeDefined();
    });

    it('should store complete order items with pricing', async () => {
      const order = await prisma.order.findUnique({
        where: { id: testOrder.id },
        include: { items: true },
      });

      expect(order?.items.length).toBeGreaterThan(0);
      order?.items.forEach((item) => {
        expect(item.productName).toBeDefined();
        expect(item.sku).toBeDefined();
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.unitPrice).toBeGreaterThan(0);
        expect(item.totalPrice).toBe(item.unitPrice * item.quantity);
      });
    });

    it('should calculate totals correctly', async () => {
      const order = await prisma.order.findUnique({
        where: { id: testOrder.id },
        include: { items: true },
      });

      const itemsTotal = order?.items.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      expect(order?.subtotal).toBe(itemsTotal);
      expect(order?.total).toBe(order?.subtotal + order?.shippingCost + order?.tax);
    });
  });
});
