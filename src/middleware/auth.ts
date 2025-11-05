import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import prisma from '../config/database';

// Extend Express Request type to include user
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to authenticate requests using JWT
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    // Verify token
    const payload = verifyAccessToken(token);

    // Get user from database to include role
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    // Attach user info to request
    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
