import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
});

// CSV sync rate limiter (prevent abuse)
export const csvSyncLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 syncs per hour max
    message: 'Too many CSV sync requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stripe checkout rate limiter
export const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 checkout attempts per 15 minutes
    message: 'Too many checkout requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
