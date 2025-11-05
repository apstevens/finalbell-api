/**
 * Admin Authentication Middleware
 * Ensures only admin users can access admin endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Middleware to verify admin access
 */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.token;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if user is admin
    if (decoded.role !== 'ADMIN' && decoded.role !== 'SUPER_ADMIN') {
      res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
      return;
    }

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error('[Admin Auth] Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

/**
 * Alternative: API key authentication for cron jobs
 */
export const requireAPIKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
    res.status(401).json({
      success: false,
      message: 'Invalid API key',
    });
    return;
  }

  next();
};
