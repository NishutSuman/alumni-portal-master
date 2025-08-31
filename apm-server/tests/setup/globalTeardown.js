const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.test' });

module.exports = async () => {
  console.log('🧹 Global Test Teardown Starting...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
      }
    }
  });
  
  try {
    await prisma.$connect();
    
    // Optional: Clean up test data
    // You might want to keep this for debugging or skip for performance
    console.log('🗑️ Final database cleanup...');
    
    const tablesToClean = [
      'activityLog',
      'blacklistedEmail', 
      'user',
      'batch'
    ];
    
    for (const table of tablesToClean) {
      try {
        const count = await prisma[table].deleteMany({});
        console.log(`Cleaned ${count.count} records from ${table}`);
      } catch (error) {
        console.warn(`Warning: Could not clean ${table}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here, we want tests to complete
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('✅ Global Test Teardown Complete');
};
