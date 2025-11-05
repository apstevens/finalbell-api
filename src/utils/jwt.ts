import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
}

/**
 * Generate an access token (short-lived)
 */
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
};

/**
 * Generate a refresh token (long-lived)
 */
export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as any,
  });
};

/**
 * Verify an access token
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

/**
 * Verify a refresh token
 */
export const verifyRefreshToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};
