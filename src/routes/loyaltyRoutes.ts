import { Router } from 'express';
import {
  getLoyaltyPoints,
  redeemPoints,
  getLeaderboard,
} from '../controllers/loyaltyController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /loyalty
 * Get user's loyalty points and transaction history (AUTHENTICATED)
 */
router.get('/', authenticateToken, getLoyaltyPoints);

/**
 * POST /loyalty/redeem
 * Redeem loyalty points for discount (AUTHENTICATED)
 */
router.post('/redeem', authenticateToken, redeemPoints);

/**
 * GET /loyalty/leaderboard
 * Get anonymized leaderboard (PUBLIC)
 */
router.get('/leaderboard', getLeaderboard);

export default router;
