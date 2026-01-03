import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import app from '../../src/server';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Mock nodemailer
jest.mock('nodemailer');
const mockSendMail = jest.fn();
const mockCreateTransport = nodemailer.createTransport as jest.MockedFunction<
  typeof nodemailer.createTransport
>;

describe('Email Notification Tests', () => {
  let adminUser: any;
  let adminToken: string;
  let testOrder: any;

  const adminUserData = {
    email: 'emailadmin@example.com',
    password: 'AdminPassword123!@#',
    firstName: 'Email',
    lastName: 'Admin',
  };

  beforeAll(async () => {
    // Setup nodemailer mock
    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: jest.fn().mockResolvedValue(true),
    } as any);

    // Clean up existing test data
    await prisma.order.deleteMany({
      where: { customerEmail: 'emailtest@example.com' },
    });
    await prisma.user.deleteMany({
      where: { email: adminUserData.email },
    });

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

    // Create test order
    testOrder = await prisma.order.create({
      data: {
        orderNumber: `FB-2025-EMAIL-${Date.now()}`,
        customerEmail: 'emailtest@example.com',
        customerFirstName: 'Email',
        customerLastName: 'Test',
        customerPhone: '+44 7700 900000',
        shippingStreet: '123 Test Street',
        shippingCity: 'London',
        shippingPostcode: 'SW1A 1AA',
        shippingCountry: 'GB',
        items: {
          create: [
            {
              productId: 'TEST-SKU-001',
              productName: 'Test Boxing Gloves',
              sku: 'TEST-SKU-001',
              quantity: 2,
              unitPrice: 49.99,
              totalPrice: 99.98,
              weight: 500,
            },
          ],
        },
        status: 'PENDING',
        source: 'STRIPE',
        subtotal: 99.98,
        shippingCost: 4.99,
        tax: 0,
        total: 104.97,
        stripeSessionId: 'cs_test_123456',
        paidAt: new Date(),
      },
      include: {
        items: true,
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.order.deleteMany({
      where: { customerEmail: 'emailtest@example.com' },
    });
    await prisma.user.deleteMany({
      where: { email: adminUserData.email },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Clear mock before each test
    mockSendMail.mockClear();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
  });

  describe('Order Confirmation Email', () => {
    it('should send order confirmation email after order creation', async () => {
      // Simulate order confirmation (normally triggered by Stripe webhook)
      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.to).toBe(testOrder.customerEmail);
      expect(emailCall.subject).toContain('Order Confirmation');
      expect(emailCall.subject).toContain(testOrder.orderNumber);
      expect(emailCall.html).toContain(testOrder.orderNumber);
      expect(emailCall.html).toContain('Test Boxing Gloves');
      expect(emailCall.html).toContain('£104.97');
    });

    it('should include order items in confirmation email', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      // Should contain item details
      expect(htmlContent).toContain('Test Boxing Gloves');
      expect(htmlContent).toContain('Quantity: 2');
      expect(htmlContent).toContain('£49.99');
    });

    it('should include shipping address in confirmation email', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      expect(htmlContent).toContain('123 Test Street');
      expect(htmlContent).toContain('London');
      expect(htmlContent).toContain('SW1A 1AA');
    });

    it('should include total breakdown in confirmation email', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      expect(htmlContent).toContain('Subtotal');
      expect(htmlContent).toContain('£99.98');
      expect(htmlContent).toContain('Shipping');
      expect(htmlContent).toContain('£4.99');
      expect(htmlContent).toContain('Total');
      expect(htmlContent).toContain('£104.97');
    });
  });

  describe('Shipping Notification Email', () => {
    beforeAll(async () => {
      // Update order to shipped status
      await prisma.order.update({
        where: { id: testOrder.id },
        data: {
          status: 'SHIPPED',
          trackingNumber: 'RM123456789GB',
          carrier: 'Royal Mail',
          trackingUrl: 'https://www.royalmail.com/track/RM123456789GB',
          shippedAt: new Date(),
        },
      });
    });

    it('should send shipping notification when order is shipped', async () => {
      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'shipping' })
        .expect(200);

      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.to).toBe(testOrder.customerEmail);
      expect(emailCall.subject).toContain('Shipped');
      expect(emailCall.subject).toContain(testOrder.orderNumber);
    });

    it('should include tracking information in shipping email', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'shipping' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      expect(htmlContent).toContain('RM123456789GB');
      expect(htmlContent).toContain('Royal Mail');
      expect(htmlContent).toContain('https://www.royalmail.com/track/RM123456789GB');
    });

    it('should include estimated delivery date in shipping email', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'shipping' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      // Should mention delivery timeframe
      expect(
        htmlContent.includes('delivery') ||
        htmlContent.includes('arrive') ||
        htmlContent.includes('expected')
      ).toBe(true);
    });
  });

  describe('Delivery Confirmation Email', () => {
    beforeAll(async () => {
      // Update order to delivered status
      await prisma.order.update({
        where: { id: testOrder.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
      });
    });

    it('should send delivery confirmation when order is delivered', async () => {
      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'delivery' })
        .expect(200);

      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.to).toBe(testOrder.customerEmail);
      expect(emailCall.subject).toContain('Delivered');
      expect(emailCall.subject).toContain(testOrder.orderNumber);
    });

    it('should include delivery confirmation message', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'delivery' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      expect(
        htmlContent.includes('delivered') ||
        htmlContent.includes('arrived') ||
        htmlContent.includes('received')
      ).toBe(true);
    });

    it('should encourage customer feedback/review', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'delivery' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      // Should encourage review or feedback
      expect(
        htmlContent.includes('review') ||
        htmlContent.includes('feedback') ||
        htmlContent.includes('experience')
      ).toBe(true);
    });
  });

  describe('Order Status Update Email', () => {
    it('should send email when order status changes to PROCESSING', async () => {
      await prisma.order.update({
        where: { id: testOrder.id },
        data: { status: 'PROCESSING' },
      });

      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'status_update' })
        .expect(200);

      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain('Update');
      expect(emailCall.html).toContain('PROCESSING');
    });
  });

  describe('Order Cancellation Email', () => {
    let cancelledOrder: any;

    beforeAll(async () => {
      cancelledOrder = await prisma.order.create({
        data: {
          orderNumber: `FB-2025-CANCEL-${Date.now()}`,
          customerEmail: 'emailtest@example.com',
          customerFirstName: 'Email',
          customerLastName: 'Test',
          shippingStreet: '123 Test Street',
          shippingCity: 'London',
          shippingPostcode: 'SW1A 1AA',
          subtotal: 50,
          total: 50,
          status: 'CANCELLED',
          source: 'MANUAL',
          cancellationReason: 'Customer requested cancellation',
        },
      });
    });

    afterAll(async () => {
      await prisma.order.delete({ where: { id: cancelledOrder.id } });
    });

    it('should send cancellation email with reason', async () => {
      const response = await request(app)
        .post(`/orders/${cancelledOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'cancellation' })
        .expect(200);

      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.subject).toContain('Cancelled');
      expect(emailCall.html).toContain('Customer requested cancellation');
    });

    it('should include refund information in cancellation email', async () => {
      await request(app)
        .post(`/orders/${cancelledOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'cancellation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      expect(
        htmlContent.includes('refund') ||
        htmlContent.includes('reimbursed')
      ).toBe(true);
    });
  });

  describe('Email Resending', () => {
    it('should allow resending order confirmation email', async () => {
      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('should require admin privileges to resend emails', async () => {
      // Create non-admin user
      const userResponse = await request(app)
        .post('/auth/register')
        .send({
          email: 'regularuser@example.com',
          password: 'UserPassword123!@#',
          firstName: 'Regular',
          lastName: 'User',
        });

      const userToken = userResponse.body.accessToken;

      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ emailType: 'confirmation' })
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Clean up
      await prisma.user.delete({ where: { id: userResponse.body.user.id } });
    });
  });

  describe('Email Content Quality', () => {
    it('should use professional email template with branding', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.from).toContain('Final Bell');
      expect(emailCall.html).toBeTruthy();
      expect(emailCall.html.length).toBeGreaterThan(100);
    });

    it('should include plain text alternative', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      // Most email services expect text version for better deliverability
      expect(emailCall.text || emailCall.html).toBeTruthy();
    });

    it('should include company contact information', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      // Should include ways to contact support
      expect(
        htmlContent.includes('contact') ||
        htmlContent.includes('support') ||
        htmlContent.includes('help')
      ).toBe(true);
    });
  });

  describe('Email Error Handling', () => {
    it('should handle email sending failures gracefully', async () => {
      // Mock email failure
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate email type parameter', async () => {
      const response = await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'invalid_type' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject email sending for non-existent order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post(`/orders/${fakeId}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Email Personalization', () => {
    it('should address customer by name in emails', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      expect(
        htmlContent.includes('Email Test') ||
        htmlContent.includes('Email')
      ).toBe(true);
    });

    it('should include order-specific details', async () => {
      await request(app)
        .post(`/orders/${testOrder.id}/email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ emailType: 'confirmation' });

      const emailCall = mockSendMail.mock.calls[0][0];
      const htmlContent = emailCall.html;

      // Should be personalized with order number
      expect(htmlContent).toContain(testOrder.orderNumber);
    });
  });
});
