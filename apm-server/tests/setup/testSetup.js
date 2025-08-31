// tests/setup/testSetup.js
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
require('dotenv').config({ path: '.env.test' });

let testPrisma;
let testRedis;

// Global test setup
beforeAll(async () => {
  console.log('🔧 Setting up test environment...');
  
  // Initialize test database
  testPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
      }
    }
  });
  
  await testPrisma.$connect();
  
  // Initialize test Redis (optional - skip if Redis not available)
  try {
    testRedis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6380,
      db: process.env.REDIS_DB || 1,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 1,
      lazyConnect: true
    });
    await testRedis.connect();
  } catch (error) {
    console.warn('⚠️ Redis not available for tests, skipping...');
    testRedis = null;
  }
  
  // Make available globally
  global.testPrisma = testPrisma;
  global.testRedis = testRedis;
  
  console.log('✅ Test environment ready');
});

// Clean up after each test
afterEach(async () => {
  if (testPrisma) {
    // Clean in dependency order
    const tablesToClean = [
      'activityLog',
      'blacklistedEmail', 
      'user',
      'batch'
    ];
    
    for (const table of tablesToClean) {
      try {
        await testPrisma[table].deleteMany({});
      } catch (error) {
        console.warn(`Failed to clean ${table}:`, error.message);
      }
    }
  }
  
  if (testRedis) {
    try {
      await testRedis.flushdb();
    } catch (error) {
      // Skip Redis cleanup errors
    }
  }
});

// Global teardown
afterAll(async () => {
  if (testPrisma) {
    await testPrisma.$disconnect();
  }
  
  if (testRedis) {
    await testRedis.disconnect();
  }
  
  console.log('🧹 Test cleanup complete');
});

// Export for direct use in tests
module.exports = {
  testPrisma,
  testRedis
};