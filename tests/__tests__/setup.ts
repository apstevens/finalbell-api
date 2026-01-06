/**
 * Test Setup
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-minimum-32-characters';
process.env.ADMIN_API_KEY = 'test-api-key-minimum-32-characters-long';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.CLIENT_URL = 'http://localhost:3000';

// Increase test timeout
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
};

// Export a dummy test to satisfy Jest requirement
export {};
