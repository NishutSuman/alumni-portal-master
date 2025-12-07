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
      // Resend validates API key when sending, so we just check if client is created
      // We can also try to send a test email or use domains API
      console.log('🔧 Testing Resend connection...');

      // Try to list domains to verify API key is valid
      const domains = await this.resend.domains.list();

      if (domains.error) {
        throw new Error(domains.error.message);
      }

      console.log('✅ Resend connection verified');
      return { success: true, message: 'Resend connection successful' };
    } catch (error) {
      console.error('❌ Resend connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ResendProvider;
