// src/services/payment/batchPayment.service.js
// Extension to handle batch admin payment processing

const BatchCollectionService = require('../batchCollection.service');
const { prisma } = require('../../config/database');
const EmailService = require('../email/EmailManager');

class BatchPaymentService {
  /**
   * Process successful batch admin payment
   */
  static async processBatchPaymentSuccess(transactionId, webhookData) {
    try {
      const transaction = await prisma.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: { 
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              batch: true
            }
          }
        }
      });
      
      if (!transaction || transaction.referenceType !== 'BATCH_ADMIN_PAYMENT') {
        throw new Error('Invalid batch admin payment transaction');
      }

      const metadata = transaction.metadata || {};
      const { eventId, batchYear, batchCollectionId } = metadata;
      
      console.log(`Processing batch admin payment: ${transaction.userId} - ₹${transaction.amount}`);
      
      // Process the payment using BatchCollectionService
      await BatchCollectionService.processBatchAdminPayment(
        eventId,
        batchYear,
        transaction.userId,
        transaction.amount,
        transactionId
      );

      // Get updated collection status to check if target is met
      const collectionStatus = await BatchCollectionService.getBatchCollectionStatus(
        eventId, 
        batchYear
      );

      // Check if target is met and handle notifications
      if (collectionStatus && collectionStatus.isTargetMet && !collectionStatus.isApproved) {
        await BatchCollectionService.handleTargetMet(batchCollectionId);
      }

      // Send confirmation email to the batch admin
      await this.sendBatchPaymentConfirmationEmail(transaction, collectionStatus);
      
      console.log(`✅ Batch admin payment processed successfully: ${transaction.userId}`);
      return true;

    } catch (error) {
      console.error('Process batch payment success error:', error);
      throw error;
    }
  }

  /**
   * Send batch payment confirmation email
   */
  static async sendBatchPaymentConfirmationEmail(transaction, collectionStatus) {
    try {
      const emailData = {
        to: transaction.user.email,
        subject: `✅ Batch Payment Confirmed - ${collectionStatus.event.title}`,
        template: 'batch_payment_confirmation',
        data: {
          adminName: transaction.user.fullName,
          eventTitle: collectionStatus.event.title,
          batchName: collectionStatus.batch.name,
          amount: transaction.amount,
          transactionNumber: transaction.transactionNumber,
          paymentDate: new Date().toLocaleDateString('en-IN'),
          
          // Collection progress
          targetAmount: collectionStatus.targetAmount,
          collectedAmount: collectionStatus.collectedAmount,
          progressPercentage: collectionStatus.progressPercentage,
          remainingAmount: collectionStatus.remainingAmount,
          isTargetMet: collectionStatus.isTargetMet,
          
          // URLs
          progressUrl: `${process.env.FRONTEND_URL}/events/${collectionStatus.eventId}/batch-progress/${collectionStatus.batchYear}`,
          eventUrl: `${process.env.FRONTEND_URL}/events/${collectionStatus.event.slug || collectionStatus.eventId}`
        }
      };
      
      // Send email using existing email service
      await EmailService.send(emailData);
      console.log(`📧 Batch payment confirmation email sent to: ${transaction.user.email}`);

    } catch (error) {
      console.error('Send batch payment confirmation email error:', error);
      // Don't throw error as payment is already processed
    }
  }

  /**
   * Process failed batch admin payment
   */
  static async processBatchPaymentFailure(transactionId, webhookData) {
    try {
      const transaction = await prisma.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: {
          user: { select: { fullName: true, email: true } }
        }
      });

      if (!transaction) {
        return;
      }

      // Update any related batch payment record
      const batchPayment = await prisma.batchAdminPayment.findFirst({
        where: { paymentTransactionId: transactionId }
      });

      if (batchPayment) {
        await prisma.batchAdminPayment.update({
          where: { id: batchPayment.id },
          data: {
            paymentStatus: 'FAILED',
            updatedAt: new Date()
          }
        });
      }

      // Log failed payment
      await prisma.activityLog.create({
        data: {
          userId: transaction.userId,
          action: 'batch_payment_failed',
          details: {
            transactionId,
            amount: transaction.amount.toString(),
            reason: webhookData.reason || 'Payment failed'
          }
        }
      });

      console.log(`❌ Batch admin payment failed: ${transaction.userId} - ₹${transaction.amount}`);

    } catch (error) {
      console.error('Process batch payment failure error:', error);
    }
  }

  /**
   * Send batch completion notification to all batch members
   */
  static async sendBatchCompletionNotification(batchCollectionId) {
    try {
      const collection = await prisma.batchEventCollection.findUnique({
        where: { id: batchCollectionId },
        include: {
          event: { 
            select: { 
              id: true, 
              title: true, 
              slug: true,
              startsAt: true,
              venue: true 
            }
          },
          batch: { select: { year: true, name: true } }
        }
      });

      if (!collection || !collection.isApproved) {
        return;
      }

      // Get all batch members who will be auto-registered
      const batchMembers = await prisma.user.findMany({
        where: {
          batch: collection.batchYear,
          isActive: true,
          role: { in: ['USER', 'BATCH_ADMIN'] }
        },
        select: { id: true, fullName: true, email: true }
      });

      // Send notification emails to all batch members
      for (const member of batchMembers) {
        try {
          const emailData = {
            to: member.email,
            subject: `🎉 You're Registered! ${collection.event.title}`,
            template: 'batch_registration_success',
            data: {
              memberName: member.fullName,
              eventTitle: collection.event.title,
              batchName: collection.batch.name,
              eventDate: new Date(collection.event.startsAt).toLocaleDateString('en-IN'),
              eventVenue: collection.event.venue,
              
              // Collection details
              targetAmount: collection.targetAmount,
              collectedAmount: collection.collectedAmount,
              
              // URLs and QR codes
              eventUrl: `${process.env.FRONTEND_URL}/events/${collection.event.slug || collection.eventId}`,
              registrationUrl: `${process.env.FRONTEND_URL}/my-events`,
              
              // Add QR code data for check-in
              qrCodeData: JSON.stringify({
                type: 'EVENT_REGISTRATION',
                eventId: collection.eventId,
                userId: member.id,
                registrationMode: 'BATCH_AUTO_REGISTERED'
              })
            }
          };

          await EmailService.send(emailData);
          
        } catch (emailError) {
          console.error(`Failed to send batch completion email to ${member.email}:`, emailError);
        }
      }

      console.log(`📧 Batch completion notifications sent to ${batchMembers.length} members`);

    } catch (error) {
      console.error('Send batch completion notification error:', error);
    }
  }

  /**
   * Calculate batch collection statistics
   */
  static async getBatchCollectionStats(eventId) {
    try {
      const stats = await prisma.batchEventCollection.groupBy({
        by: ['status'],
        where: { eventId },
        _count: true,
        _sum: {
          targetAmount: true,
          collectedAmount: true
        }
      });

      const totalCollections = await prisma.batchEventCollection.count({
        where: { eventId }
      });

      const completedCollections = await prisma.batchEventCollection.count({
        where: { 
          eventId,
          isApproved: true 
        }
      });

      const targetMetCount = await prisma.batchEventCollection.count({
        where: { 
          eventId,
          isTargetMet: true 
        }
      });

      return {
        totalCollections,
        completedCollections,
        targetMetCount,
        pendingApproval: targetMetCount - completedCollections,
        statusBreakdown: stats.reduce((acc, stat) => {
          acc[stat.status] = {
            count: stat._count,
            totalTarget: stat._sum.targetAmount || 0,
            totalCollected: stat._sum.collectedAmount || 0
          };
          return acc;
        }, {}),
        totalTargetAmount: stats.reduce((sum, stat) => sum + (stat._sum.targetAmount || 0), 0),
        totalCollectedAmount: stats.reduce((sum, stat) => sum + (stat._sum.collectedAmount || 0), 0)
      };

    } catch (error) {
      console.error('Get batch collection stats error:', error);
      throw error;
    }
  }
}

module.exports = BatchPaymentService;

// =============================================
// INTEGRATION INSTRUCTIONS FOR PaymentService:
// =============================================
/*

Add the following to your existing PaymentService.js in the updateRelatedRecords method:

case "BATCH_ADMIN_PAYMENT":
  // Process batch admin payment
  await BatchPaymentService.processBatchPaymentSuccess(
    transaction.id,
    data
  );
  console.log(`✅ Batch admin payment processed: ${transaction.userId}`);
  break;

Also add to the handleWebhookUpdate method for failed payments:

if (action === "payment_failed" && transaction.referenceType === "BATCH_ADMIN_PAYMENT") {
  await BatchPaymentService.processBatchPaymentFailure(transaction.id, data);
}

*/