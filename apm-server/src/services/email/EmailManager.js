const EmailService = require('./EmailService');
const { EmailProviderFactory } = require('./providers');

class EmailManager {
  constructor() {
    this.emailService = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      const config = this.getEmailConfig();
      const provider = EmailProviderFactory.create(config.provider, config);
      
      // Test the connection
      const testResult = await provider.testConnection();
      if (!testResult.success) {
        throw new Error(`Email provider test failed: ${testResult.error}`);
      }

      this.emailService = await EmailService.create(provider);
      this.isInitialized = true;
      
      console.log(`✅ Email system initialized with ${config.provider.toUpperCase()}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Email system initialization failed:', error);
      this.isInitialized = false;
      return { success: false, error: error.message };
    }
  }

  getEmailConfig() {
    const provider = process.env.EMAIL_PROVIDER || 'gmail';

    const configs = {
      gmail: {
        provider: 'gmail',
        user: process.env.GMAIL_USER,
        password: process.env.GMAIL_APP_PASSWORD,
        fromName: process.env.EMAIL_FROM_NAME || 'Alumni Portal'
      },

      sendgrid: {
        provider: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        fromName: process.env.EMAIL_FROM_NAME || 'Alumni Portal'
      },

      resend: {
        provider: 'resend',
        apiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev',
        fromName: process.env.EMAIL_FROM_NAME || 'Alumni Portal'
      }
    };

    const config = configs[provider];
    if (!config) {
      throw new Error(`No configuration found for provider: ${provider}`);
    }

    // Validate required fields
    this.validateConfig(provider, config);

    return config;
  }

  validateConfig(provider, config) {
    const requiredFields = {
      gmail: ['user', 'password'],
      sendgrid: ['apiKey', 'fromEmail'],
      resend: ['apiKey']
    };

    const required = requiredFields[provider];
    if (!required) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field '${field}' for ${provider} provider`);
      }
    }
  }

  getService() {
    if (!this.isInitialized || !this.emailService) {
      throw new Error('Email service not initialized. Call initialize() first.');
    }
    return this.emailService;
  }

  async testEmailSystem() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const testResult = await this.emailService.testEmailConfig();
      return testResult;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new EmailManager();