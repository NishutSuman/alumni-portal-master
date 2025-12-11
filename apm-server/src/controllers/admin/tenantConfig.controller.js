// ==========================================
// TENANT EMAIL & PUSH NOTIFICATION CONFIGURATION CONTROLLER
// File: apm-server/src/controllers/admin/tenantConfig.controller.js
// Multi-Tenant Email and Push Notification Configuration Management
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { CacheService } = require('../../config/redis');
const { getTenantFilter, getTenantData, getOrganizationFilter } = require('../../utils/tenant.util');
const TenantEmailManager = require('../../services/email/TenantEmailManager');
const TenantPushNotificationService = require('../../services/TenantPushNotificationService');

// ==========================================
// EMAIL CONFIGURATION ENDPOINTS
// ==========================================

/**
 * Get email configuration for the organization
 * GET /api/admin/tenant-config/email
 * SUPER_ADMIN only
 */
const getEmailConfig = async (req, res) => {
  try {
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true, name: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Get email config (masked)
    const emailConfig = await TenantEmailManager.getEmailConfig(organization.id);

    return successResponse(res, {
      organization: {
        id: organization.id,
        name: organization.name,
        tenantCode: organization.tenantCode
      },
      emailConfig: emailConfig || null,
      isConfigured: !!emailConfig,
      availableProviders: ['SMTP', 'GMAIL', 'SENDGRID', 'RESEND', 'MAILGUN']
    });

  } catch (error) {
    console.error('Get email config error:', error);
    return errorResponse(res, 'Failed to fetch email configuration', 500);
  }
};

/**
 * Save/Update email configuration
 * POST /api/admin/tenant-config/email
 * SUPER_ADMIN only
 */
const saveEmailConfig = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    const tenantFilter = getTenantFilter(req);

    const {
      provider,
      // SMTP settings
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      // API provider settings
      sendgridApiKey,
      resendApiKey,
      mailgunApiKey,
      mailgunDomain,
      // Common settings
      fromEmail,
      fromName,
      replyTo,
      // Branding
      primaryColor,
      secondaryColor,
      logoUrl,
      // Rate limits
      dailyEmailLimit,
      monthlyEmailLimit
    } = req.body;

    // Validation
    if (!provider) {
      return errorResponse(res, 'Email provider is required', 400);
    }

    if (!fromEmail || !fromName) {
      return errorResponse(res, 'From email and name are required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      return errorResponse(res, 'Invalid from email format', 400);
    }

    // Provider-specific validation
    switch (provider) {
      case 'SMTP':
        if (!smtpHost || !smtpUser) {
          return errorResponse(res, 'SMTP host and user are required for SMTP provider', 400);
        }
        break;
      case 'GMAIL':
        if (!smtpUser || !smtpPassword) {
          return errorResponse(res, 'Gmail user and app password are required', 400);
        }
        break;
      case 'SENDGRID':
        if (!sendgridApiKey) {
          return errorResponse(res, 'SendGrid API key is required', 400);
        }
        break;
      case 'RESEND':
        if (!resendApiKey) {
          return errorResponse(res, 'Resend API key is required', 400);
        }
        break;
      case 'MAILGUN':
        if (!mailgunApiKey || !mailgunDomain) {
          return errorResponse(res, 'Mailgun API key and domain are required', 400);
        }
        break;
      default:
        return errorResponse(res, 'Invalid email provider', 400);
    }

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true },
      select: { id: true, name: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Save configuration
    const result = await TenantEmailManager.saveEmailConfig(organization.id, {
      provider,
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpSecure: smtpSecure || false,
      smtpUser,
      smtpPassword,
      sendgridApiKey,
      resendApiKey,
      mailgunApiKey,
      mailgunDomain,
      fromEmail: fromEmail.toLowerCase(),
      fromName,
      replyTo: replyTo || fromEmail.toLowerCase(),
      primaryColor: primaryColor || '#667eea',
      secondaryColor: secondaryColor || '#764ba2',
      logoUrl,
      dailyEmailLimit: dailyEmailLimit || 1000,
      monthlyEmailLimit: monthlyEmailLimit || 25000
    }, adminId);

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to save email configuration', 500);
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'email_config_saved',
        details: {
          organizationId: organization.id,
          provider,
          fromEmail: fromEmail.toLowerCase()
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      message: 'Email configuration saved successfully',
      config: {
        id: result.config.id,
        provider: result.config.provider,
        fromEmail: result.config.fromEmail,
        fromName: result.config.fromName,
        isVerified: result.config.isVerified,
        isActive: result.config.isActive
      },
      nextSteps: [
        'Test email configuration using the test endpoint',
        'Activate configuration after successful test'
      ]
    });

  } catch (error) {
    console.error('Save email config error:', error);
    return errorResponse(res, error.message || 'Failed to save email configuration', 500);
  }
};

