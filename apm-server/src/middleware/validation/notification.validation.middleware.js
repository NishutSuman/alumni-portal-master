// src/middleware/notification.validation.middleware.js
// Notification Validation Middleware - Following established patterns

const Joi = require('joi');
// const { PrismaClient } = require('@prisma/client');
const { errorResponse } = require('../../utils/response');
const { NOTIFICATION_TYPES, PRIORITY_LEVELS, CHANNELS } = require('../../services/notification.service');
const { prisma } = require('../../config/database');


// const prisma = new PrismaClient();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const schemas = {
  // Push token registration schema
  registerPushToken: Joi.object({
    token: Joi.string()
      .min(50)
      .max(500)
      .required()
      .messages({
        'string.min': 'Push token must be at least 50 characters',
        'string.max': 'Push token cannot exceed 500 characters',
        'any.required': 'Push token is required'
      }),
    
    deviceType: Joi.string()
      .valid('web', 'android', 'ios')
      .default('web')
      .optional(),
    
    deviceInfo: Joi.object({
      userAgent: Joi.string().optional(),
      platform: Joi.string().optional(),
      version: Joi.string().optional()
    }).optional()
  }),

  // Push token unregistration schema
  unregisterPushToken: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'any.required': 'Push token is required for unregistration'
      })
  }),

  // Custom notification sending schema
  sendCustomNotification: Joi.object({
    recipientIds: Joi.array()
      .items(Joi.string().required())
      .min(1)
      .max(1000)
      .required()
      .messages({
        'array.min': 'At least one recipient is required',
        'array.max': 'Cannot send to more than 1000 recipients at once',
        'any.required': 'Recipient IDs are required'
      }),
    
    type: Joi.string()
      .valid(...Object.values(NOTIFICATION_TYPES))
      .default(NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT)
      .optional(),
    
    title: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Title cannot be empty',
        'string.max': 'Title cannot exceed 100 characters',
        'any.required': 'Notification title is required'
      }),
    
    message: Joi.string()
      .trim()
      .min(1)
      .max(300)
      .required()
      .messages({
        'string.min': 'Message cannot be empty',
        'string.max': 'Message cannot exceed 300 characters',
        'any.required': 'Notification message is required'
      }),
    
    data: Joi.object()
      .pattern(Joi.string(), Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.boolean()
      ))
      .default({})
      .optional(),
    
    priority: Joi.string()
      .valid(...Object.values(PRIORITY_LEVELS))
      .default(PRIORITY_LEVELS.MEDIUM)
      .optional(),
    
    channels: Joi.array()
      .items(Joi.string().valid(...Object.values(CHANNELS)))
      .default([CHANNELS.PUSH, CHANNELS.IN_APP])
      .optional(),
    
    scheduleAt: Joi.date()
      .min('now')
      .optional()
      .allow(null)
      .messages({
        'date.min': 'Scheduled time cannot be in the past'
      })
  }),

  // System announcement schema
  sendSystemAnnouncement: Joi.object({
    title: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Announcement title cannot be empty',
        'string.max': 'Announcement title cannot exceed 100 characters',
        'any.required': 'Announcement title is required'
      }),
    
    message: Joi.string()
      .trim()
      .min(1)
      .max(500)
      .required()
      .messages({
        'string.min': 'Announcement message cannot be empty',
        'string.max': 'Announcement message cannot exceed 500 characters',
        'any.required': 'Announcement message is required'
      }),
    
    priority: Joi.string()
      .valid(...Object.values(PRIORITY_LEVELS))
      .default(PRIORITY_LEVELS.MEDIUM)
      .optional()
  }),

  // Cleanup old notifications schema
  cleanupOldNotifications: Joi.object({
    daysOld: Joi.number()
      .integer()
      .min(1)
      .max(365)
      .default(30)
      .optional()
      .messages({
        'number.min': 'Days old must be at least 1',
        'number.max': 'Days old cannot exceed 365'
      })
  }),

  // Query parameter schemas
  notificationListQuery: Joi.object({
    type: Joi.string()
      .valid(...Object.values(NOTIFICATION_TYPES))
      .optional(),
    
    status: Joi.string()
      .valid('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'EXPIRED', 'NO_DEVICE')
      .optional(),
    
    priority: Joi.string()
      .valid(...Object.values(PRIORITY_LEVELS))
      .optional(),
    
    unreadOnly: Joi.string()
      .valid('true', 'false')
      .default('false')
      .optional(),
    
    page: Joi.number()
      .integer()
      .min(1)
      .default(1)
      .optional(),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .default(20)
      .optional()
  }),

  // Analytics query schema
  analyticsQuery: Joi.object({
    fromDate: Joi.date()
      .optional(),
    
    toDate: Joi.date()
      .min(Joi.ref('fromDate'))
      .optional()
      .messages({
        'date.min': 'End date must be after start date'
      })
  }),

  // Parameter schemas
  notificationIdParam: Joi.object({
    notificationId: Joi.string()
      .required()
      .messages({
        'any.required': 'Notification ID is required'
      })
  })
};

