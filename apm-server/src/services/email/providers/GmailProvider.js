const nodemailer = require('nodemailer');
const BaseEmailProvider = require('./BaseEmailProvider');

class GmailProvider extends BaseEmailProvider {
  constructor(config) {
    super(config);
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: config.user,
        pass: config.password // App password, not regular password
      }
    });
  }

  async sendEmail(to, subject, htmlContent, data = {}) {
    try {
      const mailOptions = {
        from: `${this.config.fromName} <${this.config.user}>`,
        to: to,
        subject: subject,
        html: htmlContent,
        text: this.htmlToText(htmlContent) // Fallback text version
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully to ${to}: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        to: to,
        subject: subject,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`❌ Gmail send error to ${to}:`, error);
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
      await this.transporter.verify();
      console.log('✅ Gmail connection verified');
      return { success: true, message: 'Gmail connection successful' };
    } catch (error) {
      console.error('❌ Gmail connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  htmlToText(html) {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

module.exports = GmailProvider;