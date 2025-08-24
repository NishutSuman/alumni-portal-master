const sgMail = require('@sendgrid/mail');
const BaseEmailProvider = require('./BaseEmailProvider');

class SendGridProvider extends BaseEmailProvider {
  constructor(config) {
    super(config);
    sgMail.setApiKey(config.apiKey);
  }

  async sendEmail(to, subject, htmlContent, data = {}) {
    try {
      const mailOptions = {
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName
        },
        to: to,
        subject: subject,
        html: htmlContent,
        text: this.htmlToText(htmlContent)
      };

      const result = await sgMail.send(mailOptions);
      
      console.log(`✅ Email sent successfully via SendGrid to ${to}`);
      
      return {
        success: true,
        messageId: result[0].headers['x-message-id'],
        to: to,
        subject: subject,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`❌ SendGrid send error to ${to}:`, error);
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
      // SendGrid doesn't have a verify method, so we'll test with API key validation
      const testEmail = {
        to: this.config.fromEmail, // Send test to sender
        from: {
          email: this.config.fromEmail,
          name: this.config.fromName
        },
        subject: 'SendGrid Connection Test',
        html: '<h1>Test Email</h1><p>SendGrid connection is working!</p>',
        text: 'SendGrid connection is working!'
      };

      await sgMail.send(testEmail);
      console.log('✅ SendGrid connection verified');
      return { success: true, message: 'SendGrid connection successful' };
    } catch (error) {
      console.error('❌ SendGrid connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

module.exports = SendGridProvider;