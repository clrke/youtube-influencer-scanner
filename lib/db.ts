import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Initialize Prisma with SQLite optimizations
const initPrisma = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  // Set pragmas on startup
  const setupPragmas = async () => {
    try {
      await client.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
      await client.$executeRawUnsafe(`PRAGMA busy_timeout = 20000;`);
      await client.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
      await client.$executeRawUnsafe(`PRAGMA cache_size = -64000;`);
      await client.$executeRawUnsafe(`PRAGMA temp_store = MEMORY;`);
      console.log('[DB] SQLite pragmas configured for better concurrency');
    } catch (error) {
      console.error('[DB] Failed to set SQLite pragmas:', error);
    }
  };

  // Run pragma setup immediately
  setupPragmas();

  return client;
};

export const prisma = globalForPrisma.prisma ?? initPrisma();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;