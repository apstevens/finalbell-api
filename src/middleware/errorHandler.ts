import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate responses
 */
export const errorHandler = (
    err: AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Log error details
    console.error('[Error Handler]', {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        statusCode,
        message: err.message,
        stack: env.NODE_ENV === 'development' ? err.stack : undefined,
        body: env.NODE_ENV === 'development' ? req.body : undefined,
    });

    // Send error response
    res.status(statusCode).json({
        error: {
            message,
            statusCode,
            timestamp: new Date().toISOString(),
            path: req.path,
            // Only include stack trace in development
            ...(env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    });
};

/**
 * 404 Not Found Handler
 * Handles requests to routes that don't exist
 */
export const notFoundHandler = (req: Request, res: Response) => {
    console.warn('[404 Not Found]', {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip,
    });

    res.status(404).json({
        error: {
            message: 'Route not found',
            statusCode: 404,
            path: req.path,
            timestamp: new Date().toISOString(),
        },
    });
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 */
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Create Operational Error
 * Creates errors that are expected and safe to show to users
 */
export const createError = (message: string, statusCode: number = 500): AppError => {
    const error: AppError = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
};
