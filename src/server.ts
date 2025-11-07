import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { connectDatabase, disconnectDatabase, checkDatabaseHealth } from './config/database';
import { env, validateEnv } from './config/env';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import clientTrainerRoutes from './routes/clientTrainerRoutes';
import adminRoutes from './routes/adminRoutes';
import stripeRoutes from './routes/stripeRoutes';
import { schedulerService } from './services/schedulerService';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './utils/logger';

const app = express();

// Request logging
app.use(requestLogger);

// Stripe webhook needs raw body, so register it before express.json()
app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

// Middleware
app.use(helmet({
    contentSecurityPolicy: { 
        directives: { 
            defaultSrc: ["'self'"], 
            styleSrc: ["'self'", "'unsafe-inline'", "https://googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", 'data:', "https:"],
            scriptSrc: ["'self'", "https://js.stripe.com"],
            frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
            connectSrc: ["'self'", "https://api.stripe.com"]
            },
        },
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },
        frameguard: {
            action: 'deny', // Prevent clickjacking
        },
        noSniff: true, // Prevent MIME type sniffing
        xssFilter: true, // Enable XSS filter
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// SECURITY: Permissions Policy restricts browser features
// Set as custom middleware since older helmet versions don't support it directly
app.use((_req, res, next) => {
    res.setHeader(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );
    next();
});

app.use(cors({
    origin: env.ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '10mb' })); // Size limit for JSON bodies
app.use(cookieParser());

// Apply rate limiting to all routes
app.use(apiLimiter);

// Health check endpoint
app.get('/health', async (_req, res) => {
    const dbHealthy = await checkDatabaseHealth();
    res.status(dbHealthy ? 200 : 503).json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected',
    });
});

// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        message: 'Final Bell API is running.',
        version: '1.0.0',
        environment: env.NODE_ENV,
    });
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/client-trainer', clientTrainerRoutes);
app.use('/admin', adminRoutes);
app.use('/stripe', stripeRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handler - must be last
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async () => {
    console.log('\nShutting down gracefully...');
    schedulerService.stop();
    await disconnectDatabase();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const startServer = async () => {
    try {
        // Validate environment variables
        validateEnv();

        // Connect to database
        await connectDatabase();

        // Start scheduler for CSV sync
        schedulerService.start();

        // Start listening
        const PORT = env.PORT;
        app.listen(PORT, () => {
            console.log(`✓ Server running on port ${PORT}`);
            console.log(`✓ Environment: ${env.NODE_ENV}`);
            console.log(`✓ Health check: http://localhost:${PORT}/health`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