/**
 * Test email configuration
 * POST /api/admin/tenant-config/email/test
 * SUPER_ADMIN only
 */
const testEmailConfig = async (req, res) => {
  try {
    const { id: adminId, email: adminEmail } = req.user;
    const tenantFilter = getTenantFilter(req);
    const { testEmail } = req.body;

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true },
      select: { id: true, name: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Test connection
    const testResult = await TenantEmailManager.testTenantEmailConfig(organization.id);

    if (!testResult.success) {
      return errorResponse(res, `Email configuration test failed: ${testResult.error}`, 400);
    }

    // Send test email if test email provided
    if (testEmail || adminEmail) {
      try {
        const service = await TenantEmailManager.getServiceForTenant(organization.tenantCode);

        await service.provider.sendEmail({
          to: testEmail || adminEmail,
          subject: `Test Email from ${organization.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Email Configuration Test</h2>
              <p>This is a test email from your Alumni Portal (${organization.name}).</p>
              <p>If you received this email, your email configuration is working correctly!</p>
              <hr />
              <p style="color: #666; font-size: 12px;">
                Test performed at: ${new Date().toISOString()}<br>
                Organization: ${organization.name}<br>
                Tenant Code: ${organization.tenantCode}
              </p>
            </div>
          `
        });

        testResult.testEmailSent = true;
        testResult.testEmailTo = testEmail || adminEmail;
      } catch (sendError) {
        testResult.testEmailSent = false;
        testResult.testEmailError = sendError.message;
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'email_config_tested',
        details: {
          organizationId: organization.id,
          testResult: testResult.success,
          testEmailSent: testResult.testEmailSent
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      message: 'Email configuration test completed',
      testResult
    });

  } catch (error) {
    console.error('Test email config error:', error);
    return errorResponse(res, 'Failed to test email configuration', 500);
  }
};

/**
 * Activate email configuration
 * POST /api/admin/tenant-config/email/activate
 * SUPER_ADMIN only
 */
const activateEmailConfig = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true, name: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Activate configuration
    const result = await TenantEmailManager.activateEmailConfig(organization.id);

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to activate email configuration', 400);
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'email_config_activated',
        details: {
          organizationId: organization.id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      message: 'Email configuration activated successfully',
      isActive: true
    });

  } catch (error) {
    console.error('Activate email config error:', error);
    return errorResponse(res, 'Failed to activate email configuration', 500);
  }
};

/**
 * Deactivate email configuration (switch back to default)
 * POST /api/admin/tenant-config/email/deactivate
 * SUPER_ADMIN only
 */
const deactivateEmailConfig = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Deactivate configuration
    await prisma.organizationEmailConfig.updateMany({
      where: { organizationId: organization.id },
      data: { isActive: false }
    });

    // Clear cache
    TenantEmailManager.clearTenantCache(organization.tenantCode);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'email_config_deactivated',
        details: {
          organizationId: organization.id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      message: 'Email configuration deactivated. Default system email will be used.',
      isActive: false
    });

  } catch (error) {
    console.error('Deactivate email config error:', error);
    return errorResponse(res, 'Failed to deactivate email configuration', 500);
  }
};

/**
 * Get email usage statistics
 * GET /api/admin/tenant-config/email/stats
 * SUPER_ADMIN only
 */
