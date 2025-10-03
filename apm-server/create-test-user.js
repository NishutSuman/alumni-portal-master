// Quick script to create a test user
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Hash password
    const hashedPassword = await bcrypt.hash('Admin@123', 12);
    
    // Create test admin user
    const user = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: hashedPassword,
        fullName: 'Test Admin User',
        batch: 2020,
        admissionYear: 2014,
        passoutYear: 2020,
        role: 'SUPER_ADMIN',
        isActive: true,
        isEmailVerified: true,
        isAlumniVerified: true,
        pendingVerification: false,
        isRejected: false,
        serialId: 'ADM001'
      }
    });
    
    console.log('✅ Test admin user created:', user.email);
    console.log('📧 Email: admin@example.com');
    console.log('🔒 Password: Admin@123');
    
    // Also create a regular user
    const hashedPassword2 = await bcrypt.hash('User@123', 12);
    const user2 = await prisma.user.create({
      data: {
        email: 'user@example.com',
        passwordHash: hashedPassword2,
        fullName: 'Test Regular User',
        batch: 2021,
        admissionYear: 2015,
        passoutYear: 2021,
        role: 'USER',
        isActive: true,
        isEmailVerified: true,
        isAlumniVerified: true,
        pendingVerification: false,
        isRejected: false,
        serialId: 'USR001'
      }
    });
    
    console.log('✅ Test regular user created:', user2.email);
    console.log('📧 Email: user@example.com');
    console.log('🔒 Password: User@123');
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('⚠️  Users already exist');
    } else {
      console.error('❌ Error creating test users:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();