import { Router } from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  clearWishlist,
} from '../controllers/wishlistController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All wishlist routes require authentication

/**
 * GET /wishlist
 * Get user's wishlist (AUTHENTICATED)
 */
router.get('/', authenticateToken, getWishlist);

/**
 * POST /wishlist
 * Add item to wishlist (AUTHENTICATED)
 */
router.post('/', authenticateToken, addToWishlist);

/**
 * DELETE /wishlist/:productSku
 * Remove item from wishlist (AUTHENTICATED)
 */
router.delete('/:productSku', authenticateToken, removeFromWishlist);

/**
 * GET /wishlist/check/:productSku
 * Check if product is in wishlist (AUTHENTICATED)
 */
router.get('/check/:productSku', authenticateToken, isInWishlist);

/**
 * DELETE /wishlist
 * Clear entire wishlist (AUTHENTICATED)
 */
router.delete('/', authenticateToken, clearWishlist);

export default router;
