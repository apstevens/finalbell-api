import { Request, Response } from 'express';
import { createCheckoutSession, handleWebhook, retrieveSession } from '../services/stripeService';
import { env } from '../config/env';

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
                const session = event.data.object;
                console.log('[Stripe Webhook] Checkout session completed:', session.id);

                // TODO: Implement order fulfillment logic
                // - Save order to database
                // - Send confirmation email
                // - Update inventory

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
