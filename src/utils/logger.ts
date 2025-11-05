/**
 * Simple Logger Utility
 * Provides consistent logging across the application
 *
 * For production, consider integrating:
 * - Winston (https://github.com/winstonjs/winston)
 * - Pino (https://github.com/pinojs/pino)
 * - External services: Sentry, LogRocket, DataDog
 */

import { env } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

class Logger {
    private getTimestamp(): string {
        return new Date().toISOString();
    }

    private formatMessage(level: LogLevel, message: string, meta?: any): string {
        const timestamp = this.getTimestamp();
        const metaString = meta ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
    }

    info(message: string, meta?: any) {
        console.log(this.formatMessage('info', message, meta));
    }

    success(message: string, meta?: any) {
        console.log(this.formatMessage('success', `✓ ${message}`, meta));
    }

    warn(message: string, meta?: any) {
        console.warn(this.formatMessage('warn', message, meta));
    }

    error(message: string, error?: Error | any, meta?: any) {
        const errorMeta = error instanceof Error
            ? {
                message: error.message,
                stack: env.NODE_ENV === 'development' ? error.stack : undefined,
                ...meta,
            }
            : { error, ...meta };

        console.error(this.formatMessage('error', message, errorMeta));
    }

    debug(message: string, meta?: any) {
        if (env.NODE_ENV === 'development') {
            console.debug(this.formatMessage('debug', message, meta));
        }
    }

    /**
     * Log HTTP request
     */
    http(method: string, path: string, statusCode: number, responseTime: number) {
        const message = `${method} ${path} ${statusCode} - ${responseTime}ms`;
        if (statusCode >= 500) {
            this.error(message);
        } else if (statusCode >= 400) {
            this.warn(message);
        } else {
            this.info(message);
        }
    }

    /**
     * Log database query (for debugging)
     */
    query(query: string, duration?: number) {
        if (env.NODE_ENV === 'development') {
            this.debug(`DB Query: ${query}`, { duration: duration ? `${duration}ms` : undefined });
        }
    }
}

export const logger = new Logger();

/**
 * Request Logger Middleware
 * Logs all HTTP requests
 */
export const requestLogger = (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Log when response finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.http(req.method, req.path, res.statusCode, duration);
    });

    next();
};
