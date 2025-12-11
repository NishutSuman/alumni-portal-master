// src/services/TenantPushNotificationService.js
// Multi-Tenant Push Notification Service - Supports tenant-specific Firebase/APNs configuration

const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Encryption key for sensitive data
const ENCRYPTION_KEY = process.env.PUSH_ENCRYPTION_KEY || process.env.EMAIL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const ENCRYPTION_IV_LENGTH = 16;

/**
 * Encrypt sensitive data
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

class TenantPushNotificationService {
  constructor() {
    // Cache for tenant Firebase apps
    this.tenantAppsCache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes cache

    // Default push notification service
    this.defaultService = require('../utils/push-notification.util');

    // Track initialized apps
    this.initializedApps = new Set();
  }

  /**
   * Get Firebase messaging instance for a specific tenant
   * @param {string} tenantCode - Organization tenant code
   * @returns {Promise<Object>} Firebase messaging instance or mock service
   */
  async getMessagingForTenant(tenantCode) {
    try {
      // Check cache first
      const cached = this.tenantAppsCache.get(tenantCode);
      if (cached && cached.expiry > Date.now()) {
        return cached.messaging;
      }

      // If no tenant code or default, use system Firebase
      if (!tenantCode || tenantCode === 'default') {
        return this.getDefaultMessaging();
      }

      // Fetch tenant push configuration from database
      const pushConfig = await prisma.organizationPushConfig.findFirst({
        where: {
          organization: { tenantCode },
          isActive: true,
          isConfigured: true
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

      // If no tenant config or not active, use default
      if (!pushConfig || !pushConfig.firebaseProjectId) {
        console.log(`📱 No active push config for tenant ${tenantCode}, using default`);
        return this.getDefaultMessaging();
      }

      // Check rate limits
      const rateLimitCheck = await this.checkRateLimits(pushConfig);
      if (!rateLimitCheck.allowed) {
        console.warn(`⚠️ Push rate limit exceeded for tenant ${tenantCode}: ${rateLimitCheck.reason}`);
        return this.getDefaultMessaging();
      }

      // Create tenant-specific Firebase app
      const messaging = await this.createTenantFirebaseMessaging(tenantCode, pushConfig);

      // Cache the messaging instance
      this.tenantAppsCache.set(tenantCode, {
        messaging,
        expiry: Date.now() + this.cacheExpiry,
        configId: pushConfig.id,
        config: pushConfig
      });

      return messaging;
    } catch (error) {
      console.error(`Error getting push service for tenant ${tenantCode}:`, error);
      return this.getDefaultMessaging();
    }
  }

  /**
   * Create tenant-specific Firebase messaging instance
   */
  async createTenantFirebaseMessaging(tenantCode, config) {
    const appName = `tenant-${tenantCode}`;

    // Check if app already exists
    const existingApp = admin.apps.find(app => app.name === appName);
    if (existingApp) {
      return existingApp.messaging();
    }

    try {
      // Initialize tenant-specific Firebase app
      const firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebaseProjectId,
          clientEmail: config.firebaseClientEmail,
          privateKey: decrypt(config.firebasePrivateKey)?.replace(/\\n/g, '\n')
        }),
        projectId: config.firebaseProjectId
      }, appName);

      this.initializedApps.add(appName);
      console.log(`✅ Firebase app initialized for tenant ${tenantCode}`);

      return firebaseApp.messaging();
    } catch (error) {
      console.error(`❌ Failed to initialize Firebase for tenant ${tenantCode}:`, error.message);
      return this.getDefaultMessaging();
    }
  }

  /**
   * Get default system Firebase messaging
   */
  getDefaultMessaging() {
    return this.defaultService;
  }

  /**
   * Send notification to single token for a tenant
   */
  async sendToToken(tenantCode, options) {
    try {
      const { token, title, body, data = {}, priority = 'normal' } = options;

      // Get cached config for this tenant
      const cached = this.tenantAppsCache.get(tenantCode);
      const messaging = await this.getMessagingForTenant(tenantCode);

      // If using default service (mock mode or system Firebase)
      if (messaging === this.defaultService) {
        return await this.defaultService.sendToToken(options);
      }

      // Build message with tenant branding
      const pushConfig = cached?.config;
      const message = {
        token,
        notification: {
          title,
          body
        },
        data: this.sanitizeData(data),
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(data.type),
            priority: priority === 'high' ? 'high' : 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            icon: pushConfig?.defaultIcon || undefined
          }
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: pushConfig?.defaultSound || 'default',
              badge: 1
            }
          },
          headers: {
            'apns-priority': priority === 'high' ? '10' : '5'
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: pushConfig?.defaultIcon || '/icons/icon-192x192.png',
            badge: pushConfig?.defaultBadge || '/icons/badge-72x72.png',
            tag: data.type || 'default',
            requireInteraction: priority === 'high'
          }
        }
      };

      const response = await messaging.send(message);

      // Increment counter
      if (cached?.configId) {
        await this.incrementPushCount(cached.configId);
      }

      console.log(`✅ Push notification sent for tenant ${tenantCode}:`, response);

      return {
        success: true,
        messageId: response,
        token,
        tenantCode
      };
    } catch (error) {
      console.error(`❌ Send to token error for tenant ${tenantCode}:`, error);

      if (error.code === 'messaging/registration-token-not-registered') {
        // Mark token as invalid
        await this.markTokenInvalid(token);
        return {
          success: false,
          error: 'TOKEN_INVALID',
          message: 'Token no longer valid'
        };
      }

      return {
        success: false,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Send notification to multiple tokens for a tenant
   */
  async sendToTokens(tenantCode, options) {
    try {
      const { tokens, title, body, data = {}, priority = 'normal' } = options;

      if (!tokens || tokens.length === 0) {
        return { success: false, error: 'No tokens provided', successCount: 0, failureCount: 0 };
      }

      const messaging = await this.getMessagingForTenant(tenantCode);

      // If using default service
      if (messaging === this.defaultService) {
        return await this.defaultService.sendToTokens(options);
      }

      const cached = this.tenantAppsCache.get(tenantCode);
      const pushConfig = cached?.config;

      const message = {
        notification: { title, body },
        data: this.sanitizeData(data),
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: this.getChannelId(data.type),
            priority: priority === 'high' ? 'high' : 'default',
            defaultSound: true,
            icon: pushConfig?.defaultIcon || undefined
          }
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: pushConfig?.defaultSound || 'default',
              badge: 1
            }
          }
        },
        webpush: {
          notification: {
            title,
            body,
            icon: pushConfig?.defaultIcon || '/icons/icon-192x192.png',
            badge: pushConfig?.defaultBadge || '/icons/badge-72x72.png',
            tag: data.type || 'default'
          }
        },
        tokens: tokens.slice(0, 500) // FCM limit
      };

      const response = await messaging.sendEachForMulticast(message);

      // Increment counter
      if (cached?.configId) {
        await this.incrementPushCount(cached.configId, response.successCount);
      }

      // Process failures
      const invalidTokens = [];
      if (response.failureCount > 0) {
        response.responses.forEach((resp, index) => {
          if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[index]);
          }
        });

        // Mark invalid tokens
        if (invalidTokens.length > 0) {
          await this.markTokensInvalid(invalidTokens);
        }
      }

      console.log(`✅ Multicast sent for tenant ${tenantCode} - Success: ${response.successCount}, Failure: ${response.failureCount}`);

      return {
        success: response.failureCount === 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
        tenantCode
      };
    } catch (error) {
      console.error(`❌ Send to tokens error for tenant ${tenantCode}:`, error);
      return {
        success: false,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message,
        successCount: 0,
        failureCount: options.tokens?.length || 0
      };
    }
  }

  /**
   * Send to topic for a tenant
   */
  async sendToTopic(tenantCode, options) {
    try {
      const { topic, title, body, data = {}, priority = 'normal' } = options;

      const messaging = await this.getMessagingForTenant(tenantCode);

      // If using default service
      if (messaging === this.defaultService) {
        return await this.defaultService.sendToTopic(options);
      }

      // Prefix topic with tenant code for isolation
      const tenantTopic = `${tenantCode}_${topic}`;

      const message = {
        topic: tenantTopic,
        notification: { title, body },
        data: this.sanitizeData(data),
        android: {
          priority: priority === 'high' ? 'high' : 'normal'
        },
        apns: {
          payload: {
            aps: {
              alert: { title, body },
              sound: 'default'
            }
          }
        }
      };

      const response = await messaging.send(message);

      const cached = this.tenantAppsCache.get(tenantCode);
      if (cached?.configId) {
        await this.incrementPushCount(cached.configId);
      }

      return {
        success: true,
        messageId: response,
        topic: tenantTopic,
        tenantCode
      };
    } catch (error) {
      console.error(`❌ Send to topic error for tenant ${tenantCode}:`, error);
      return {
        success: false,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message
      };
    }
  }

  /**
   * Register device token for user
   */
  async registerDeviceToken(userId, tokenData, organizationId = null) {
    try {
      const { token, platform, deviceId, deviceName, appVersion } = tokenData;

      // Upsert device token
      const deviceToken = await prisma.userDeviceToken.upsert({
        where: {
          userId_token: { userId, token }
        },
        update: {
          platform,
          deviceId,
          deviceName,
          appVersion,
          isActive: true,
          lastUsedAt: new Date(),
          invalidAt: null,
          organizationId
        },
        create: {
          userId,
          token,
          platform,
          deviceId,
          deviceName,
          appVersion,
          isActive: true,
          organizationId
        }
      });

      console.log(`✅ Device token registered for user ${userId}`);
      return { success: true, deviceToken };
    } catch (error) {
      console.error('Error registering device token:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get active device tokens for user
   */
  async getUserDeviceTokens(userId, organizationId = null) {
    try {
      const where = {
        userId,
        isActive: true
      };

      if (organizationId) {
        where.organizationId = organizationId;
      }

      const tokens = await prisma.userDeviceToken.findMany({
        where,
        select: {
          token: true,
          platform: true,
          deviceName: true,
          lastUsedAt: true
        },
        orderBy: { lastUsedAt: 'desc' }
      });

      return tokens;
    } catch (error) {
      console.error('Error getting user device tokens:', error);
      return [];
    }
  }

  /**
   * Mark token as invalid
   */
  async markTokenInvalid(token) {
    try {
      await prisma.userDeviceToken.updateMany({
        where: { token },
        data: {
          isActive: false,
          invalidAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error marking token invalid:', error);
    }
  }

  /**
   * Mark multiple tokens as invalid
   */
  async markTokensInvalid(tokens) {
    try {
      await prisma.userDeviceToken.updateMany({
        where: { token: { in: tokens } },
        data: {
          isActive: false,
          invalidAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error marking tokens invalid:', error);
    }
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
      await prisma.organizationPushConfig.update({
        where: { id: config.id },
        data: {
          dailyPushesSent: 0,
          lastDailyReset: startOfDay
        }
      });
      config.dailyPushesSent = 0;
    }

    if (!config.lastMonthlyReset || config.lastMonthlyReset < startOfMonth) {
      await prisma.organizationPushConfig.update({
        where: { id: config.id },
        data: {
          monthlyPushesSent: 0,
          lastMonthlyReset: startOfMonth
        }
      });
      config.monthlyPushesSent = 0;
    }

    if (config.dailyPushesSent >= config.dailyPushLimit) {
      return { allowed: false, reason: 'Daily push limit exceeded' };
    }

    if (config.monthlyPushesSent >= config.monthlyPushLimit) {
      return { allowed: false, reason: 'Monthly push limit exceeded' };
    }

    return { allowed: true };
  }

  /**
   * Increment push notification counter
   */
  async incrementPushCount(configId, count = 1) {
    try {
      await prisma.organizationPushConfig.update({
        where: { id: configId },
        data: {
          dailyPushesSent: { increment: count },
          monthlyPushesSent: { increment: count }
        }
      });
    } catch (error) {
      console.error('Error incrementing push count:', error);
    }
  }

  /**
   * Sanitize data for FCM (all values must be strings)
   */
  sanitizeData(data) {
    const sanitized = {};
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== null && value !== undefined) {
        sanitized[key] = String(value);
      }
    });
    return sanitized;
  }

  /**
   * Get notification channel ID based on type
   */
  getChannelId(type) {
    if (type?.includes('LIFELINK_EMERGENCY')) return 'lifelink_emergency';
    if (type?.includes('LIFELINK')) return 'lifelink_general';
    if (type?.includes('EVENT')) return 'events';
    if (type?.includes('POLL')) return 'polls';
    if (type?.includes('PAYMENT')) return 'payments';
    return 'general';
  }

  /**
   * Save/Update tenant push configuration
   */
  async savePushConfig(organizationId, configData, userId) {
    try {
      // Encrypt sensitive fields
      const encryptedData = { ...configData };

      if (configData.firebasePrivateKey) {
        encryptedData.firebasePrivateKey = encrypt(configData.firebasePrivateKey);
      }
      if (configData.vapidPrivateKey) {
        encryptedData.vapidPrivateKey = encrypt(configData.vapidPrivateKey);
      }
      if (configData.apnsKey) {
        encryptedData.apnsKey = encrypt(configData.apnsKey);
      }

      const existingConfig = await prisma.organizationPushConfig.findUnique({
        where: { organizationId }
      });

      let result;
      if (existingConfig) {
        result = await prisma.organizationPushConfig.update({
          where: { organizationId },
          data: {
            ...encryptedData,
            updatedBy: userId,
            isConfigured: true
          }
        });
      } else {
        result = await prisma.organizationPushConfig.create({
          data: {
            organizationId,
            ...encryptedData,
            createdBy: userId,
            isConfigured: true,
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
        this.clearTenantCache(org.tenantCode);
      }

      return { success: true, config: result };
    } catch (error) {
      console.error('Error saving push config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test tenant push configuration
   */
  async testPushConfig(organizationId) {
    try {
      const config = await prisma.organizationPushConfig.findUnique({
        where: { organizationId },
        include: {
          organization: { select: { tenantCode: true } }
        }
      });

      if (!config) {
        return { success: false, error: 'No push configuration found' };
      }

      if (!config.firebaseProjectId || !config.firebaseClientEmail || !config.firebasePrivateKey) {
        return { success: false, error: 'Firebase credentials not configured' };
      }

      // Try to initialize Firebase with tenant credentials
      const tenantCode = config.organization?.tenantCode || organizationId;
      const appName = `test-${tenantCode}-${Date.now()}`;

      try {
        const testApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.firebaseProjectId,
            clientEmail: config.firebaseClientEmail,
            privateKey: decrypt(config.firebasePrivateKey)?.replace(/\\n/g, '\n')
          }),
          projectId: config.firebaseProjectId
        }, appName);

        // Clean up test app
        await testApp.delete();

        // Update test results
        await prisma.organizationPushConfig.update({
          where: { id: config.id },
          data: {
            lastTestedAt: new Date(),
            isActive: true
          }
        });

        return { success: true, message: 'Firebase configuration verified' };
      } catch (firebaseError) {
        await prisma.organizationPushConfig.update({
          where: { id: config.id },
          data: {
            lastTestedAt: new Date(),
            isActive: false
          }
        });

        return { success: false, error: firebaseError.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get push configuration for organization (with masked sensitive data)
   */
  async getPushConfig(organizationId) {
    try {
      const config = await prisma.organizationPushConfig.findUnique({
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
        firebasePrivateKey: config.firebasePrivateKey ? '********' : null,
        vapidPrivateKey: config.vapidPrivateKey ? '********' : null,
        apnsKey: config.apnsKey ? '********' : null
      };
    } catch (error) {
      console.error('Error getting push config:', error);
      return null;
    }
  }

  /**
   * Clear cache for a specific tenant
   */
  clearTenantCache(tenantCode) {
    const cached = this.tenantAppsCache.get(tenantCode);
    if (cached) {
      // Delete the Firebase app if it exists
      const appName = `tenant-${tenantCode}`;
      const existingApp = admin.apps.find(app => app.name === appName);
      if (existingApp) {
        existingApp.delete().catch(console.error);
        this.initializedApps.delete(appName);
      }
    }
    this.tenantAppsCache.delete(tenantCode);
  }

  /**
   * Clear all cached services
   */
  clearAllCache() {
    // Delete all tenant Firebase apps
    for (const appName of this.initializedApps) {
      const existingApp = admin.apps.find(app => app.name === appName);
      if (existingApp) {
        existingApp.delete().catch(console.error);
      }
    }
    this.initializedApps.clear();
    this.tenantAppsCache.clear();
  }
}

// Export singleton instance
module.exports = new TenantPushNotificationService();
