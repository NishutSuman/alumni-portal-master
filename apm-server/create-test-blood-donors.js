const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestBloodDonors() {
  try {
    console.log('🩸 Creating test blood donors...');

    const testDonors = [
      {
        email: 'donor1@test.com',
        fullName: 'John Doe',
        bloodGroup: 'A_POSITIVE',
        whatsappNumber: '9876543210',
        city: 'Bhubaneswar',
        state: 'Odisha'
      },
      {
        email: 'donor2@test.com',
        fullName: 'Jane Smith', 
        bloodGroup: 'B_POSITIVE',
        whatsappNumber: '9876543211',
        city: 'Bhubaneswar',
        state: 'Odisha'
      },
      {
        email: 'donor3@test.com',
        fullName: 'Bob Wilson',
        bloodGroup: 'O_POSITIVE',
        whatsappNumber: '9876543212',
        city: 'Mumbai',
        state: 'Maharashtra'
      },
      {
        email: 'donor4@test.com',
        fullName: 'Alice Brown',
        bloodGroup: 'A_NEGATIVE',
        whatsappNumber: '9876543213',
        city: 'Bhubaneswar',
        state: 'Odisha'
      }
    ];

    for (const donorData of testDonors) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: donorData.email }
      });

      if (existingUser) {
        // Update existing user to be a blood donor
        await prisma.user.update({
          where: { email: donorData.email },
          data: {
            isBloodDonor: true,
            bloodGroup: donorData.bloodGroup,
            whatsappNumber: donorData.whatsappNumber,
            showPhone: true,
            totalBloodDonations: Math.floor(Math.random() * 5) + 1,
            lastBloodDonationDate: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000)
          }
        });
        console.log(`✅ Updated ${donorData.email} as blood donor`);
      } else {
        // Create new user
        const hashedPassword = await bcrypt.hash('password123', 10);
        const user = await prisma.user.create({
          data: {
            email: donorData.email,
            passwordHash: hashedPassword,
            fullName: donorData.fullName,
            batch: 2020,
            admissionYear: 2014,
            passoutYear: 2020,
            isAlumniVerified: true,
            pendingVerification: false,
            isBloodDonor: true,
            bloodGroup: donorData.bloodGroup,
            whatsappNumber: donorData.whatsappNumber,
            showPhone: true,
            totalBloodDonations: Math.floor(Math.random() * 5) + 1,
            lastBloodDonationDate: new Date(Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000)
          }
        });

        // Add address
        await prisma.userAddress.create({
          data: {
            userId: user.id,
            addressLine1: '123 Test Street',
            city: donorData.city,
            state: donorData.state,
            postalCode: '751001',
            addressType: 'CURRENT'
          }
        });

        console.log(`✅ Created ${donorData.email} as blood donor`);
      }
    }

    // Get total blood donors
    const totalDonors = await prisma.user.count({
      where: { isBloodDonor: true }
    });

    console.log(`🩸 Total blood donors in database: ${totalDonors}`);
    console.log('✅ Test blood donors created successfully!');

  } catch (error) {
    console.error('❌ Error creating test donors:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestBloodDonors();