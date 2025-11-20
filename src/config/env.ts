import { config } from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
// Priority: NODE_ENV → .env.{NODE_ENV} → .env
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
const envPath = path.resolve(process.cwd(), envFile);

config({ path: envPath });

console.log(`Loading environment from: ${envFile}`);

/**
 * Environment Variables Configuration
 *
 * This file validates and exports all environment variables
 * used throughout the application
 */

interface EnvConfig {
  // Server
  NODE_ENV: string;
  PORT: number;

  // Database
  DATABASE_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_SECRET: string;
  REFRESH_TOKEN_EXPIRES_IN: string;

  // CORS
  ALLOWED_ORIGINS: string[];

  // File Upload
  MAX_FILE_SIZE: number;
  UPLOAD_DIR: string;

  // AWS S3 (Optional)
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  AWS_S3_BUCKET?: string;

  // Cloudinary (Optional)
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;

  // Email
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM?: string;
  ADMIN_EMAIL?: string;

  // Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // Client
  CLIENT_URL: string;

  // Muaythai-Boxing.com CSV
  MTB_CSV_URL?: string;

  // Admin
  ADMIN_API_KEY?: string;

  // IP Blacklist
  IP_BLACKLIST_ENABLED: boolean;
  IP_BLACKLIST_UPDATE_INTERVAL_HOURS: number;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const getOptionalEnvVar = (key: string, defaultValue?: string): string | undefined => {
  return process.env[key] || defaultValue;
};

const getNumberEnvVar = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
};

const getBooleanEnvVar = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getArrayEnvVar = (key: string, defaultValue: string[] = []): string[] => {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim());
};

export const env: EnvConfig = {
  // Server
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  PORT: getNumberEnvVar('PORT', 8080),

  // Database
  DATABASE_URL: getEnvVar('DATABASE_URL'),

  // JWT
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_EXPIRES_IN: getEnvVar('JWT_EXPIRES_IN', '15m'),
  REFRESH_TOKEN_SECRET: getEnvVar('REFRESH_TOKEN_SECRET'),
  REFRESH_TOKEN_EXPIRES_IN: getEnvVar('REFRESH_TOKEN_EXPIRES_IN', '7d'),

  // CORS
  ALLOWED_ORIGINS: getArrayEnvVar('ALLOWED_ORIGINS', ['https://finalbell.co.uk', 'https://www.finalbell.co.uk']),

  // File Upload
  MAX_FILE_SIZE: getNumberEnvVar('MAX_FILE_SIZE', 10485760), // 10MB default
  UPLOAD_DIR: getEnvVar('UPLOAD_DIR', 'uploads'),

  // AWS S3 (Optional)
  AWS_ACCESS_KEY_ID: getOptionalEnvVar('AWS_ACCESS_KEY_ID'),
  AWS_SECRET_ACCESS_KEY: getOptionalEnvVar('AWS_SECRET_ACCESS_KEY'),
  AWS_REGION: getOptionalEnvVar('AWS_REGION', 'eu-west-2'),
  AWS_S3_BUCKET: getOptionalEnvVar('AWS_S3_BUCKET'),

  // Cloudinary (Optional)
  CLOUDINARY_CLOUD_NAME: getOptionalEnvVar('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: getOptionalEnvVar('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: getOptionalEnvVar('CLOUDINARY_API_SECRET'),

  // Email
  SMTP_HOST: getOptionalEnvVar('SMTP_HOST'),
  SMTP_PORT: getNumberEnvVar('SMTP_PORT', 587),
  SMTP_SECURE: getBooleanEnvVar('SMTP_SECURE', false),
  SMTP_USER: getOptionalEnvVar('SMTP_USER'),
  SMTP_PASSWORD: getOptionalEnvVar('SMTP_PASSWORD'),
  EMAIL_FROM: getOptionalEnvVar('EMAIL_FROM', 'noreply@finalbell.co.uk'),
  ADMIN_EMAIL: getOptionalEnvVar('ADMIN_EMAIL'),

  // Stripe
  STRIPE_SECRET_KEY: getOptionalEnvVar('STRIPE_SECRET_KEY'),
  STRIPE_PUBLISHABLE_KEY: getOptionalEnvVar('STRIPE_PUBLISHABLE_KEY'),
  STRIPE_WEBHOOK_SECRET: getOptionalEnvVar('STRIPE_WEBHOOK_SECRET'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: getNumberEnvVar('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: getNumberEnvVar('RATE_LIMIT_MAX_REQUESTS', 100),

  // Client
  CLIENT_URL: getEnvVar('CLIENT_URL', 'https://finalbell.co.uk'),

  // Muaythai-Boxing.com CSV
  MTB_CSV_URL: getOptionalEnvVar('MTB_CSV_URL', 'https://app.matrixify.app/files/hx1kg2-jn/a9c39b060fb5c913dcb623116952f087/mtb-product-export.csv'),

  // Admin
  ADMIN_API_KEY: getOptionalEnvVar('ADMIN_API_KEY'),

  // IP Blacklist
  IP_BLACKLIST_ENABLED: getBooleanEnvVar('IP_BLACKLIST_ENABLED', true),
  IP_BLACKLIST_UPDATE_INTERVAL_HOURS: getNumberEnvVar('IP_BLACKLIST_UPDATE_INTERVAL_HOURS', 24),
};

// Validate critical environment variables on startup
export const validateEnv = (): void => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach(varName => console.error(`  - ${varName}`));
    throw new Error('Environment validation failed');
  }

  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }

  if (env.REFRESH_TOKEN_SECRET.length < 32) {
    throw new Error('REFRESH_TOKEN_SECRET must be at least 32 characters long');
  } 

  console.log('✓ Environment variables validated');
};
