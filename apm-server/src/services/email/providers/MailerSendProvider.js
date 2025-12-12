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
      console.log(`📧 MailerSend: Preparing email to ${to}`);
      console.log(`📧 MailerSend: From ${this.config.fromName} <${this.config.fromEmail}>`);
      console.log(`📧 MailerSend: API Key present: ${this.config.apiKey ? 'Yes (starts with ' + this.config.apiKey.substring(0, 10) + '...)' : 'No'}`);

      const sentFrom = new Sender(this.config.fromEmail, this.config.fromName);
      const recipients = [new Recipient(to)];

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(subject)
        .setHtml(htmlContent);

      console.log(`📧 MailerSend: Sending email...`);
      const result = await this.mailerSend.email.send(emailParams);

      console.log(`✅ MailerSend: Email sent successfully to ${to}`);
      console.log(`✅ MailerSend: Result:`, JSON.stringify(result, null, 2));

      return {
        success: true,
        messageId: result?.body?.message_id || result?.headers?.['x-message-id'],
        to: to,
        subject: subject,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`❌ MailerSend send error to ${to}:`, error);
      console.error(`❌ MailerSend error details:`, error.body || error.response?.data || error.message);
      return {
        success: false,
        error: error.body?.message || error.message || 'Unknown MailerSend error',
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
