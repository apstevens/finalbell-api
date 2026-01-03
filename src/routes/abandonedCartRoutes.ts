import { Router } from 'express';
import {
  saveAbandonedCart,
  getAbandonedCartsForCampaign,
  markEmailSent,
  getAbandonedCartStats,
  cleanupOldCarts,
} from '../controllers/abandonedCartController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /abandoned-cart
 * Save abandoned cart (Can be called by authenticated or guest users)
 */
router.post('/', saveAbandonedCart);

/**
 * GET /abandoned-cart/campaign
 * Get abandoned carts for email campaign (ADMIN ONLY)
 */
router.get('/campaign', authenticateToken, getAbandonedCartsForCampaign);

/**
 * POST /abandoned-cart/mark-sent
 * Mark recovery email as sent (ADMIN ONLY)
 */
router.post('/mark-sent', authenticateToken, markEmailSent);

/**
 * GET /abandoned-cart/stats
 * Get abandoned cart statistics (ADMIN ONLY)
 */
router.get('/stats', authenticateToken, getAbandonedCartStats);

/**
 * DELETE /abandoned-cart/cleanup
 * Delete old abandoned carts for GDPR compliance (ADMIN ONLY)
 */
router.delete('/cleanup', authenticateToken, cleanupOldCarts);

export default router;
