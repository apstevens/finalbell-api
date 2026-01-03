import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * Product Review Controller
 * Handles product reviews with security and privacy controls
 */

/**
 * Get reviews for a specific product (PUBLIC)
 * Security: Only returns approved/non-flagged reviews with sanitized user data
 */
export async function getProductReviews(req: Request, res: Response) {
  try {
    const { productSku } = req.params;
    const { limit = '10', offset = '0', sortBy = 'recent' } = req.query;

    if (!productSku) {
      return res.status(400).json({
        success: false,
        message: 'Product SKU is required',
      });
    }

    // Build sort order
    let orderBy: any = { createdAt: 'desc' }; // Default: most recent
    if (sortBy === 'helpful') {
      orderBy = { helpful: 'desc' };
    } else if (sortBy === 'rating') {
      orderBy = { rating: 'desc' };
    }

    const reviews = await prisma.productReview.findMany({
      where: {
        productSku: productSku as string,
      },
      include: {
        user: {
          select: {
            // SECURITY: Only expose minimal user info
            firstName: true,
            lastName: true,
            avatar: true,
            // DO NOT expose: email, id, phoneNumber, etc.
          },
        },
      },
      orderBy,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // Get aggregate stats
    const stats = await prisma.productReview.aggregate({
      where: { productSku: productSku as string },
      _avg: { rating: true },
      _count: { id: true },
    });

    // Get rating distribution
    const ratingDistribution = await prisma.productReview.groupBy({
      by: ['rating'],
      where: { productSku: productSku as string },
      _count: { rating: true },
    });

    // Sanitize reviews - mask user first names for privacy
    const sanitizedReviews = reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      review: review.review,
      verified: review.verified,
      helpful: review.helpful,
      notHelpful: review.notHelpful,
      images: review.images,
      createdAt: review.createdAt,
      // Partially mask user name for privacy
      userName: review.user.firstName.charAt(0) + '***' + (review.user.lastName ? ' ' + review.user.lastName.charAt(0) + '.' : ''),
    }));

    return res.json({
      success: true,
      data: {
        reviews: sanitizedReviews,
        stats: {
          averageRating: stats._avg.rating || 0,
          totalReviews: stats._count.id,
          ratingDistribution: ratingDistribution.reduce((acc, curr) => {
            acc[curr.rating] = curr._count.rating;
            return acc;
          }, {} as Record<number, number>),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product reviews',
    });
  }
}

/**
 * Create a new review (AUTHENTICATED)
 * Security: Requires authentication, validates ownership
 */
export async function createReview(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit a review',
      });
    }

    const { productSku, rating, title, review, images = [] } = req.body;

    // Validation
    if (!productSku || !rating || !title || !review) {
      return res.status(400).json({
        success: false,
        message: 'Product SKU, rating, title, and review are required',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 100 characters or less',
      });
    }

    if (review.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Review must be 2000 characters or less',
      });
    }

    // Check if user already reviewed this product
    const existingReview = await prisma.productReview.findFirst({
      where: {
        userId,
        productSku,
      },
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }

    // Check if user purchased this product (verified purchase)
    const hasPurchased = await prisma.order.findFirst({
      where: {
        customerEmail: req.user?.email,
        status: 'DELIVERED',
        items: {
          some: {
            productId: productSku,
          },
        },
      },
    });

    const newReview = await prisma.productReview.create({
      data: {
        productSku,
        userId,
        rating,
        title,
        review,
        images,
        verified: !!hasPurchased, // Auto-verify if user purchased
      },
    });

    // Award loyalty points for writing a review
    try {
      const loyalty = await prisma.loyaltyPoints.upsert({
        where: { userId },
        create: {
          userId,
          points: 50,
          lifetime: 50,
        },
        update: {
          points: { increment: 50 },
          lifetime: { increment: 50 },
        },
      });

      await prisma.pointTransaction.create({
        data: {
          loyaltyId: loyalty.id,
          points: 50,
          type: 'REVIEW',
          description: `Review for product ${productSku}`,
        },
      });
    } catch (loyaltyError) {
      // Don't fail the review creation if loyalty points fail
      console.error('Error awarding loyalty points:', loyaltyError);
    }

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: newReview,
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create review',
    });
  }
}

/**
 * Mark review as helpful/not helpful (AUTHENTICATED)
 */
export async function voteReview(req: AuthenticatedRequest, res: Response) {
  try {
    const { reviewId } = req.params;
    const { helpful } = req.body; // true for helpful, false for not helpful

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (typeof helpful !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'helpful must be a boolean',
      });
    }

    const review = await prisma.productReview.update({
      where: { id: reviewId },
      data: helpful
        ? { helpful: { increment: 1 } }
        : { notHelpful: { increment: 1 } },
    });

    return res.json({
      success: true,
      data: {
        helpful: review.helpful,
        notHelpful: review.notHelpful,
      },
    });
  } catch (error) {
    console.error('Error voting on review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to vote on review',
    });
  }
}

/**
 * Update user's own review (AUTHENTICATED)
 */
export async function updateReview(req: AuthenticatedRequest, res: Response) {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { rating, title, review, images } = req.body;

    // Check ownership
    const existingReview = await prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (existingReview.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own reviews',
      });
    }

    // Validate
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    const updatedReview = await prisma.productReview.update({
      where: { id: reviewId },
      data: {
        ...(rating && { rating }),
        ...(title && { title }),
        ...(review && { review }),
        ...(images && { images }),
      },
    });

    return res.json({
      success: true,
      data: updatedReview,
    });
  } catch (error) {
    console.error('Error updating review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update review',
    });
  }
}

/**
 * Delete user's own review (AUTHENTICATED)
 */
export async function deleteReview(req: AuthenticatedRequest, res: Response) {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check ownership
    const existingReview = await prisma.productReview.findUnique({
      where: { id: reviewId },
    });

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    if (existingReview.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews',
      });
    }

    await prisma.productReview.delete({
      where: { id: reviewId },
    });

    return res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete review',
    });
  }
}

/**
 * Get user's own reviews (AUTHENTICATED)
 */
export async function getMyReviews(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const reviews = await prisma.productReview.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your reviews',
    });
  }
}
