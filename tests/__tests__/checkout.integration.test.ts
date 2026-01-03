import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/server';
import Stripe from 'stripe';

const prisma = new PrismaClient();

// Mock Stripe
jest.mock('stripe');
const mockStripeCheckoutSessionCreate = jest.fn();
const mockStripeConstructWebhookEvent = jest.fn();

describe('Checkout Flow Integration Tests', () => {
  let testUser: any;
  let accessToken: string;

  const testUserData = {
    email: 'checkout@example.com',
    password: 'CheckoutPassword123!@#',
    firstName: 'Checkout',
    lastName: 'Test',
  };

  const mockCartItems = [
    {
      id: 1,
      name: 'Boxing Gloves - Twins Special',
      price: 89.99,
      quantity: 1,
      selectedSize: '12oz',
      sku: 'TWINS-BG-12OZ',
      weight: 600,
      image: 'https://example.com/gloves.jpg',
      category: 'gloves',
    },
    {
      id: 2,
      name: 'Hand Wraps - Fairtex',
      price: 14.99,
      quantity: 2,
      sku: 'FAIRTEX-HW',
      weight: 100,
      image: 'https://example.com/wraps.jpg',
      category: 'protection',
    },
  ];

  beforeAll(async () => {
    // Setup Stripe mock
    (Stripe as any).mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutSessionCreate,
        },
      },
      webhooks: {
        constructEvent: mockStripeConstructWebhookEvent,
      },
    }));

    // Clean up
    await prisma.order.deleteMany({
      where: { customerEmail: testUserData.email },
    });
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });

    // Create test user
    const response = await request(app)
      .post('/auth/register')
      .send(testUserData);

    testUser = response.body.user;
    accessToken = response.body.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await prisma.order.deleteMany({
      where: { customerEmail: testUserData.email },
    });
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    mockStripeCheckoutSessionCreate.mockClear();
    mockStripeConstructWebhookEvent.mockClear();
  });

  describe('POST /stripe/create-checkout-session', () => {
    it('should create Stripe checkout session with valid cart items', async () => {
      const mockSession = {
        id: 'cs_test_123456',
        url: 'https://checkout.stripe.com/pay/cs_test_123456',
        payment_status: 'unpaid',
        customer_email: testUserData.email,
      };

      mockStripeCheckoutSessionCreate.mockResolvedValue(mockSession);

      const response = await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: mockCartItems })
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toBe(mockSession.url);
      expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledTimes(1);

      // Verify Stripe session was created with correct data
      const sessionCall = mockStripeCheckoutSessionCreate.mock.calls[0][0];
      expect(sessionCall.mode).toBe('payment');
      expect(sessionCall.line_items).toBeDefined();
      expect(sessionCall.line_items.length).toBe(mockCartItems.length);
    });

    it('should convert prices to pence for Stripe', async () => {
      mockStripeCheckoutSessionCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: mockCartItems });

      const sessionCall = mockStripeCheckoutSessionCreate.mock.calls[0][0];
      const firstLineItem = sessionCall.line_items[0];

      // £89.99 should be converted to 8999 pence
      expect(firstLineItem.price_data.unit_amount).toBe(8999);
    });

    it('should include shipping in checkout session', async () => {
      mockStripeCheckoutSessionCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: mockCartItems });

      const sessionCall = mockStripeCheckoutSessionCreate.mock.calls[0][0];
      expect(sessionCall.shipping_address_collection).toBeDefined();
      expect(sessionCall.shipping_address_collection.allowed_countries).toContain('GB');
    });

    it('should include shipping options based on cart weight', async () => {
      mockStripeCheckoutSessionCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: mockCartItems });

      const sessionCall = mockStripeCheckoutSessionCreate.mock.calls[0][0];
      expect(sessionCall.shipping_options).toBeDefined();
      expect(sessionCall.shipping_options.length).toBeGreaterThan(0);
    });

    it('should reject checkout with empty cart', async () => {
      const response = await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: [] })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(mockStripeCheckoutSessionCreate).not.toHaveBeenCalled();
    });

    it('should reject checkout with invalid item data', async () => {
      const invalidItems = [
        {
          id: 1,
          name: 'Invalid Item',
          // Missing required fields: price, quantity, sku
        },
      ];

      const response = await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: invalidItems })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(mockStripeCheckoutSessionCreate).not.toHaveBeenCalled();
    });

    it('should reject checkout without authentication', async () => {
      const response = await request(app)
        .post('/stripe/create-checkout-session')
        .send({ items: mockCartItems })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle Stripe API errors gracefully', async () => {
      mockStripeCheckoutSessionCreate.mockRejectedValue(
        new Error('Stripe API Error: Invalid API Key')
      );

      const response = await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: mockCartItems })
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should apply free shipping for orders over threshold', async () => {
      const largeOrder = [
        {
          id: 1,
          name: 'Premium Boxing Gloves',
          price: 120.00,
          quantity: 1,
          sku: 'PREMIUM-BG',
          weight: 600,
          image: 'https://example.com/gloves.jpg',
          category: 'gloves',
        },
      ];

      mockStripeCheckoutSessionCreate.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });

      await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: largeOrder });

      const sessionCall = mockStripeCheckoutSessionCreate.mock.calls[0][0];
      // Check if free shipping option is included
      const hasFreeShipping = sessionCall.shipping_options?.some(
        (option: any) => option.shipping_rate_data?.fixed_amount?.amount === 0
      );
      expect(hasFreeShipping).toBe(true);
    });
  });

  describe('POST /stripe/webhook - Order Creation Flow', () => {
    it('should create order when checkout session is completed', async () => {
      const mockWebhookEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_webhook_123',
            customer_email: testUserData.email,
            payment_intent: 'pi_test_123',
            payment_status: 'paid',
            amount_total: 10997, // £109.97 in pence
            currency: 'gbp',
            shipping_details: {
              name: `${testUserData.firstName} ${testUserData.lastName}`,
              address: {
                line1: '123 Test Street',
                city: 'London',
                postal_code: 'SW1A 1AA',
                country: 'GB',
              },
              phone: '+44 7700 900000',
            },
            metadata: {
              items: JSON.stringify(mockCartItems),
              subtotal: '104.97',
              shippingCost: '4.99',
              tax: '0',
            },
          },
        },
      };

      mockStripeConstructWebhookEvent.mockReturnValue(mockWebhookEvent);

      const response = await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockWebhookEvent)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);

      // Verify order was created
      const order = await prisma.order.findFirst({
        where: {
          stripeSessionId: 'cs_test_webhook_123',
        },
        include: {
          items: true,
        },
      });

      expect(order).toBeDefined();
      expect(order?.customerEmail).toBe(testUserData.email);
      expect(order?.status).toBe('PENDING');
      expect(order?.total).toBe(109.97);
      expect(order?.items.length).toBe(2);

      // Clean up
      if (order) {
        await prisma.order.delete({ where: { id: order.id } });
      }
    });

    it('should store complete customer and shipping information', async () => {
      const mockWebhookEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_complete_info',
            customer_email: testUserData.email,
            payment_intent: 'pi_test_124',
            payment_status: 'paid',
            amount_total: 10997,
            currency: 'gbp',
            shipping_details: {
              name: `${testUserData.firstName} ${testUserData.lastName}`,
              address: {
                line1: '456 Martial Arts Road',
                line2: 'Apartment 7B',
                city: 'Manchester',
                state: 'Greater Manchester',
                postal_code: 'M1 1AA',
                country: 'GB',
              },
              phone: '+44 7700 900001',
            },
            metadata: {
              items: JSON.stringify(mockCartItems),
              subtotal: '104.97',
              shippingCost: '4.99',
              tax: '0',
            },
          },
        },
      };

      mockStripeConstructWebhookEvent.mockReturnValue(mockWebhookEvent);

      await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockWebhookEvent);

      const order = await prisma.order.findFirst({
        where: { stripeSessionId: 'cs_test_complete_info' },
      });

      expect(order).toBeDefined();
      expect(order?.shippingStreet).toContain('456 Martial Arts Road');
      expect(order?.shippingCity).toBe('Manchester');
      expect(order?.shippingPostcode).toBe('M1 1AA');
      expect(order?.customerPhone).toBe('+44 7700 900001');

      // Clean up
      if (order) {
        await prisma.order.delete({ where: { id: order.id } });
      }
    });

    it('should create order items with correct pricing', async () => {
      const mockWebhookEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_pricing',
            customer_email: testUserData.email,
            payment_intent: 'pi_test_125',
            payment_status: 'paid',
            amount_total: 10997,
            currency: 'gbp',
            shipping_details: {
              name: `${testUserData.firstName} ${testUserData.lastName}`,
              address: {
                line1: '123 Test Street',
                city: 'London',
                postal_code: 'SW1A 1AA',
                country: 'GB',
              },
            },
            metadata: {
              items: JSON.stringify(mockCartItems),
              subtotal: '104.97',
              shippingCost: '4.99',
              tax: '0',
            },
          },
        },
      };

      mockStripeConstructWebhookEvent.mockReturnValue(mockWebhookEvent);

      await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockWebhookEvent);

      const order = await prisma.order.findFirst({
        where: { stripeSessionId: 'cs_test_pricing' },
        include: { items: true },
      });

      expect(order?.items).toBeDefined();
      expect(order?.items.length).toBe(2);

      // Verify first item
      const gloves = order?.items.find(item => item.sku === 'TWINS-BG-12OZ');
      expect(gloves?.productName).toBe('Boxing Gloves - Twins Special');
      expect(gloves?.quantity).toBe(1);
      expect(gloves?.unitPrice).toBe(89.99);
      expect(gloves?.totalPrice).toBe(89.99);

      // Verify second item
      const wraps = order?.items.find(item => item.sku === 'FAIRTEX-HW');
      expect(wraps?.quantity).toBe(2);
      expect(wraps?.unitPrice).toBe(14.99);
      expect(wraps?.totalPrice).toBe(29.98);

      // Clean up
      if (order) {
        await prisma.order.delete({ where: { id: order.id } });
      }
    });

    it('should handle webhook signature verification', async () => {
      mockStripeConstructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'invalid-signature')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle duplicate webhook events (idempotency)', async () => {
      const mockWebhookEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_duplicate',
            customer_email: testUserData.email,
            payment_intent: 'pi_test_126',
            payment_status: 'paid',
            amount_total: 10997,
            currency: 'gbp',
            shipping_details: {
              name: `${testUserData.firstName} ${testUserData.lastName}`,
              address: {
                line1: '123 Test Street',
                city: 'London',
                postal_code: 'SW1A 1AA',
                country: 'GB',
              },
            },
            metadata: {
              items: JSON.stringify(mockCartItems),
              subtotal: '104.97',
              shippingCost: '4.99',
              tax: '0',
            },
          },
        },
      };

      mockStripeConstructWebhookEvent.mockReturnValue(mockWebhookEvent);

      // Send webhook twice
      await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockWebhookEvent)
        .expect(200);

      await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockWebhookEvent)
        .expect(200);

      // Verify only one order was created
      const orders = await prisma.order.findMany({
        where: { stripeSessionId: 'cs_test_duplicate' },
      });

      expect(orders.length).toBe(1);

      // Clean up
      await prisma.order.delete({ where: { id: orders[0].id } });
    });

    it('should ignore non-checkout webhook events', async () => {
      const mockWebhookEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_127',
          },
        },
      };

      mockStripeConstructWebhookEvent.mockReturnValue(mockWebhookEvent);

      const response = await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockWebhookEvent)
        .expect(200);

      expect(response.body).toHaveProperty('received', true);

      // Verify no order was created
      const order = await prisma.order.findFirst({
        where: { stripePaymentIntentId: 'pi_test_127' },
      });

      expect(order).toBeNull();
    });
  });

  describe('End-to-End Checkout Flow', () => {
    it('should complete full checkout flow from cart to order', async () => {
      // Step 1: Create checkout session
      const mockSession = {
        id: 'cs_test_e2e',
        url: 'https://checkout.stripe.com/pay/cs_test_e2e',
        payment_status: 'unpaid',
      };

      mockStripeCheckoutSessionCreate.mockResolvedValue(mockSession);

      const checkoutResponse = await request(app)
        .post('/stripe/create-checkout-session')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ items: mockCartItems });

      expect(checkoutResponse.body.url).toBeDefined();

      // Step 2: Simulate Stripe webhook after payment
      const mockWebhookEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_e2e',
            customer_email: testUserData.email,
            payment_intent: 'pi_test_e2e',
            payment_status: 'paid',
            amount_total: 10997,
            currency: 'gbp',
            shipping_details: {
              name: `${testUserData.firstName} ${testUserData.lastName}`,
              address: {
                line1: '123 Test Street',
                city: 'London',
                postal_code: 'SW1A 1AA',
                country: 'GB',
              },
            },
            metadata: {
              items: JSON.stringify(mockCartItems),
              subtotal: '104.97',
              shippingCost: '4.99',
              tax: '0',
            },
          },
        },
      };

      mockStripeConstructWebhookEvent.mockReturnValue(mockWebhookEvent);

      await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'test-signature')
        .send(mockWebhookEvent);

      // Step 3: Verify order exists and is accessible
      const order = await prisma.order.findFirst({
        where: { stripeSessionId: 'cs_test_e2e' },
        include: { items: true },
      });

      expect(order).toBeDefined();
      expect(order?.customerEmail).toBe(testUserData.email);
      expect(order?.status).toBe('PENDING');
      expect(order?.items.length).toBe(2);

      // Step 4: Customer should be able to view their order
      const orderResponse = await request(app)
        .get(`/orders/${order?.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(orderResponse.body.id).toBe(order?.id);
      expect(orderResponse.body.orderNumber).toBeDefined();

      // Clean up
      if (order) {
        await prisma.order.delete({ where: { id: order.id } });
      }
    });
  });
});
