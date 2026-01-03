import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * Abandoned Cart Controller
 * Tracks abandoned carts for recovery campaigns
 * Security: Only stores necessary data, respects user privacy
 */

/**
 * Save abandoned cart (Can be called by authenticated or guest users)
 * Security: Only stores cart data and email, no sensitive personal info
 */
export async function saveAbandonedCart(req: Request | AuthenticatedRequest, res: Response) {
  try {
    const { email, cartItems, total } = req.body;
    const userId = (req as AuthenticatedRequest).user?.userId || null;

    // Validation
    if (!email || !cartItems || !total) {
      return res.status(400).json({
        success: false,
        message: 'Email, cart items, and total are required',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
      });
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart must contain at least one item',
      });
    }

    if (typeof total !== 'number' || total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart total',
      });
    }

    // Check for existing abandoned cart
    const existingCart = await prisma.abandonedCart.findFirst({
      where: {
        email,
        recovered: false,
        abandonedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Within last 7 days
        },
      },
      orderBy: {
        abandonedAt: 'desc',
      },
    });

    if (existingCart) {
      // Update existing cart
      const updatedCart = await prisma.abandonedCart.update({
        where: { id: existingCart.id },
        data: {
          cartItems,
          total,
          abandonedAt: new Date(),
          emailSentAt: null, // Reset email sent status
        },
      });

      return res.json({
        success: true,
        message: 'Cart updated',
        data: { id: updatedCart.id },
      });
    }

    // Create new abandoned cart
    const abandonedCart = await prisma.abandonedCart.create({
      data: {
        userId,
        email,
        cartItems,
        total,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Cart saved',
      data: { id: abandonedCart.id },
    });
  } catch (error) {
    console.error('Error saving abandoned cart:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save cart',
    });
  }
}

/**
 * Mark cart as recovered (INTERNAL - called when user completes purchase)
 */
export async function markCartRecovered(email: string): Promise<void> {
  try {
    await prisma.abandonedCart.updateMany({
      where: {
        email,
        recovered: false,
      },
      data: {
        recovered: true,
        recoveredAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error marking cart as recovered:', error);
    // Don't throw - this is a background operation
  }
}

/**
 * Get abandoned carts for email campaign (ADMIN ONLY)
 * Security: Only admins can access this data for marketing purposes
 */
export async function getAbandonedCartsForCampaign(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    // Check admin authorization
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const {
      hoursAbandoned = '1',
      limit = '50',
      emailSent = 'false',
    } = req.query;

    const hoursAgo = new Date(
      Date.now() - parseInt(hoursAbandoned as string) * 60 * 60 * 1000
    );

    const carts = await prisma.abandonedCart.findMany({
      where: {
        abandonedAt: {
          lte: hoursAgo,
        },
        recovered: false,
        ...(emailSent === 'false' && { emailSentAt: null }),
      },
      take: parseInt(limit as string),
      orderBy: {
        abandonedAt: 'asc',
      },
    });

    // Return only necessary data for email campaign
    const campaignData = carts.map((cart) => ({
      id: cart.id,
      email: cart.email,
      total: cart.total,
      abandonedAt: cart.abandonedAt,
      cartItems: cart.cartItems,
    }));

    return res.json({
      success: true,
      data: campaignData,
    });
  } catch (error) {
    console.error('Error fetching abandoned carts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch abandoned carts',
    });
  }
}

/**
 * Mark email as sent (ADMIN ONLY - called after sending recovery email)
 */
export async function markEmailSent(req: AuthenticatedRequest, res: Response) {
  try {
    // Check admin authorization
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { cartId, couponCode } = req.body;

    if (!cartId) {
      return res.status(400).json({
        success: false,
        message: 'Cart ID is required',
      });
    }

    await prisma.abandonedCart.update({
      where: { id: cartId },
      data: {
        emailSentAt: new Date(),
        ...(couponCode && { couponCode }),
      },
    });

    return res.json({
      success: true,
      message: 'Email status updated',
    });
  } catch (error) {
    console.error('Error marking email as sent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update email status',
    });
  }
}

/**
 * Get abandoned cart statistics (ADMIN ONLY)
 */
export async function getAbandonedCartStats(req: AuthenticatedRequest, res: Response) {
  try {
    // Check admin authorization
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { days = '30' } = req.query;
    const daysAgo = new Date(
      Date.now() - parseInt(days as string) * 24 * 60 * 60 * 1000
    );

    // Total abandoned carts
    const totalAbandoned = await prisma.abandonedCart.count({
      where: {
        abandonedAt: { gte: daysAgo },
      },
    });

    // Recovered carts
    const totalRecovered = await prisma.abandonedCart.count({
      where: {
        abandonedAt: { gte: daysAgo },
        recovered: true,
      },
    });

    // Total revenue from recovered carts
    const recoveredCarts = await prisma.abandonedCart.findMany({
      where: {
        abandonedAt: { gte: daysAgo },
        recovered: true,
      },
      select: {
        total: true,
      },
    });

    const recoveredRevenue = recoveredCarts.reduce(
      (sum, cart) => sum + cart.total,
      0
    );

    // Potential revenue from unrecovered carts
    const unrecoveredCarts = await prisma.abandonedCart.findMany({
      where: {
        abandonedAt: { gte: daysAgo },
        recovered: false,
      },
      select: {
        total: true,
      },
    });

    const potentialRevenue = unrecoveredCarts.reduce(
      (sum, cart) => sum + cart.total,
      0
    );

    // Recovery rate
    const recoveryRate =
      totalAbandoned > 0 ? (totalRecovered / totalAbandoned) * 100 : 0;

    return res.json({
      success: true,
      data: {
        period: `Last ${days} days`,
        totalAbandoned,
        totalRecovered,
        recoveryRate: recoveryRate.toFixed(2) + '%',
        recoveredRevenue: recoveredRevenue.toFixed(2),
        potentialRevenue: potentialRevenue.toFixed(2),
      },
    });
  } catch (error) {
    console.error('Error fetching abandoned cart stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
    });
  }
}

/**
 * Delete old abandoned carts (ADMIN ONLY - for GDPR compliance)
 * Removes carts older than 90 days
 */
export async function cleanupOldCarts(req: AuthenticatedRequest, res: Response) {
  try {
    // Check admin authorization
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const { daysOld = '90' } = req.query;
    const cutoffDate = new Date(
      Date.now() - parseInt(daysOld as string) * 24 * 60 * 60 * 1000
    );

    const result = await prisma.abandonedCart.deleteMany({
      where: {
        abandonedAt: {
          lt: cutoffDate,
        },
      },
    });

    return res.json({
      success: true,
      message: `Deleted ${result.count} old abandoned carts`,
      data: {
        deletedCount: result.count,
        olderThan: `${daysOld} days`,
      },
    });
  } catch (error) {
    console.error('Error cleaning up old carts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cleanup old carts',
    });
  }
}
