import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getAvailableUsers } from '../controllers/userController';

const router = Router();

/**
 * GET /users/available
 * Get available users to start conversations with
 * Requires authentication
 */
router.get('/available', authenticateToken, getAvailableUsers);

export default router;
