const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.test' });

module.exports = async () => {
  console.log('🚀 Global Test Setup Starting...');
  
  // Initialize test database
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
      }
    }
  });
  
  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Test database connected');
    
    // Run migrations (if needed)
    // Note: This assumes you have migrations set up
    // You might need to run: npx prisma migrate dev --name test-setup
    
    // Clean existing test data
    console.log('🧹 Cleaning test database...');
    
    // Clean in dependency order (children first, parents last)
    const tablesToClean = [
      'activityLog',
      'blacklistedEmail',
      'user', 
      'batch'
    ];
    
    for (const table of tablesToClean) {
      try {
        const result = await prisma[table].deleteMany({});
        console.log(`Cleaned ${result.count || 0} records from ${table}`);
      } catch (error) {
        console.warn(`Warning: Could not clean ${table}:`, error.message);
      }
    }
    
    console.log('✅ Test database cleaned');
    
    // Create essential test data
    console.log('📝 Creating essential test data...');
    
    // Create test batches (using correct schema fields)
    const testBatches = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
    for (const year of testBatches) {
      await prisma.batch.upsert({
        where: { year },
        update: {},
        create: {
          year,
          name: `Batch ${year}`,
          description: `Test batch for year ${year}`,
          totalMembers: 0,
          lastSerialCounter: 0
        }
      });
    }
    
    console.log('✅ Test batches created');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('🎯 Global Test Setup Complete');
};