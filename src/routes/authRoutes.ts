import { Router } from 'express';
import { register, login, logout, refresh } from '../controllers/authController';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * POST /auth/register
 * Register a new user
 */
router.post('/register', authLimiter, register);

/**
 * POST /auth/login
 * Login a user
 */
router.post('/login', authLimiter, login);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token from HTTP-only cookie
 */
router.post('/refresh', authLimiter, refresh);

/**
 * POST /auth/logout
 * Logout a user
 */
router.post('/logout', logout);

export default router;
