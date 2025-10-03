const nodemailer = require('nodemailer');
const BaseEmailProvider = require('./BaseEmailProvider');

class GmailProvider extends BaseEmailProvider {
  constructor(config) {
    super(config);
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.user,
        pass: config.password // App password, not regular password
      }
    });
  }

  async sendEmail(emailOptions) {
    try {
      // Handle both object and individual parameters for backward compatibility
      const options = typeof emailOptions === 'object' && emailOptions.to 
        ? emailOptions 
        : { to: arguments[0], subject: arguments[1], html: arguments[2], data: arguments[3] || {} };
        
      const mailOptions = {
        from: `${this.config.fromName} <${this.config.user}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: this.htmlToText(options.html) // Fallback text version
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully to ${options.to}: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        to: options.to,
        subject: options.subject,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`❌ Gmail send error to ${options?.to || 'unknown'}:`, error);
      return {
        success: false,
        error: error.message,
        to: options?.to || 'unknown',
        subject: options?.subject || 'unknown'
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