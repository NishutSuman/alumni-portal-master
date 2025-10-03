// Script to manually verify a payment and test the complete flow
const { PrismaClient } = require('@prisma/client');
const PaymentService = require('./src/services/payment/PaymentService');

const prisma = new PrismaClient();

async function testPaymentVerification() {
  try {
    console.log('🔍 Finding latest PENDING transaction...\n');
    
    const latestTransaction = await prisma.paymentTransaction.findFirst({
      where: { status: 'PENDING' },
      orderBy: { initiatedAt: 'desc' },
      select: {
        id: true,
        transactionNumber: true,
        amount: true,
        razorpayOrderId: true,
        referenceType: true,
        referenceId: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!latestTransaction) {
      console.log('❌ No pending transactions found');
      return;
    }

    console.log('📋 Latest Pending Transaction:');
    console.log(`   ID: ${latestTransaction.id}`);
    console.log(`   Number: ${latestTransaction.transactionNumber}`);
    console.log(`   Amount: ₹${latestTransaction.amount}`);
    console.log(`   User: ${latestTransaction.user.fullName}`);
    console.log(`   Razorpay Order: ${latestTransaction.razorpayOrderId}`);
    console.log(`   Type: ${latestTransaction.referenceType}`);
    console.log(`   Reference: ${latestTransaction.referenceId}\n`);

    // Simulate a successful payment verification
    console.log('🔧 Simulating payment verification...\n');
    
    const mockPaymentData = {
      razorpay_order_id: latestTransaction.razorpayOrderId,
      razorpay_payment_id: `pay_test_${Date.now()}`,
      razorpay_signature: 'test_signature_' + Math.random().toString(36).substring(7)
    };

    console.log('📤 Mock Payment Data:');
    console.log(`   Order ID: ${mockPaymentData.razorpay_order_id}`);
    console.log(`   Payment ID: ${mockPaymentData.razorpay_payment_id}`);
    console.log(`   Signature: ${mockPaymentData.razorpay_signature}\n`);

    try {
      const result = await PaymentService.verifyPayment({
        transactionId: latestTransaction.id,
        ...mockPaymentData
      });

      console.log('✅ Payment verification result:');
      console.log('   Success:', result.success);
      console.log('   Status:', result.transaction?.status);
      console.log('   Completed At:', result.transaction?.completedAt);
      console.log('   Payment ID:', result.transaction?.razorpayPaymentId);

      // Check if registration was created
      if (latestTransaction.referenceType === 'EVENT_PAYMENT') {
        console.log('\n🎫 Checking for created registration...');
        
        const registration = await prisma.eventRegistration.findFirst({
          where: { 
            eventId: latestTransaction.referenceId,
            userId: latestTransaction.user.id
          },
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            totalAmountPaid: true,
            donationAmount: true,
            createdAt: true
          }
        });

        if (registration) {
          console.log('✅ Registration created successfully:');
          console.log(`   ID: ${registration.id}`);
          console.log(`   Status: ${registration.status}`);
          console.log(`   Payment Status: ${registration.paymentStatus}`);
          console.log(`   Amount Paid: ₹${registration.totalAmountPaid}`);
          console.log(`   Donation: ₹${registration.donationAmount || 0}`);
          console.log(`   Created: ${registration.createdAt}`);
        } else {
          console.log('❌ No registration found - registration creation failed');
        }
      }

    } catch (verificationError) {
      console.error('❌ Payment verification failed:', verificationError.message);
    }

  } catch (error) {
    console.error('❌ Error testing payment verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPaymentVerification();