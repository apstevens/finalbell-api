import { Request, Response } from 'express';
import { PrismaClient, LoyaltyTier } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';

const prisma = new PrismaClient();

/**
 * Loyalty Points Controller
 * Manages customer loyalty program with tier benefits
 */

// Tier thresholds (lifetime points earned)
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 250, // £250 spent
  GOLD: 500, // £500 spent
  PLATINUM: 1000, // £1000 spent
};

// Points multipliers per tier
const TIER_MULTIPLIERS = {
  BRONZE: 1,
  SILVER: 1.25,
  GOLD: 1.5,
  PLATINUM: 2,
};

/**
 * Calculate tier based on lifetime points
 */
function calculateTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD) return 'GOLD';
  if (lifetimePoints >= TIER_THRESHOLDS.SILVER) return 'SILVER';
  return 'BRONZE';
}

/**
 * Get user's loyalty points and history (AUTHENTICATED)
 * Security: Users can only view their own loyalty data
 */
export async function getLoyaltyPoints(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const loyalty = await prisma.loyaltyPoints.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Last 50 transactions
        },
      },
    });

    if (!loyalty) {
      // Create loyalty account if it doesn't exist
      const newLoyalty = await prisma.loyaltyPoints.create({
        data: {
          userId,
          points: 0,
          lifetime: 0,
          tier: 'BRONZE',
        },
        include: {
          transactions: true,
        },
      });

      return res.json({
        success: true,
        data: {
          ...newLoyalty,
          tierBenefits: getTierBenefits('BRONZE'),
          nextTier: getNextTierInfo(0),
        },
      });
    }

    return res.json({
      success: true,
      data: {
        ...loyalty,
        tierBenefits: getTierBenefits(loyalty.tier),
        nextTier: getNextTierInfo(loyalty.lifetime),
      },
    });
  } catch (error) {
    console.error('Error fetching loyalty points:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch loyalty points',
    });
  }
}

/**
 * Award points for a purchase (INTERNAL - called from order controller)
 */
export async function awardPurchasePoints(
  userId: string,
  orderId: string,
  amount: number
): Promise<void> {
  try {
    // Get or create loyalty account
    let loyalty = await prisma.loyaltyPoints.findUnique({
      where: { userId },
    });

    if (!loyalty) {
      loyalty = await prisma.loyaltyPoints.create({
        data: {
          userId,
          points: 0,
          lifetime: 0,
          tier: 'BRONZE',
        },
      });
    }

    // Calculate points (1 point per £1 spent, multiplied by tier)
    const basePoints = Math.floor(amount);
    const multiplier = TIER_MULTIPLIERS[loyalty.tier];
    const pointsToAward = Math.floor(basePoints * multiplier);

    // Update loyalty points
    const updatedLoyalty = await prisma.loyaltyPoints.update({
      where: { userId },
      data: {
        points: { increment: pointsToAward },
        lifetime: { increment: pointsToAward },
      },
    });

    // Check if tier should be upgraded
    const newTier = calculateTier(updatedLoyalty.lifetime);
    if (newTier !== updatedLoyalty.tier) {
      await prisma.loyaltyPoints.update({
        where: { userId },
        data: { tier: newTier },
      });
    }

    // Record transaction
    await prisma.pointTransaction.create({
      data: {
        loyaltyId: loyalty.id,
        points: pointsToAward,
        type: 'PURCHASE',
        description: `Purchase - Order ${orderId}`,
        orderId,
      },
    });
  } catch (error) {
    console.error('Error awarding purchase points:', error);
    // Don't throw - we don't want to fail the order if loyalty points fail
  }
}

/**
 * Redeem loyalty points (AUTHENTICATED)
 * Security: Validates user ownership and sufficient balance
 */
