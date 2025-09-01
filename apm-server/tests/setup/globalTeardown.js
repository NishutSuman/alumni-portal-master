// tests/setup/globalTeardown.js
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
require('dotenv').config({ path: '.env.test' });

module.exports = async () => {
  console.log('🧹 Global Test Teardown Starting...');
  
  // Initialize connections for cleanup
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
      }
    }
  });
  
  let redis = null;
  
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Connected to test database for cleanup');
    
    // Clean test database completely
    console.log('🧹 Final database cleanup...');
    
    // Clean in dependency order (children first, parents last)
    const tablesToClean = [
      'activityLog',
      'blacklistedEmail',
      'user', 
      'batch',
      // Add other tables as needed for full cleanup
      'payment',
      'eventRegistration',
      'post',
      'comment',
      'like',
      'ticket',
      'group',
      'poll'
    ];
    
    for (const table of tablesToClean) {
      try {
        const result = await prisma[table].deleteMany({});
        console.log(`Cleaned ${result.count || 0} records from ${table}`);
      } catch (error) {
        // Some tables might not exist or have constraints
        console.warn(`Warning: Could not clean ${table}:`, error.message.split('\n')[0]);
      }
    }
    
    console.log('✅ Test database cleaned');
    
    // Clean test Redis if available
    try {
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6380,
        db: process.env.REDIS_DB || 1,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
        lazyConnect: true
      });
      
      await redis.connect();
      await redis.flushdb();
      console.log('✅ Test Redis cleaned');
      
    } catch (error) {
      console.warn('⚠️ Redis cleanup skipped (not available or already clean)');
    }
    
  } catch (error) {
    console.error('❌ Global teardown error:', error.message);
    // Don't throw error to avoid breaking test runs
  } finally {
    // Close connections
    try {
      await prisma.$disconnect();
      console.log('🔌 Database connection closed');
      
      if (redis) {
        await redis.disconnect();
        console.log('🔌 Redis connection closed');
      }
    } catch (error) {
      console.warn('Warning during connection cleanup:', error.message);
    }
  }
  
  console.log('🎯 Global Test Teardown Complete');
};