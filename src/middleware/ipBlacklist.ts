import { Request, Response, NextFunction } from 'express';
import { ipBlacklistService } from '../services/ipBlacklistService';
import { env } from '../config/env';

/**
 * Middleware to block requests from blacklisted IPs
 */
export const ipBlacklistMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Skip if blacklist is disabled
    if (!env.IP_BLACKLIST_ENABLED) {
        return next();
    }

    // Extract the client IP address
    // req.ip gives the IP, but might be ::ffff: prefixed for IPv4
    let clientIP = req.ip || req.socket.remoteAddress || '';

    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    if (clientIP.startsWith('::ffff:')) {
        clientIP = clientIP.substring(7);
    }

    // Handle localhost
    if (clientIP === '::1') {
        clientIP = '127.0.0.1';
    }

    // Check if IP is blacklisted
    if (ipBlacklistService.isBlacklisted(clientIP)) {
        console.warn(`Blocked request from blacklisted IP: ${clientIP}`);

        return res.status(403).json({
            error: 'Access denied',
            message: 'Your IP address has been blocked due to suspicious activity'
        });
    }

    // IP is not blacklisted, continue
    next();
};