export async function redeemPoints(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { points } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid points amount',
      });
    }

    // Minimum redemption: 100 points
    if (points < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum redemption is 100 points',
      });
    }

    // Points must be in multiples of 100
    if (points % 100 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Points must be redeemed in multiples of 100',
      });
    }

    const loyalty = await prisma.loyaltyPoints.findUnique({
      where: { userId },
    });

    if (!loyalty) {
      return res.status(404).json({
        success: false,
        message: 'Loyalty account not found',
      });
    }

    if (loyalty.points < points) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient points balance',
      });
    }

    // Deduct points
    await prisma.loyaltyPoints.update({
      where: { userId },
      data: {
        points: { decrement: points },
      },
    });

    // Record transaction
    await prisma.pointTransaction.create({
      data: {
        loyaltyId: loyalty.id,
        points: -points,
        type: 'REDEMPTION',
        description: `Redeemed ${points} points for £${points / 20} discount`,
      },
    });

    // Generate discount code (100 points = £5)
    const discountValue = points / 20;
    const couponCode = `LOYALTY${Date.now()}`;

    return res.json({
      success: true,
      message: 'Points redeemed successfully',
      data: {
        couponCode,
        discountValue,
        pointsRedeemed: points,
      },
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to redeem points',
    });
  }
}

/**
 * Get tier benefits information
 */
function getTierBenefits(tier: LoyaltyTier) {
  const benefits: Record<LoyaltyTier, string[]> = {
    BRONZE: ['1x points on purchases', 'Standard shipping'],
    SILVER: [
      '1.25x points on purchases',
      'Free standard shipping',
      'Birthday bonus: 200 points',
    ],
    GOLD: [
      '1.5x points on purchases',
      'Free standard shipping',
      'Early access to sales',
      'Birthday bonus: 400 points',
    ],
    PLATINUM: [
      '2x points on purchases',
      'Free express shipping',
      'Exclusive products access',
      'Priority customer support',
      'Birthday bonus: 600 points',
    ],
  };

  return {
    tier,
    multiplier: TIER_MULTIPLIERS[tier],
    benefits: benefits[tier],
  };
}

/**
 * Get next tier information
 */
function getNextTierInfo(currentLifetimePoints: number) {
  if (currentLifetimePoints >= TIER_THRESHOLDS.PLATINUM) {
    return {
      tier: 'PLATINUM',
      pointsNeeded: 0,
      message: 'You have reached the highest tier!',
    };
  }

  if (currentLifetimePoints >= TIER_THRESHOLDS.GOLD) {
    return {
      tier: 'PLATINUM',
      pointsNeeded: TIER_THRESHOLDS.PLATINUM - currentLifetimePoints,
      message: `${TIER_THRESHOLDS.PLATINUM - currentLifetimePoints} points until Platinum`,
    };
  }

  if (currentLifetimePoints >= TIER_THRESHOLDS.SILVER) {
    return {
      tier: 'GOLD',
      pointsNeeded: TIER_THRESHOLDS.GOLD - currentLifetimePoints,
      message: `${TIER_THRESHOLDS.GOLD - currentLifetimePoints} points until Gold`,
    };
  }

  return {
    tier: 'SILVER',
    pointsNeeded: TIER_THRESHOLDS.SILVER - currentLifetimePoints,
    message: `${TIER_THRESHOLDS.SILVER - currentLifetimePoints} points until Silver`,
  };
}

/**
 * Get loyalty leaderboard (PUBLIC - anonymized)
 * Shows top users without exposing personal data
 */
export async function getLeaderboard(req: Request, res: Response) {
  try {
    const topUsers = await prisma.loyaltyPoints.findMany({
      take: 10,
      orderBy: { lifetime: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            // DO NOT expose: email, id, lastName, etc.
          },
        },
      },
    });

    // Anonymize user data
    const leaderboard = topUsers.map((loyalty, index) => ({
      rank: index + 1,
      // Partially mask username
      username: loyalty.user.firstName.charAt(0) + '***',
      tier: loyalty.tier,
      lifetimePoints: loyalty.lifetime,
    }));

    return res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
    });
  }
}
