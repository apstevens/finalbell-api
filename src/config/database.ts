import { PrismaClient } from '../generated/prisma';

/**
 * Prisma Client Singleton
 *
 * This ensures we only create one instance of PrismaClient
 * and reuse it across the application. This is important for:
 * - Connection pooling
 * - Performance optimization
 * - Avoiding connection limits
 */

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });
};

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;

/**
 * Connect to the database
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✓ Database connected successfully');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  }
};

/**
 * Disconnect from the database
 */
export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  console.log('✓ Database disconnected');
};

/**
 * Health check for database connection
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};
