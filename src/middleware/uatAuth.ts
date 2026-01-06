import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Basic Authentication Middleware for UAT Environment
 *
 * This middleware protects the entire API during User Acceptance Testing (UAT)
 * by requiring HTTP Basic Authentication credentials.
 *
 * Usage:
 * - Set UAT_ENABLED=true to enable UAT mode
 * - Set UAT_USERNAME and UAT_PASSWORD in environment variables
 * - Users will be prompted for credentials when accessing the API
 *
 * To bypass: Set UAT_ENABLED=false in production
 */

export const uatAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip auth if UAT mode is not enabled
  if (!env.UAT_ENABLED) {
    return next();
  }

  // Skip auth for health check endpoint
  if (req.path === '/health') {
    return next();
  }

  // Get authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    // Send 401 with WWW-Authenticate header to prompt for credentials
    res.setHeader('WWW-Authenticate', 'Basic realm="UAT Environment - Please provide credentials"');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'UAT authentication required. Please provide valid credentials.',
    });
    return;
  }

  // Decode credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  // Validate credentials
  const validUsername = env.UAT_USERNAME;
  const validPassword = env.UAT_PASSWORD;

  if (username === validUsername && password === validPassword) {
    // Authentication successful
    console.log(`[UAT Auth] Successful authentication from ${req.ip}`);
    return next();
  }

  // Authentication failed
  console.warn(`[UAT Auth] Failed authentication attempt from ${req.ip}`);
  res.setHeader('WWW-Authenticate', 'Basic realm="UAT Environment - Please provide credentials"');
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid credentials provided.',
  });
};
