import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * Wishlist Controller
 * Handles user wishlists with authentication and privacy controls
 */

/**
 * Get user's wishlist (AUTHENTICATED)
 * Security: Users can only view their own wishlist
 */
export async function getWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const wishlistItems = await prisma.wishlist.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
    });

    // Return only product SKUs - frontend will fetch product details
    // This prevents leaking product data that might be removed/updated
    return res.json({
      success: true,
      data: wishlistItems.map((item) => ({
        id: item.id,
        productSku: item.productSku,
        addedAt: item.addedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch wishlist',
    });
  }
}

/**
 * Add item to wishlist (AUTHENTICATED)
 */
export async function addToWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { productSku } = req.body;

    if (!productSku) {
      return res.status(400).json({
        success: false,
        message: 'Product SKU is required',
      });
    }

    // Check if already in wishlist
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productSku: {
          userId,
          productSku,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist',
      });
    }

    const wishlistItem = await prisma.wishlist.create({
      data: {
        userId,
        productSku,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Added to wishlist',
      data: wishlistItem,
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add to wishlist',
    });
  }
}

/**
 * Remove item from wishlist (AUTHENTICATED)
 */
export async function removeFromWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { productSku } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!productSku) {
      return res.status(400).json({
        success: false,
        message: 'Product SKU is required',
      });
    }

    // Verify ownership before deleting
    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        userId_productSku: {
          userId,
          productSku,
        },
      },
    });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in wishlist',
      });
    }

    await prisma.wishlist.delete({
      where: {
        id: wishlistItem.id,
      },
    });

    return res.json({
      success: true,
      message: 'Removed from wishlist',
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove from wishlist',
    });
  }
}

/**
 * Check if product is in wishlist (AUTHENTICATED)
 */
export async function isInWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { productSku } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        userId_productSku: {
          userId,
          productSku,
        },
      },
    });

    return res.json({
      success: true,
      data: {
        inWishlist: !!wishlistItem,
      },
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check wishlist',
    });
  }
}

/**
 * Clear entire wishlist (AUTHENTICATED)
 */
export async function clearWishlist(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    await prisma.wishlist.deleteMany({
      where: { userId },
    });

    return res.json({
      success: true,
      message: 'Wishlist cleared',
    });
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear wishlist',
    });
  }
}
