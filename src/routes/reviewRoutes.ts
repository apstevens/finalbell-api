import { Router } from 'express';
import {
  getProductReviews,
  createReview,
  voteReview,
  updateReview,
  deleteReview,
  getMyReviews,
} from '../controllers/reviewController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /reviews/product/:productSku
 * Get all reviews for a specific product (PUBLIC)
 */
router.get('/product/:productSku', getProductReviews);

/**
 * POST /reviews
 * Create a new review (AUTHENTICATED)
 */
router.post('/', authenticateToken, createReview);

/**
 * POST /reviews/:reviewId/vote
 * Vote on a review as helpful/not helpful (AUTHENTICATED)
 */
router.post('/:reviewId/vote', authenticateToken, voteReview);

/**
 * PUT /reviews/:reviewId
 * Update user's own review (AUTHENTICATED)
 */
router.put('/:reviewId', authenticateToken, updateReview);

/**
 * DELETE /reviews/:reviewId
 * Delete user's own review (AUTHENTICATED)
 */
router.delete('/:reviewId', authenticateToken, deleteReview);

/**
 * GET /reviews/my-reviews
 * Get current user's reviews (AUTHENTICATED)
 */
router.get('/my-reviews', authenticateToken, getMyReviews);

export default router;
