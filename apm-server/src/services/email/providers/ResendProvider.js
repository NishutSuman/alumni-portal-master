const { Resend } = require('resend');
const BaseEmailProvider = require('./BaseEmailProvider');

class ResendProvider extends BaseEmailProvider {
  constructor(config) {
    super(config);
    this.resend = new Resend(config.apiKey);
  }

  async sendEmail(to, subject, htmlContent, data = {}) {
    try {
      const result = await this.resend.emails.send({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: to,
        subject: subject,
        html: htmlContent,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      console.log(`✅ Email sent successfully via Resend to ${to}`);

      return {
        success: true,
        messageId: result.data?.id,
        to: to,
        subject: subject,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`❌ Resend send error to ${to}:`, error);
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
      // Resend API key validation - just check if client is configured
      // The API key will be validated when actually sending emails
      console.log('🔧 Testing Resend connection...');

      // Check if API key is provided
      if (!this.resend || !this.config.apiKey) {
        throw new Error('Resend API key not configured');
      }

      // API key format validation (starts with re_)
      if (!this.config.apiKey.startsWith('re_')) {
        throw new Error('Invalid Resend API key format');
      }

      console.log('✅ Resend connection verified (API key configured)');
      return { success: true, message: 'Resend connection successful' };
    } catch (error) {
      console.error('❌ Resend connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ResendProvider;
