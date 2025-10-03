// Script to make a user SUPER_ADMIN
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeSuperAdmin(email) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, fullName: true, role: true }
    });
    
    if (!user) {
      console.error(`❌ User with email ${email} not found`);
      return;
    }
    
    console.log(`📋 Found user:`, {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      currentRole: user.role
    });
    
    if (user.role === 'SUPER_ADMIN') {
      console.log(`✅ User ${email} is already a SUPER_ADMIN`);
      return;
    }
    
    // Update user role to SUPER_ADMIN
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'SUPER_ADMIN',
        isAlumniVerified: true,  // Super admin should be verified
        pendingVerification: false,
        alumniVerifiedAt: new Date(),
        updatedAt: new Date()
      },
      select: { id: true, email: true, fullName: true, role: true, isAlumniVerified: true }
    });
    
    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'role_updated',
        details: {
          previousRole: user.role,
          newRole: 'SUPER_ADMIN',
          updatedBy: 'system_script',
          reason: 'Initial super admin setup'
        }
      }
    });
    
    console.log(`✅ Successfully updated user to SUPER_ADMIN:`, {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      isAlumniVerified: updatedUser.isAlumniVerified
    });
    
  } catch (error) {
    console.error('❌ Error making user super admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'nishutsuman1998@gmail.com';
makeSuperAdmin(email);