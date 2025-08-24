// src/services/email/EmailService.js
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/database');

class EmailService {
  constructor(provider) {
    this.provider = provider;
    this.templatesPath = path.join(__dirname, '../../templates/emails');
    this.compiledTemplates = new Map();
  }

  /**
   * Initialize email service with provider
   */
  static async create(provider) {
    const service = new EmailService(provider);
    await service.loadTemplates();
    return service;
  }

  /**
   * Load and compile email templates
   */
  async loadTemplates() {
    try {
      const templateFiles = [
        'registration-confirmation.html',
        'payment-confirmation.html', 
        'guest-addition.html',
        'event-reminder.html',
        'bulk-announcement.html',
        'merchandise-confirmation.html'
      ];

      for (const fileName of templateFiles) {
        const filePath = path.join(this.templatesPath, fileName);
        if (fs.existsSync(filePath)) {
          const templateContent = fs.readFileSync(filePath, 'utf8');
          const compiled = handlebars.compile(templateContent);
          const templateName = fileName.replace('.html', '');
          this.compiledTemplates.set(templateName, compiled);
        }
      }

      console.log(`✅ Loaded ${this.compiledTemplates.size} email templates`);
    } catch (error) {
      console.error('❌ Email template loading error:', error);
    }
  }

  /**
   * Send registration confirmation email
   */
  async sendRegistrationConfirmation(user, event, registration) {
    try {
      const templateData = {
        userName: user.fullName,
        userEmail: user.email,
        eventTitle: event.title,
        eventDate: new Date(event.eventDate).toLocaleDateString(),
        eventTime: event.startTime || 'TBD',
        eventVenue: event.venue || 'TBD',
        eventMode: event.eventMode,
        registrationId: registration.id,
        totalAmount: registration.totalAmount,
        guestCount: registration.totalGuests,
        meetingLink: event.meetingLink,
        hasMeals: event.hasMeals,
        mealPreference: registration.mealPreference,
        registrationDate: new Date(registration.registrationDate).toLocaleDateString()
      };

      const subject = `Registration Confirmed: ${event.title}`;
      const htmlContent = this.compiledTemplates.get('registration-confirmation')(templateData);

      const result = await this.provider.sendEmail(
        user.email,
        subject,
        htmlContent,
        templateData
      );

      // Log email activity
      await this.logEmailActivity(user.id, 'registration_confirmation', {
        eventId: event.id,
        registrationId: registration.id,
        emailResult: result
      });

      return result;

    } catch (error) {
      console.error('Registration confirmation email error:', error);
      throw error;
    }
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(user, transaction, invoice) {
    try {
      const templateData = {
        userName: user.fullName,
        userEmail: user.email,
        transactionNumber: transaction.transactionNumber,
        amount: transaction.amount,
        currency: transaction.currency,
        paymentDate: new Date(transaction.completedAt).toLocaleDateString(),
        paymentMethod: 'UPI',
        invoiceNumber: invoice?.invoiceNumber,
        breakdown: transaction.breakdown,
        invoiceUrl: invoice?.pdfUrl
      };

      const subject = `Payment Confirmation - ${transaction.transactionNumber}`;
      const htmlContent = this.compiledTemplates.get('payment-confirmation')(templateData);

      const result = await this.provider.sendEmail(
        user.email,
        subject,
        htmlContent,
        templateData
      );

      // Log email activity
      await this.logEmailActivity(user.id, 'payment_confirmation', {
        transactionId: transaction.id,
        emailResult: result
      });

      return result;

    } catch (error) {
      console.error('Payment confirmation email error:', error);
      throw error;
    }
  }

  /**
   * Send guest addition notification
   */
  async sendGuestAdditionNotification(user, guest, event) {
    try {
      const templateData = {
        userName: user.fullName,
        guestName: guest.name,
        guestEmail: guest.email,
        eventTitle: event.title,
        eventDate: new Date(event.eventDate).toLocaleDateString(),
        guestFee: guest.feesPaid,
        mealPreference: guest.mealPreference
      };

      const subject = `Guest Added: ${guest.name} for ${event.title}`;
      const htmlContent = this.compiledTemplates.get('guest-addition')(templateData);

      const result = await this.provider.sendEmail(
        user.email,
        subject,
        htmlContent,
        templateData
      );

      // Log email activity
      await this.logEmailActivity(user.id, 'guest_addition', {
        eventId: event.id,
        guestId: guest.id,
        emailResult: result
      });

      return result;

    } catch (error) {
      console.error('Guest addition email error:', error);
      throw error;
    }
  }

  /**
   * Send event reminder email
   */
  async sendEventReminder(user, event, registration) {
    try {
      const templateData = {
        userName: user.fullName,
        eventTitle: event.title,
        eventDate: new Date(event.eventDate).toLocaleDateString(),
        eventTime: event.startTime || 'TBD',
        eventVenue: event.venue || 'TBD',
        meetingLink: event.meetingLink,
        guestCount: registration.totalGuests,
        mealPreference: registration.mealPreference,
        eventMode: event.eventMode
      };

      const subject = `Reminder: ${event.title} Tomorrow`;
      const htmlContent = this.compiledTemplates.get('event-reminder')(templateData);

      const result = await this.provider.sendEmail(
        user.email,
        subject,
        htmlContent,
        templateData
      );

      // Log email activity
      await this.logEmailActivity(user.id, 'event_reminder', {
        eventId: event.id,
        registrationId: registration.id,
        emailResult: result
      });

      return result;

    } catch (error) {
      console.error('Event reminder email error:', error);
      throw error;
    }
  }

  /**
   * Send bulk email to multiple recipients
   */
  async sendBulkEmail(recipients, subject, templateName, templateData) {
    try {
      const htmlContent = this.compiledTemplates.get(templateName)(templateData);
      const results = [];

      // Send emails in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const batchPromises = batch.map(recipient => 
          this.provider.sendEmail(recipient.email, subject, htmlContent, {
            ...templateData,
            userName: recipient.fullName
          })
        );

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Add delay between batches to respect rate limits
        if (i + batchSize < recipients.length) {
          await this.delay(1000); // 1 second delay
        }
      }

      // Log bulk email activity
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      await this.logEmailActivity('system', 'bulk_email', {
        templateName,
        totalRecipients: recipients.length,
        successCount,
        failureCount,
        subject
      });

      return {
        success: true,
        totalSent: recipients.length,
        successCount,
        failureCount,
        results
      };

    } catch (error) {
      console.error('Bulk email error:', error);
      throw error;
    }
  }

  /**
   * Send merchandise order confirmation
   */
  async sendMerchandiseConfirmation(user, order, event) {
    try {
      const templateData = {
        userName: user.fullName,
        eventTitle: event.title,
        orderItems: order.items,
        totalAmount: order.totalPrice,
        orderDate: new Date(order.createdAt).toLocaleDateString()
      };

      const subject = `Merchandise Order Confirmed: ${event.title}`;
      const htmlContent = this.compiledTemplates.get('merchandise-confirmation')(templateData);

      const result = await this.provider.sendEmail(
        user.email,
        subject,
        htmlContent,
        templateData
      );

      // Log email activity
      await this.logEmailActivity(user.id, 'merchandise_confirmation', {
        orderId: order.id,
        eventId: event.id,
        emailResult: result
      });

      return result;

    } catch (error) {
      console.error('Merchandise confirmation email error:', error);
      throw error;
    }
  }

  /**
   * Log email activity to database
   */
  async logEmailActivity(userId, emailType, details) {
    try {
      await prisma.activityLog.create({
        data: {
          userId: userId === 'system' ? 'system' : userId,
          action: `email_${emailType}`,
          details: {
            emailType,
            ...details,
            sentAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      console.error('Email activity logging error:', error);
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get email statistics
   */
  async getEmailStats(dateRange = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const emailLogs = await prisma.activityLog.findMany({
        where: {
          action: {
            startsWith: 'email_'
          },
          createdAt: {
            gte: startDate
          }
        }
      });

      const stats = {
        totalEmails: emailLogs.length,
        emailTypes: {},
        successRate: 0,
        dailyStats: {}
      };

      emailLogs.forEach(log => {
        const emailType = log.action.replace('email_', '');
        stats.emailTypes[emailType] = (stats.emailTypes[emailType] || 0) + 1;

        const date = log.createdAt.toISOString().split('T')[0];
        stats.dailyStats[date] = (stats.dailyStats[date] || 0) + 1;
      });

      return stats;

    } catch (error) {
      console.error('Email stats error:', error);
      return null;
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfig() {
    try {
      const testResult = await this.provider.testConnection();
      return {
        success: true,
        provider: this.provider.constructor.name,
        testResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = EmailService;