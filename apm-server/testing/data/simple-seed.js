// testing/data/simple-seed.js
// ULTRA SIMPLE - Just create 4 test users for auth testing
// No complex relationships, just basic users

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const colors = require('colors');

const prisma = new PrismaClient();

async function createTestUsers() {
  console.log('🌱 Creating Simple Test Users for Auth Testing'.green.bold);
  console.log('='.repeat(50).cyan);
  
  const hashedPassword = await bcrypt.hash('TestPassword123!', 12);
  
  const users = [
    {
      email: 'admin@test.com',
      passwordHash: hashedPassword,
      fullName: 'Super Admin',
      role: 'SUPER_ADMIN',
      batch: 2020,
      isActive: true,
      isEmailVerified: true,
      isAlumniVerified: true
    },
    {
      email: 'user@test.com',
      passwordHash: hashedPassword,
      fullName: 'Test User',
      role: 'USER',
      batch: 2020,
      isActive: true,
      isEmailVerified: true,
      isAlumniVerified: true
    },
    {
      email: 'batchadmin2020@test.com',
      passwordHash: hashedPassword,
      fullName: 'Batch 2020 Admin',
      role: 'USER',
      batch: 2020,
      isActive: true,
      isEmailVerified: true,
      isAlumniVerified: true
    },
    {
      email: 'unverified@test.com',
      passwordHash: hashedPassword,
      fullName: 'Unverified User',
      role: 'USER',
      batch: 2021,
      isActive: true,
      isEmailVerified: true,
      isAlumniVerified: false,
      pendingVerification: true
    }
  ];

  let createdCount = 0;
  
  for (const userData of users) {
    try {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: userData
      });
      
      console.log(`✅ Created: ${userData.email} (${userData.role})`.green);
      createdCount++;
    } catch (error) {
      console.log(`❌ Failed to create ${userData.email}: ${error.message}`.red);
      console.error('Full error for debugging:', error);
    }
  }

  console.log(`\n📊 SUMMARY:`.yellow.bold);
  console.log(`   Users Created: ${createdCount}/4`.white);
  
  if (createdCount >= 3) {
    console.log('\n🎉 SUCCESS! Auth testing users ready'.green.bold);
    console.log('\n🎯 NEXT STEPS:'.blue.bold);
    console.log('   1. Run: node auth-structure-test.js'.white);
    console.log('   2. Check if login works with admin@test.com'.white);
    console.log('   3. If successful, we can create the auth test file'.white);
  } else {
    console.log('\n❌ FAILED! Not enough users created'.red.bold);
    console.log('   Check the errors above and fix schema issues'.red);
  }
  
  await prisma.$disconnect();
}

// Run if this file is executed directly
if (require.main === module) {
  createTestUsers().catch(error => {
    console.error('🚨 SIMPLE SEEDING FAILED:'.red.bold, error.message);
    console.error('Full error:', error);
    process.exit(1);
  });
}

module.exports = createTestUsers;