const getEmailStats = async (req, res) => {
  try {
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Get email config with usage stats
    const emailConfig = await prisma.organizationEmailConfig.findUnique({
      where: { organizationId: organization.id },
      select: {
        provider: true,
        dailyEmailsSent: true,
        monthlyEmailsSent: true,
        dailyEmailLimit: true,
        monthlyEmailLimit: true,
        lastDailyReset: true,
        lastMonthlyReset: true,
        isActive: true,
        isVerified: true
      }
    });

    if (!emailConfig) {
      return successResponse(res, {
        configured: false,
        message: 'Email configuration not set up'
      });
    }

    return successResponse(res, {
      configured: true,
      provider: emailConfig.provider,
      isActive: emailConfig.isActive,
      isVerified: emailConfig.isVerified,
      usage: {
        daily: {
          sent: emailConfig.dailyEmailsSent,
          limit: emailConfig.dailyEmailLimit,
          remaining: emailConfig.dailyEmailLimit - emailConfig.dailyEmailsSent,
          percentUsed: ((emailConfig.dailyEmailsSent / emailConfig.dailyEmailLimit) * 100).toFixed(1)
        },
        monthly: {
          sent: emailConfig.monthlyEmailsSent,
          limit: emailConfig.monthlyEmailLimit,
          remaining: emailConfig.monthlyEmailLimit - emailConfig.monthlyEmailsSent,
          percentUsed: ((emailConfig.monthlyEmailsSent / emailConfig.monthlyEmailLimit) * 100).toFixed(1)
        }
      },
      lastReset: {
        daily: emailConfig.lastDailyReset,
        monthly: emailConfig.lastMonthlyReset
      }
    });

  } catch (error) {
    console.error('Get email stats error:', error);
    return errorResponse(res, 'Failed to fetch email statistics', 500);
  }
};

// ==========================================
// PUSH NOTIFICATION CONFIGURATION ENDPOINTS
// ==========================================

/**
 * Get push notification configuration for the organization
 * GET /api/admin/tenant-config/push
 * SUPER_ADMIN only
 */
const getPushConfig = async (req, res) => {
  try {
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true, name: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Get push config (masked)
    const pushConfig = await prisma.organizationPushConfig.findUnique({
      where: { organizationId: organization.id }
    });

    // Mask sensitive data
    const maskedConfig = pushConfig ? {
      id: pushConfig.id,
      firebaseProjectId: pushConfig.firebaseProjectId,
      firebaseClientEmail: pushConfig.firebaseClientEmail,
      firebasePrivateKey: pushConfig.firebasePrivateKey ? '********' : null,
      vapidPublicKey: pushConfig.vapidPublicKey,
      vapidPrivateKey: pushConfig.vapidPrivateKey ? '********' : null,
      enablePush: pushConfig.enablePush,
      enableEmail: pushConfig.enableEmail,
      dailyPushLimit: pushConfig.dailyPushLimit,
      dailyPushSent: pushConfig.dailyPushSent,
      isActive: pushConfig.isActive,
      isVerified: pushConfig.isVerified,
      createdAt: pushConfig.createdAt,
      updatedAt: pushConfig.updatedAt
    } : null;

    return successResponse(res, {
      organization: {
        id: organization.id,
        name: organization.name,
        tenantCode: organization.tenantCode
      },
      pushConfig: maskedConfig,
      isConfigured: !!pushConfig
    });

  } catch (error) {
    console.error('Get push config error:', error);
    return errorResponse(res, 'Failed to fetch push notification configuration', 500);
  }
};

/**
 * Save/Update push notification configuration
 * POST /api/admin/tenant-config/push
 * SUPER_ADMIN only
 */
const savePushConfig = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    const tenantFilter = getTenantFilter(req);

    const {
      firebaseProjectId,
      firebaseClientEmail,
      firebasePrivateKey,
      vapidPublicKey,
      vapidPrivateKey,
      enablePush,
      enableEmail,
      dailyPushLimit
    } = req.body;

    // Basic validation
    if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
      return errorResponse(res, 'Firebase project ID, client email, and private key are required', 400);
    }

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true },
      select: { id: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Save configuration
    const result = await TenantPushNotificationService.savePushConfig(organization.id, {
      firebaseProjectId,
      firebaseClientEmail,
      firebasePrivateKey,
      vapidPublicKey,
      vapidPrivateKey,
      enablePush: enablePush !== false,
      enableEmail: enableEmail !== false,
      dailyPushLimit: dailyPushLimit || 10000
    }, adminId);

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to save push configuration', 500);
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'push_config_saved',
        details: {
          organizationId: organization.id,
          firebaseProjectId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      message: 'Push notification configuration saved successfully',
      config: {
        id: result.config.id,
        firebaseProjectId: result.config.firebaseProjectId,
        isVerified: result.config.isVerified,
        isActive: result.config.isActive
      },
      nextSteps: [
        'Test push configuration using the test endpoint',
        'Activate configuration after successful test'
      ]
    });

  } catch (error) {
    console.error('Save push config error:', error);
    return errorResponse(res, error.message || 'Failed to save push configuration', 500);
  }
};

