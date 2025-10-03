// Script to check current payment status in database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPaymentStatus() {
  try {
    console.log('🔍 Checking recent payment transactions...\n');
    
    const recentTransactions = await prisma.paymentTransaction.findMany({
      orderBy: { initiatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        transactionNumber: true,
        amount: true,
        status: true,
        referenceType: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        initiatedAt: true,
        completedAt: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    if (recentTransactions.length === 0) {
      console.log('❌ No transactions found');
      return;
    }

    console.log('📊 Recent Transactions:');
    console.log('='.repeat(80));
    
    recentTransactions.forEach((tx, index) => {
      console.log(`${index + 1}. Transaction ID: ${tx.id}`);
      console.log(`   Number: ${tx.transactionNumber}`);
      console.log(`   Amount: ₹${tx.amount}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Type: ${tx.referenceType}`);
      console.log(`   User: ${tx.user.fullName} (${tx.user.email})`);
      console.log(`   Razorpay Order: ${tx.razorpayOrderId || 'N/A'}`);
      console.log(`   Razorpay Payment: ${tx.razorpayPaymentId || 'N/A'}`);
      console.log(`   Initiated: ${tx.initiatedAt}`);
      console.log(`   Completed: ${tx.completedAt || 'N/A'}`);
      console.log('-'.repeat(60));
    });

    // Check recent registrations
    console.log('\n🎫 Recent Event Registrations:');
    console.log('='.repeat(80));
    
    const recentRegistrations = await prisma.eventRegistration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        totalAmountPaid: true,
        paymentTransactionId: true,
        donationAmount: true,
        createdAt: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        },
        event: {
          select: {
            title: true
          }
        }
      }
    });

    if (recentRegistrations.length === 0) {
      console.log('❌ No registrations found');
    } else {
      recentRegistrations.forEach((reg, index) => {
        console.log(`${index + 1}. Registration ID: ${reg.id}`);
        console.log(`   Event: ${reg.event.title}`);
        console.log(`   User: ${reg.user.fullName} (${reg.user.email})`);
        console.log(`   Status: ${reg.status}`);
        console.log(`   Payment Status: ${reg.paymentStatus}`);
        console.log(`   Amount Paid: ₹${reg.totalAmountPaid || 0}`);
        console.log(`   Donation: ₹${reg.donationAmount || 0}`);
        console.log(`   Payment Transaction: ${reg.paymentTransactionId || 'N/A'}`);
        console.log(`   Created: ${reg.createdAt}`);
        console.log('-'.repeat(60));
      });
    }

    // Check webhook events
    console.log('\n🎣 Recent Webhook Events:');
    console.log('='.repeat(80));
    
    const recentWebhooks = await prisma.paymentWebhook.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        provider: true,
        eventType: true,
        status: true,
        processedAt: true,
        transactionId: true,
        createdAt: true
      }
    });

    if (recentWebhooks.length === 0) {
      console.log('❌ No webhook events found');
    } else {
      recentWebhooks.forEach((webhook, index) => {
        console.log(`${index + 1}. Webhook ID: ${webhook.id}`);
        console.log(`   Provider: ${webhook.provider}`);
        console.log(`   Event Type: ${webhook.eventType}`);
        console.log(`   Status: ${webhook.status}`);
        console.log(`   Transaction: ${webhook.transactionId || 'N/A'}`);
        console.log(`   Created: ${webhook.createdAt}`);
        console.log(`   Processed: ${webhook.processedAt || 'N/A'}`);
        console.log('-'.repeat(60));
      });
    }

  } catch (error) {
    console.error('❌ Error checking payment status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPaymentStatus();