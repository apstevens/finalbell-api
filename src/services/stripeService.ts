import Stripe from 'stripe';
import { env } from '../config/env';

if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29',
});

export interface CheckoutItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
    image: string;
}

export interface CreateCheckoutSessionParams {
    items: CheckoutItem[];
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
}

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
            unit_amount: Math.round(item.price * 100), // Convert to pence
        },
        quantity: item.quantity,
    }));

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        shipping_address_collection: {
            allowed_countries: ['GB'], // UK only
        },
        billing_address_collection: 'required',
        metadata: {
            source: 'final-bell-marketing',
        },
    });

    return session;
}

export async function handleWebhook(payload: string | Buffer, signature: string): Promise<Stripe.Event> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not defined');
    }

    try {
        const event = stripe.webhooks.constructEvent(
            payload,
            signature,
            env.STRIPE_WEBHOOK_SECRET
        );
        return event;
    } catch (err) {
        const error = err as Error;
        throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
}

export async function retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return await stripe.checkout.sessions.retrieve(sessionId);
}