/**
 * Test push notification configuration
 * POST /api/admin/tenant-config/push/test
 * SUPER_ADMIN only
 */
const testPushConfig = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    const tenantFilter = getTenantFilter(req);
    const { testToken } = req.body;

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true },
      select: { id: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Test configuration
    const testResult = await TenantPushNotificationService.testPushConfig(
      organization.id,
      testToken
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'push_config_tested',
        details: {
          organizationId: organization.id,
          testResult: testResult.success
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    if (!testResult.success) {
      return errorResponse(res, `Push configuration test failed: ${testResult.error}`, 400);
    }

    return successResponse(res, {
      message: 'Push notification configuration test completed',
      testResult
    });

  } catch (error) {
    console.error('Test push config error:', error);
    return errorResponse(res, 'Failed to test push configuration', 500);
  }
};

/**
 * Activate push notification configuration
 * POST /api/admin/tenant-config/push/activate
 * SUPER_ADMIN only
 */
const activatePushConfig = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Check if verified
    const pushConfig = await prisma.organizationPushConfig.findUnique({
      where: { organizationId: organization.id }
    });

    if (!pushConfig) {
      return errorResponse(res, 'Push configuration not found', 404);
    }

    if (!pushConfig.isVerified) {
      return errorResponse(res, 'Push configuration not verified. Please test first.', 400);
    }

    // Activate
    await prisma.organizationPushConfig.update({
      where: { id: pushConfig.id },
      data: { isActive: true }
    });

    // Clear cache
    TenantPushNotificationService.clearTenantCache(organization.tenantCode);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'push_config_activated',
        details: {
          organizationId: organization.id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      message: 'Push notification configuration activated successfully',
      isActive: true
    });

  } catch (error) {
    console.error('Activate push config error:', error);
    return errorResponse(res, 'Failed to activate push configuration', 500);
  }
};

/**
 * Deactivate push notification configuration
 * POST /api/admin/tenant-config/push/deactivate
 * SUPER_ADMIN only
 */
const deactivatePushConfig = async (req, res) => {
  try {
    const { id: adminId } = req.user;
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true, tenantCode: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Deactivate configuration
    await prisma.organizationPushConfig.updateMany({
      where: { organizationId: organization.id },
      data: { isActive: false }
    });

    // Clear cache
    TenantPushNotificationService.clearTenantCache(organization.tenantCode);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'push_config_deactivated',
        details: {
          organizationId: organization.id
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      message: 'Push notification configuration deactivated. Default system push will be used.',
      isActive: false
    });

  } catch (error) {
    console.error('Deactivate push config error:', error);
    return errorResponse(res, 'Failed to deactivate push configuration', 500);
  }
};

/**
 * Get push notification usage statistics
 * GET /api/admin/tenant-config/push/stats
 * SUPER_ADMIN only
 */
