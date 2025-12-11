// src/services/email/TenantEmailManager.js
// Multi-Tenant Email Service Manager - Supports client domain emails

const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const EmailService = require('./EmailService');
const { EmailProviderFactory } = require('./providers');

const prisma = new PrismaClient();

// Encryption key for sensitive data (should be in env)
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const ENCRYPTION_IV_LENGTH = 16;

/**
 * Encrypt sensitive data like passwords and API keys
 */
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt sensitive data
 */
function decrypt(text) {
  if (!text) return null;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

class TenantEmailManager {
  constructor() {
    // Cache for tenant email services (to avoid recreating on every request)
    this.tenantServicesCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache

    // Default email manager (fallback)
    this.defaultEmailManager = require('./EmailManager');
  }

  /**
   * Get email service for a specific tenant
   * @param {string} tenantCode - Organization tenant code
   * @returns {Promise<Object>} Email service instance
   */
  async getServiceForTenant(tenantCode) {
    try {
      // Check cache first
      const cached = this.tenantServicesCache.get(tenantCode);
      if (cached && cached.expiry > Date.now()) {
        return cached.service;
      }

      // If no tenant code or default, use system email
      if (!tenantCode || tenantCode === 'default') {
        return this.getDefaultService();
      }

      // Fetch tenant email configuration from database
      const emailConfig = await prisma.organizationEmailConfig.findFirst({
        where: {
          organization: { tenantCode },
          isActive: true,
          isVerified: true
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              tenantCode: true
            }
          }
        }
      });

      // If no tenant config or not active/verified, use default
      if (!emailConfig) {
        console.log(`📧 No active email config for tenant ${tenantCode}, using default`);
        return this.getDefaultService();
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimits(emailConfig);
      if (!rateLimitCheck.allowed) {
        console.warn(`⚠️ Rate limit exceeded for tenant ${tenantCode}: ${rateLimitCheck.reason}`);
        // Fall back to default but log the issue
        return this.getDefaultService();
      }

      // Create tenant-specific email service
      const service = await this.createTenantEmailService(emailConfig);

      // Cache the service
      this.tenantServicesCache.set(tenantCode, {
        service,
        expiry: Date.now() + this.cacheExpiry,
        configId: emailConfig.id
      });

      return service;
    } catch (error) {
      console.error(`Error getting email service for tenant ${tenantCode}:`, error);
      return this.getDefaultService();
    }
  }

  /**
   * Create tenant-specific email service based on configuration
   */
  async createTenantEmailService(config) {
    const provider = await this.createProviderFromConfig(config);
    const service = await EmailService.create(provider);

    // Add tenant context to service
    service.tenantConfig = {
      organizationId: config.organizationId,
      tenantCode: config.organization?.tenantCode,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      primaryColor: config.primaryColor,
      logoUrl: config.logoUrl
    };

    return service;
  }

  /**
   * Create email provider from tenant configuration
   */
  async createProviderFromConfig(config) {
    const providerType = config.provider;

    switch (providerType) {
      case 'SMTP':
        return this.createSmtpProvider(config);
      case 'GMAIL':
        return this.createGmailProvider(config);
      case 'SENDGRID':
        return this.createSendGridProvider(config);
      case 'RESEND':
        return this.createResendProvider(config);
      case 'MAILGUN':
        return this.createMailgunProvider(config);
      case 'MAILERSEND':
        return this.createMailerSendProvider(config);
      case 'SES':
        return this.createSesProvider(config);
      default:
        throw new Error(`Unsupported email provider: ${providerType}`);
    }
  }

  /**
   * Create SMTP provider for custom domain emails
   */
  createSmtpProvider(config) {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.smtpSecure || false,
      auth: {
        user: config.smtpUser,
        pass: decrypt(config.smtpPassword)
      },
      tls: {
        rejectUnauthorized: false // For self-signed certificates
      }
    });

    return {
      type: 'smtp',
      transporter,
      config: {
        fromEmail: config.fromEmail,
        fromName: config.fromName
      },
      sendEmail: async (to, subject, html, data = {}) => {
        const mailOptions = {
          from: `${config.fromName} <${config.fromEmail}>`,
          to,
          subject,
          html,
          replyTo: config.replyTo || config.fromEmail
        };

        const info = await transporter.sendMail(mailOptions);
        return {
          success: true,
          messageId: info.messageId,
          to,
          subject
        };
      },
      testConnection: async () => {
        try {
          await transporter.verify();
          return { success: true, message: 'SMTP connection verified' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  /**
   * Create Gmail provider
   */
  createGmailProvider(config) {
    const GmailProvider = require('./providers/GmailProvider');
    return new GmailProvider({
      user: config.smtpUser,
      password: decrypt(config.smtpPassword),
      fromName: config.fromName
    });
  }

  /**
   * Create SendGrid provider
   */
  createSendGridProvider(config) {
    const SendGridProvider = require('./providers/SendGridProvider');
    return new SendGridProvider({
      apiKey: decrypt(config.sendgridApiKey),
      fromEmail: config.fromEmail,
      fromName: config.fromName
    });
  }

  /**
   * Create Resend provider
   */
  createResendProvider(config) {
    const ResendProvider = require('./providers/ResendProvider');
    return new ResendProvider({
      apiKey: decrypt(config.resendApiKey),
      fromEmail: config.fromEmail,
      fromName: config.fromName
    });
  }

  /**
   * Create Mailgun provider
   */
  createMailgunProvider(config) {
    // Mailgun implementation
    const formData = require('form-data');
    const Mailgun = require('mailgun.js');
    const mailgun = new Mailgun(formData);

    const mg = mailgun.client({
      username: 'api',
      key: decrypt(config.mailgunApiKey)
    });

    return {
      type: 'mailgun',
      client: mg,
      domain: config.mailgunDomain,
      config: {
        fromEmail: config.fromEmail,
        fromName: config.fromName
      },
      sendEmail: async (to, subject, html) => {
        const result = await mg.messages.create(config.mailgunDomain, {
          from: `${config.fromName} <${config.fromEmail}>`,
          to: [to],
          subject,
          html
        });
        return {
          success: true,
          messageId: result.id,
          to,
          subject
        };
      },
      testConnection: async () => {
        try {
          await mg.domains.get(config.mailgunDomain);
          return { success: true, message: 'Mailgun connection verified' };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    };
  }

  /**
   * Create MailerSend provider
   */
  createMailerSendProvider(config) {
    const MailerSendProvider = require('./providers/MailerSendProvider');
    return new MailerSendProvider({
      apiKey: decrypt(config.mailersendApiKey),
      fromEmail: config.fromEmail,
      fromName: config.fromName
    });
  }

  /**
   * Create AWS SES provider
   */
  createSesProvider(config) {
    // AWS SES implementation would go here
    throw new Error('AWS SES provider not yet implemented');
  }

  /**
   * Get default system email service
   */
  getDefaultService() {
    if (!this.defaultEmailManager.isInitialized) {
      this.defaultEmailManager.initialize();
    }
    return this.defaultEmailManager.getService();
  }

  /**
   * Check rate limits for tenant
   */
  async checkRateLimits(config) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Reset counters if needed
    if (!config.lastDailyReset || config.lastDailyReset < startOfDay) {
      await prisma.organizationEmailConfig.update({
        where: { id: config.id },
        data: {
          dailyEmailsSent: 0,
          lastDailyReset: startOfDay
        }
      });
      config.dailyEmailsSent = 0;
    }

    if (!config.lastMonthlyReset || config.lastMonthlyReset < startOfMonth) {
      await prisma.organizationEmailConfig.update({
        where: { id: config.id },
        data: {
          monthlyEmailsSent: 0,
          lastMonthlyReset: startOfMonth
        }
      });
      config.monthlyEmailsSent = 0;
    }

    // Check limits
    if (config.dailyEmailsSent >= config.dailyEmailLimit) {
      return { allowed: false, reason: 'Daily email limit exceeded' };
    }

    if (config.monthlyEmailsSent >= config.monthlyEmailLimit) {
      return { allowed: false, reason: 'Monthly email limit exceeded' };
    }

    return { allowed: true };
  }

  /**
   * Increment email counter for tenant
   */
  async incrementEmailCount(configId) {
    try {
      await prisma.organizationEmailConfig.update({
        where: { id: configId },
        data: {
          dailyEmailsSent: { increment: 1 },
          monthlyEmailsSent: { increment: 1 }
        }
      });
    } catch (error) {
      console.error('Error incrementing email count:', error);
    }
  }

  /**
   * Send email using tenant's configuration
   */
  async sendEmail(tenantCode, options) {
    try {
      const service = await this.getServiceForTenant(tenantCode);

      // Get cached config ID for incrementing counter
      const cached = this.tenantServicesCache.get(tenantCode);

      const result = await service.provider.sendEmail(
        options.to,
        options.subject,
        options.html,
        options.data || {}
      );

      // Increment counter if using tenant config
      if (cached?.configId) {
        await this.incrementEmailCount(cached.configId);
      }

      return result;
    } catch (error) {
      console.error(`Error sending email for tenant ${tenantCode}:`, error);
      throw error;
    }
  }

  /**
   * Test tenant email configuration
   */
  async testTenantEmailConfig(organizationId) {
    try {
      const config = await prisma.organizationEmailConfig.findUnique({
        where: { organizationId }
      });

      if (!config) {
        return { success: false, error: 'No email configuration found' };
      }

      const provider = await this.createProviderFromConfig(config);
      const testResult = await provider.testConnection();

      // Update test results in database
      await prisma.organizationEmailConfig.update({
        where: { id: config.id },
        data: {
          lastTestedAt: new Date(),
          lastTestResult: JSON.stringify(testResult),
          isVerified: testResult.success
        }
      });

      return testResult;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Save/Update tenant email configuration
   */
  async saveEmailConfig(organizationId, configData, userId) {
    try {
      // Encrypt sensitive fields
      const encryptedData = { ...configData };

      if (configData.smtpPassword) {
        encryptedData.smtpPassword = encrypt(configData.smtpPassword);
      }
      if (configData.sendgridApiKey) {
        encryptedData.sendgridApiKey = encrypt(configData.sendgridApiKey);
      }
      if (configData.resendApiKey) {
        encryptedData.resendApiKey = encrypt(configData.resendApiKey);
      }
      if (configData.mailgunApiKey) {
        encryptedData.mailgunApiKey = encrypt(configData.mailgunApiKey);
      }
      if (configData.mailersendApiKey) {
        encryptedData.mailersendApiKey = encrypt(configData.mailersendApiKey);
      }

      // Generate verification token for domain verification
      if (!configData.verificationToken) {
        encryptedData.verificationToken = crypto.randomBytes(32).toString('hex');
      }

      const existingConfig = await prisma.organizationEmailConfig.findUnique({
        where: { organizationId }
      });

      let result;
      if (existingConfig) {
        result = await prisma.organizationEmailConfig.update({
          where: { organizationId },
          data: {
            ...encryptedData,
            updatedBy: userId,
            isVerified: false, // Reset verification on config change
            isActive: false
          }
        });
      } else {
        result = await prisma.organizationEmailConfig.create({
          data: {
            organizationId,
            ...encryptedData,
            createdBy: userId,
            isVerified: false,
            isActive: false
          }
        });
      }

      // Clear cache for this tenant
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { tenantCode: true }
      });
      if (org?.tenantCode) {
        this.tenantServicesCache.delete(org.tenantCode);
      }

      return {
        success: true,
        config: result,
        verificationToken: encryptedData.verificationToken
      };
    } catch (error) {
      console.error('Error saving email config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Activate tenant email configuration after verification
   */
  async activateEmailConfig(organizationId) {
    try {
      const config = await prisma.organizationEmailConfig.findUnique({
        where: { organizationId }
      });

      if (!config) {
        return { success: false, error: 'No email configuration found' };
      }

      if (!config.isVerified) {
        return { success: false, error: 'Email configuration not verified. Please test first.' };
      }

      await prisma.organizationEmailConfig.update({
        where: { id: config.id },
        data: { isActive: true }
      });

      // Clear cache
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { tenantCode: true }
      });
      if (org?.tenantCode) {
        this.tenantServicesCache.delete(org.tenantCode);
      }

      return { success: true, message: 'Email configuration activated' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get email configuration for organization (with masked sensitive data)
   */
  async getEmailConfig(organizationId) {
    try {
      const config = await prisma.organizationEmailConfig.findUnique({
        where: { organizationId },
        include: {
          organization: {
            select: {
              name: true,
              tenantCode: true
            }
          }
        }
      });

      if (!config) {
        return null;
      }

      // Mask sensitive fields
      return {
        ...config,
        smtpPassword: config.smtpPassword ? '********' : null,
        sendgridApiKey: config.sendgridApiKey ? '********' : null,
        resendApiKey: config.resendApiKey ? '********' : null,
        mailgunApiKey: config.mailgunApiKey ? '********' : null,
        mailersendApiKey: config.mailersendApiKey ? '********' : null
      };
    } catch (error) {
      console.error('Error getting email config:', error);
      return null;
    }
  }

  /**
   * Generate DNS verification records for domain
   */
  generateDnsRecords(domain, verificationToken) {
    return {
      verification: {
        type: 'TXT',
        name: `_alumni-portal-verify.${domain}`,
        value: verificationToken
      },
      spf: {
        type: 'TXT',
        name: domain,
        value: 'v=spf1 include:_spf.google.com ~all' // Adjust based on provider
      },
      dkim: {
        type: 'TXT',
        name: `alumni-portal._domainkey.${domain}`,
        value: 'Configured by email provider'
      }
    };
  }

  /**
   * Clear cache for a specific tenant
   */
  clearTenantCache(tenantCode) {
    this.tenantServicesCache.delete(tenantCode);
  }

  /**
   * Clear all cached services
   */
  clearAllCache() {
    this.tenantServicesCache.clear();
  }
}

// Export singleton instance
module.exports = new TenantEmailManager();
