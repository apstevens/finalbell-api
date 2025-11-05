import express from 'express';
import { createCheckout, handleStripeWebhook, getSessionDetails } from '../controllers/stripeController';
import { checkoutLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Create checkout session
router.post('/create-checkout-session', checkoutLimiter, createCheckout);

// Stripe webhook (raw body handled in server.ts)
router.post('/webhook', handleStripeWebhook);

// Get session details
router.get('/session/:sessionId', getSessionDetails);

export default router;