const getPushStats = async (req, res) => {
  try {
    // Use getOrganizationFilter for Organization model queries (uses 'id' not 'organizationId')
    const orgFilter = getOrganizationFilter(req);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...orgFilter, isActive: true },
      select: { id: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Get push config with usage stats
    const pushConfig = await prisma.organizationPushConfig.findUnique({
      where: { organizationId: organization.id },
      select: {
        firebaseProjectId: true,
        dailyPushSent: true,
        dailyPushLimit: true,
        lastDailyReset: true,
        enablePush: true,
        enableEmail: true,
        isActive: true,
        isVerified: true
      }
    });

    if (!pushConfig) {
      return successResponse(res, {
        configured: false,
        message: 'Push configuration not set up'
      });
    }

    // Get device token count
    const deviceTokenCount = await prisma.userDeviceToken.count({
      where: {
        organizationId: organization.id,
        isActive: true
      }
    });

    // Get platform breakdown
    const platformBreakdown = await prisma.userDeviceToken.groupBy({
      by: ['platform'],
      where: {
        organizationId: organization.id,
        isActive: true
      },
      _count: { id: true }
    });

    return successResponse(res, {
      configured: true,
      firebaseProjectId: pushConfig.firebaseProjectId,
      isActive: pushConfig.isActive,
      isVerified: pushConfig.isVerified,
      settings: {
        enablePush: pushConfig.enablePush,
        enableEmail: pushConfig.enableEmail
      },
      usage: {
        daily: {
          sent: pushConfig.dailyPushSent,
          limit: pushConfig.dailyPushLimit,
          remaining: pushConfig.dailyPushLimit - pushConfig.dailyPushSent,
          percentUsed: ((pushConfig.dailyPushSent / pushConfig.dailyPushLimit) * 100).toFixed(1)
        }
      },
      deviceTokens: {
        total: deviceTokenCount,
        byPlatform: platformBreakdown.reduce((acc, item) => {
          acc[item.platform] = item._count.id;
          return acc;
        }, {})
      },
      lastReset: pushConfig.lastDailyReset
    });

  } catch (error) {
    console.error('Get push stats error:', error);
    return errorResponse(res, 'Failed to fetch push statistics', 500);
  }
};

// ==========================================
// DEVICE TOKEN MANAGEMENT ENDPOINTS
// ==========================================

/**
 * Register device token for current user
 * POST /api/tenant-config/device-token
 * Any authenticated user
 */
const registerDeviceToken = async (req, res) => {
  try {
    const { id: userId, organizationId } = req.user;
    const { token, platform, deviceId } = req.body;

    if (!token || !platform) {
      return errorResponse(res, 'Token and platform are required', 400);
    }

    if (!['IOS', 'ANDROID', 'WEB', 'PWA'].includes(platform.toUpperCase())) {
      return errorResponse(res, 'Invalid platform. Must be IOS, ANDROID, WEB, or PWA', 400);
    }

    // Get tenant code
    let tenantCode = null;
    if (organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { tenantCode: true }
      });
      tenantCode = org?.tenantCode;
    }

    // Register token
    const result = await TenantPushNotificationService.registerDeviceToken(
      tenantCode,
      userId,
      token,
      platform.toUpperCase(),
      deviceId,
      organizationId
    );

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to register device token', 500);
    }

    return successResponse(res, {
      message: 'Device token registered successfully',
      tokenId: result.tokenId
    });

  } catch (error) {
    console.error('Register device token error:', error);
    return errorResponse(res, 'Failed to register device token', 500);
  }
};

/**
 * Remove device token
 * DELETE /api/tenant-config/device-token
 * Any authenticated user
 */
const removeDeviceToken = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { token } = req.body;

    if (!token) {
      return errorResponse(res, 'Token is required', 400);
    }

    // Deactivate token
    await prisma.userDeviceToken.updateMany({
      where: {
        userId,
        token
      },
      data: { isActive: false }
    });

    return successResponse(res, {
      message: 'Device token removed successfully'
    });

  } catch (error) {
    console.error('Remove device token error:', error);
    return errorResponse(res, 'Failed to remove device token', 500);
  }
};

/**
 * Get user's device tokens
 * GET /api/tenant-config/device-tokens
 * Any authenticated user
 */
const getUserDeviceTokens = async (req, res) => {
  try {
    const { id: userId } = req.user;

    const tokens = await prisma.userDeviceToken.findMany({
      where: {
        userId,
        isActive: true
      },
      select: {
        id: true,
        platform: true,
        deviceId: true,
        createdAt: true,
        lastUsedAt: true
      },
      orderBy: { lastUsedAt: 'desc' }
    });

    return successResponse(res, {
      tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error('Get user device tokens error:', error);
    return errorResponse(res, 'Failed to fetch device tokens', 500);
  }
};

module.exports = {
  // Email configuration
  getEmailConfig,
  saveEmailConfig,
  testEmailConfig,
  activateEmailConfig,
  deactivateEmailConfig,
  getEmailStats,

  // Push notification configuration
  getPushConfig,
  savePushConfig,
  testPushConfig,
  activatePushConfig,
  deactivatePushConfig,
  getPushStats,

  // Device token management
  registerDeviceToken,
  removeDeviceToken,
  getUserDeviceTokens
};
