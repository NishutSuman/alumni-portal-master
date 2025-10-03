// Script to test invoice generation for completed payment
const { PrismaClient } = require('@prisma/client');
const InvoiceService = require('./src/services/payment/InvoiceService');

const prisma = new PrismaClient();

async function testInvoiceGeneration() {
  try {
    console.log('🧾 Testing invoice generation...\n');
    
    // Find the completed transaction
    const completedTransaction = await prisma.paymentTransaction.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: {
        id: true,
        transactionNumber: true,
        amount: true,
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });

    if (!completedTransaction) {
      console.log('❌ No completed transactions found');
      return;
    }

    console.log('📋 Completed Transaction Found:');
    console.log(`   ID: ${completedTransaction.id}`);
    console.log(`   Number: ${completedTransaction.transactionNumber}`);
    console.log(`   Amount: ₹${completedTransaction.amount}`);
    console.log(`   User: ${completedTransaction.user.fullName}\n`);

    // Test invoice generation
    console.log('🔧 Generating invoice...\n');
    
    try {
      const result = await InvoiceService.generateInvoice(completedTransaction.id);
      
      console.log('✅ Invoice generation result:');
      console.log('   Success:', result.success);
      console.log('   Already Exists:', result.alreadyExists || false);
      console.log('   Invoice ID:', result.invoice.id);
      console.log('   Invoice Number:', result.invoice.invoiceNumber);
      console.log('   PDF Path:', result.invoice.pdfPath || 'N/A');
      console.log('   Generated:', result.invoice.generatedAt);

      // Check if invoice was stored in database
      console.log('\n🔍 Checking invoice in database...');
      const storedInvoice = await prisma.paymentInvoice.findFirst({
        where: { transactionId: completedTransaction.id },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          pdfUrl: true,
          pdfGeneratedAt: true,
          emailSentTo: true,
          emailSentAt: true,
          createdAt: true
        }
      });

      if (storedInvoice) {
        console.log('✅ Invoice found in database:');
        console.log(`   Invoice Number: ${storedInvoice.invoiceNumber}`);
        console.log(`   Status: ${storedInvoice.status}`);
        console.log(`   PDF URL: ${storedInvoice.pdfUrl || 'N/A'}`);
        console.log(`   PDF Generated: ${storedInvoice.pdfGeneratedAt || 'N/A'}`);
        console.log(`   Email Sent To: ${storedInvoice.emailSentTo || 'N/A'}`);
        console.log(`   Email Sent At: ${storedInvoice.emailSentAt || 'N/A'}`);
        console.log(`   Created: ${storedInvoice.createdAt}`);
      } else {
        console.log('❌ Invoice not found in database');
      }

    } catch (invoiceError) {
      console.error('❌ Invoice generation failed:', invoiceError.message);
    }

  } catch (error) {
    console.error('❌ Error testing invoice generation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testInvoiceGeneration();