// ============================================
// VALIDATION MIDDLEWARE FACTORY
// ============================================

const validate = (schemaName, property = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];

    if (!schema) {
      return errorResponse(res, 'Validation schema not found', 500);
    }

    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return errorResponse(res, 'Validation failed', 400, { errors });
    }

    req[property] = value;
    next();
  };
};

// ============================================
// BUSINESS RULE VALIDATIONS
// ============================================

// Validate notification access/ownership
const validateNotificationAccess = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true, // Fixed: schema uses userId not recipientId
        type: true,
        isRead: true,
        createdAt: true
      }
    });

    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    // Check if user is the recipient or super admin
    if (notification.userId !== userId && req.user.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'You do not have access to this notification', 403);
    }

    // Add notification to request for further processing
    // No expiration check needed for basic notifications

    req.notification = notification;
    next();
  } catch (error) {
    console.error('Notification access validation error:', error);
    return errorResponse(res, 'Failed to validate notification access', 500);
  }
};

// Validate user has push notification permissions
const validatePushPermissions = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if user has opted out of push notifications (if you implement this setting)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isActive: true,
        notificationPreferences: true // If you add this field
      }
    });

    if (!user?.isActive) {
      return errorResponse(res, 'User account is not active', 403);
    }

    // If user has disabled push notifications
    if (user.notificationPreferences?.pushEnabled === false) {
      return errorResponse(res, 'Push notifications are disabled for this user', 400);
    }

    next();
  } catch (error) {
    console.error('Push permissions validation error:', error);
    return errorResponse(res, 'Failed to validate push permissions', 500);
  }
};

// Validate recipient users exist and are active
const validateRecipients = async (req, res, next) => {
  try {
    const { recipientIds } = req.body;

    if (!recipientIds || recipientIds.length === 0) {
      return next(); // Skip if no recipients provided
    }

    // Check if all recipients exist and are active
    const validRecipients = await prisma.user.findMany({
      where: {
        id: { in: recipientIds },
        isActive: true
      },
      select: { id: true }
    });

    const validRecipientIds = validRecipients.map(user => user.id);
    const invalidRecipients = recipientIds.filter(id => !validRecipientIds.includes(id));

    if (invalidRecipients.length > 0) {
      return errorResponse(res, 'Some recipient users not found or inactive', 400, {
        invalidRecipients,
        validRecipients: validRecipientIds.length
      });
    }

    req.validatedRecipients = validRecipientIds;
    next();
  } catch (error) {
    console.error('Recipients validation error:', error);
    return errorResponse(res, 'Failed to validate recipients', 500);
  }
};

// Rate limiting for notification sending (prevent spam)
const validateNotificationRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Skip rate limiting for super admins
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Check how many notifications the user has sent in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentNotifications = await prisma.notification.count({
      where: {
        createdAt: { gte: oneHourAgo },
        // This would need a senderUserId field in your notification model
        // For now, we'll skip this check
      }
    });

    const maxNotificationsPerHour = 100; // Adjust as needed
    
    if (recentNotifications >= maxNotificationsPerHour) {
      return errorResponse(res, 'Notification rate limit exceeded. Please try again later.', 429, {
        limit: maxNotificationsPerHour,
        resetTime: new Date(Date.now() + 60 * 60 * 1000)
      });
    }

    next();
  } catch (error) {
    console.error('Notification rate limit validation error:', error);
    // Don't block the request if rate limiting fails
    next();
  }
};

// Validate notification is not expired
const validateNotificationNotExpired = (req, res, next) => {
  try {
    const { notification } = req;

    if (!notification) {
      return errorResponse(res, 'Notification validation required first', 500);
    }

    if (req.notificationExpired) {
      return errorResponse(res, 'This notification has expired', 400);
    }

    next();
  } catch (error) {
    console.error('Notification expiry validation error:', error);
    return errorResponse(res, 'Failed to validate notification expiry', 500);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Data validation
  validateRegisterPushToken: validate('registerPushToken'),
  validateUnregisterPushToken: validate('unregisterPushToken'),
  validateSendCustomNotification: validate('sendCustomNotification'),
  validateSendSystemAnnouncement: validate('sendSystemAnnouncement'),
  validateCleanupOldNotifications: validate('cleanupOldNotifications'),

  // Query validation
  validateNotificationListQuery: validate('notificationListQuery', 'query'),
  validateAnalyticsQuery: validate('analyticsQuery', 'query'),

  // Parameter validation
  validateNotificationIdParam: validate('notificationIdParam', 'params'),

  // Business rule validation
  validateNotificationAccess,
  validatePushPermissions,
  validateRecipients,
  validateNotificationRateLimit,
  validateNotificationNotExpired
};