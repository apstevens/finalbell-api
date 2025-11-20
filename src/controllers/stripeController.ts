import { Request, Response } from 'express';
import Stripe from 'stripe';
import { createCheckoutSession, handleWebhook, retrieveSession } from '../services/stripeService';
import { env } from '../config/env';
import orderService from '../services/orderService';
import emailService from '../services/emailService';
import { OrderSource } from '@prisma/client';

export const createCheckout = async (req: Request, res: Response) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: 'Invalid request: items array is required',
            });
        }

        // Validate items
        for (const item of items) {
            if (!item.id || !item.name || !item.price || !item.quantity) {
                return res.status(400).json({
                    error: 'Invalid item format: id, name, price, and quantity are required',
                });
            }
        }

        const successUrl = `${env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${env.CLIENT_URL}/cancel`;

        const session = await createCheckoutSession({
            items,
            successUrl,
            cancelUrl,
        });

        res.json({ sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({
            error: 'Failed to create checkout session',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const handleStripeWebhook = async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
        const event = await handleWebhook(req.body, signature);

        // Handle different event types
        switch (event.type) {
            case 'checkout.session.completed':
                const session = event.data.object as Stripe.Checkout.Session;
                console.log('[Stripe Webhook] Checkout session completed:', session.id);

                try {
                    // Check if order already exists
                    const existingOrder = await orderService.getOrderByStripeSession(session.id);
                    if (existingOrder) {
                        console.log('[Stripe Webhook] Order already exists:', existingOrder.orderNumber);
                        break;
                    }

                    // Get full session details with line items
                    const fullSession = await retrieveSession(session.id);

                    if (!fullSession.line_items?.data || fullSession.line_items.data.length === 0) {
                        console.error('[Stripe Webhook] No line items found in session:', session.id);
                        break;
                    }

                    // Extract customer details
                    const customerDetails = fullSession.customer_details;
                    const shippingDetails = (fullSession as any).shipping_details;

                    if (!customerDetails || !shippingDetails) {
                        console.error('[Stripe Webhook] Missing customer or shipping details:', session.id);
                        break;
                    }

                    // Calculate totals
                    const subtotal = (fullSession.amount_subtotal || 0) / 100;
                    const shippingCost = (fullSession.total_details?.amount_shipping || 0) / 100;
                    const tax = (fullSession.total_details?.amount_tax || 0) / 100;
                    const total = (fullSession.amount_total || 0) / 100;

                    // Prepare order items
                    const orderItems = fullSession.line_items.data.map((item: Stripe.LineItem) => ({
                        productId: item.price?.product as string || '',
                        productName: item.description || '',
                        variantName: item.price?.nickname || undefined,
                        sku: item.price?.metadata?.sku || item.price?.product as string || '',
                        quantity: item.quantity || 1,
                        unitPrice: (item.price?.unit_amount || 0) / 100,
                        totalPrice: (item.amount_total || 0) / 100,
                        weight: item.price?.metadata?.weight ? parseFloat(item.price.metadata.weight) : undefined,
                        imageUrl: undefined,
                    }));

                    // Create order in database
                    const order = await orderService.createOrder({
                        customerEmail: customerDetails.email || '',
                        customerFirstName: customerDetails.name?.split(' ')[0] || '',
                        customerLastName: customerDetails.name?.split(' ').slice(1).join(' ') || '',
                        customerPhone: customerDetails.phone || undefined,
                        shippingStreet: `${shippingDetails.address?.line1 || ''} ${shippingDetails.address?.line2 || ''}`.trim(),
                        shippingCity: shippingDetails.address?.city || '',
                        shippingPostcode: shippingDetails.address?.postal_code || '',
                        shippingCountry: shippingDetails.address?.country || 'GB',
                        source: OrderSource.STRIPE,
                        subtotal,
                        shippingCost,
                        tax,
                        total,
                        currency: fullSession.currency?.toUpperCase() || 'GBP',
                        stripeSessionId: session.id,
                        stripePaymentIntentId: fullSession.payment_intent as string,
                        paidAt: new Date(),
                        items: orderItems,
                    });

                    console.log('[Stripe Webhook] Order created successfully:', order.orderNumber);

                    // Send confirmation email to customer
                    emailService.sendOrderConfirmation(order).catch(err => {
                        console.error('[Stripe Webhook] Failed to send confirmation email:', err);
                    });

                    // Send admin notification
                    emailService.sendAdminNewOrderNotification(order).catch(err => {
                        console.error('[Stripe Webhook] Failed to send admin notification:', err);
                    });

                } catch (orderError) {
                    console.error('[Stripe Webhook] Error creating order:', orderError);
                    // Don't fail the webhook - log error for manual review
                }

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

export const getSessionDetails = async (req: Request, res: Response) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const session = await retrieveSession(sessionId);

        res.json({
            id: session.id,
            status: session.status,
            customer_email: session.customer_email,
            amount_total: session.amount_total,
            currency: session.currency,
            payment_status: session.payment_status,
        });
    } catch (error) {
        console.error('Error retrieving session:', error);
        res.status(500).json({
            error: 'Failed to retrieve session',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
