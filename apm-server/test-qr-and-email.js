// Script to check QR code generation and email status
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testQRAndEmail() {
  try {
    console.log('🔍 Checking QR code and email status...\n');
    
    // Find the latest registration
    const registration = await prisma.eventRegistration.findFirst({
      where: { status: 'CONFIRMED' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            fullName: true,
            email: true
          }
        },
        event: {
          select: {
            title: true,
            eventDate: true,
            venue: true
          }
        },
        qr: {
          select: {
            id: true,
            qrCode: true,
            qrData: true,
            qrImageUrl: true,
            generatedAt: true,
            scanCount: true,
            isActive: true
          }
        },
        guests: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mealPreference: true
          }
        }
      }
    });

    if (!registration) {
      console.log('❌ No confirmed registrations found');
      return;
    }

    console.log('🎫 Latest Registration:');
    console.log(`   ID: ${registration.id}`);
    console.log(`   User: ${registration.user.fullName} (${registration.user.email})`);
    console.log(`   Event: ${registration.event.title}`);
    console.log(`   Event Date: ${registration.event.eventDate}`);
    console.log(`   Venue: ${registration.event.venue}`);
    console.log(`   Status: ${registration.status}`);
    console.log(`   Payment Status: ${registration.paymentStatus}`);
    console.log(`   Amount Paid: ₹${registration.totalAmountPaid}`);
    console.log(`   Donation: ₹${registration.donationAmount}`);
    console.log(`   Meal Preference: ${registration.mealPreference}`);
    console.log(`   Created: ${registration.createdAt}\n`);

    // Check guests
    if (registration.guests.length > 0) {
      console.log('👥 Guests:');
      registration.guests.forEach((guest, index) => {
        console.log(`   ${index + 1}. ${guest.name} (${guest.email || 'No email'})`);
        console.log(`      Phone: ${guest.phone || 'N/A'}`);
        console.log(`      Meal: ${guest.mealPreference || 'N/A'}`);
      });
      console.log('');
    }

    // Check QR code
    if (registration.qr) {
      console.log('📱 QR Code:');
      console.log(`   ID: ${registration.qr.id}`);
      console.log(`   QR Code: ${registration.qr.qrCode}`);
      console.log(`   QR Data: ${registration.qr.qrData}`);
      console.log(`   Image URL: ${registration.qr.qrImageUrl || 'N/A'}`);
      console.log(`   Generated: ${registration.qr.generatedAt}`);
      console.log(`   Scan Count: ${registration.qr.scanCount}`);
      console.log(`   Active: ${registration.qr.isActive}`);
    } else {
      console.log('❌ No QR code found for this registration');
    }

    // Check activity logs for email sending
    console.log('\n📧 Checking email activity...');
    const emailLogs = await prisma.activityLog.findMany({
      where: {
        action: { contains: 'email' },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true
      }
    });

    if (emailLogs.length > 0) {
      console.log('✅ Recent email activities:');
      emailLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. Action: ${log.action}`);
        console.log(`      Details:`, JSON.stringify(log.details, null, 6));
        console.log(`      Time: ${log.createdAt}`);
        console.log('-'.repeat(60));
      });
    } else {
      console.log('❌ No email activities found in the last 24 hours');
    }

  } catch (error) {
    console.error('❌ Error checking QR and email:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQRAndEmail();