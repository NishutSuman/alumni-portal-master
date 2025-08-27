const MembershipService = require('../membership.service');
const { prisma } = require('../../config/database');
const EmailService = require('../email/EmailManager');

class MembershipPaymentService {
  /**
   * Process successful membership payment
   */
  static async processMembershipPaymentSuccess(transactionId, webhookData) {
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
      
      if (!transaction || transaction.referenceType !== 'MEMBERSHIP') {
        throw new Error('Invalid membership transaction');
      }
      
      console.log(`Processing membership payment for user: ${transaction.userId}`);
      
      // Process membership activation
      await MembershipService.processMembershipPayment(
        transaction.userId,
        transactionId,
        transaction.amount
      );
      
      // Send confirmation email
      await this.sendMembershipConfirmationEmail(transaction);
      
      console.log(`✅ Membership payment processed successfully for user: ${transaction.userId}`);
      return true;
    } catch (error) {
      console.error('Process membership payment success error:', error);
      throw error;
    }
  }
  
  /**
   * Send membership confirmation email
   */
  static async sendMembershipConfirmationEmail(transaction) {
    try {
      const currentYear = new Date().getFullYear();
      const expiryDate = new Date(currentYear + 1, 0, 1); // January 1st next year
      
      const emailData = {
        to: transaction.user.email,
        subject: `🎉 Membership Activated - ${currentYear}`,
        template: 'membership_confirmation',
        data: {
          userName: transaction.user.fullName,
          membershipYear: currentYear,
          amount: transaction.amount,
          transactionNumber: transaction.transactionNumber,
          batchYear: transaction.user.batch,
          expiresAt: expiryDate.toLocaleDateString('en-IN'),
          loginUrl: `${process.env.FRONTEND_URL}/login`
        }
      };
      
      // Send email using existing email service
      await EmailService.send(emailData);
      console.log(`📧 Membership confirmation email sent to: ${transaction.user.email}`);
    } catch (error) {
      console.error('Send membership confirmation email error:', error);
      // Don't throw error as payment is already processed
    }
  }
}

module.exports = MembershipPaymentService;
