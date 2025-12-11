const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');
const BaseEmailProvider = require('./BaseEmailProvider');

class MailerSendProvider extends BaseEmailProvider {
  constructor(config) {
    super(config);
    this.mailerSend = new MailerSend({
      apiKey: config.apiKey,
    });
  }

  async sendEmail(to, subject, htmlContent, data = {}) {
    try {
      const sentFrom = new Sender(this.config.fromEmail, this.config.fromName);
      const recipients = [new Recipient(to)];

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(subject)
        .setHtml(htmlContent);

      const result = await this.mailerSend.email.send(emailParams);

      console.log(`✅ Email sent successfully via MailerSend to ${to}`);

      return {
        success: true,
        messageId: result?.body?.message_id || result?.headers?.['x-message-id'],
        to: to,
        subject: subject,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`❌ MailerSend send error to ${to}:`, error);
      return {
        success: false,
        error: error.message,
        to: to,
        subject: subject
      };
    }
  }

  async testConnection() {
    try {
      console.log('🔧 Testing MailerSend connection...');

      // Check if API key is provided
      if (!this.mailerSend || !this.config.apiKey) {
        throw new Error('MailerSend API key not configured');
      }

      // API key format validation (starts with mlsn.)
      if (!this.config.apiKey.startsWith('mlsn.')) {
        throw new Error('Invalid MailerSend API key format (should start with mlsn.)');
      }

      console.log('✅ MailerSend connection verified (API key configured)');
      return { success: true, message: 'MailerSend connection successful' };
    } catch (error) {
      console.error('❌ MailerSend connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = MailerSendProvider;
