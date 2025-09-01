// src/middleware/celebration.validation.middleware.js
const Joi = require('joi');
const { errorResponse } = require('../../utils/response');

// ============================================
// VALIDATION SCHEMAS
// ============================================

const upcomingBirthdaysSchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(7)
});

const upcomingFestivalsSchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30)
});

const monthBirthdaysSchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2020).max(2030).optional()
});

const searchFestivalsSchema = Joi.object({
  q: Joi.string().min(2).max(100).optional(),
  festivalType: Joi.string().valid(
    'NATIONAL_HOLIDAY', 'HINDU', 'MUSLIM', 'CHRISTIAN', 
    'SIKH', 'BUDDHIST', 'JAIN', 'REGIONAL', 'CULTURAL'
  ).optional(),
  religion: Joi.string().valid(
    'HINDUISM', 'ISLAM', 'CHRISTIANITY', 'SIKHISM', 
    'BUDDHISM', 'JAINISM', 'OTHER'
  ).optional(),
  priority: Joi.string().valid('MAJOR', 'REGIONAL', 'MINOR').optional(),
  year: Joi.number().integer().min(2020).max(2030).optional(),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

const festivalCalendarSchema = Joi.object({
  year: Joi.number().integer().min(2020).max(2030).optional()
});

const toggleNotificationsSchema = Joi.object({
  enabled: Joi.boolean().required()
});

const syncHistorySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10)
});

const notificationHistorySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(50)
});

// ============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Validate upcoming birthdays query parameters
 */
const validateUpcomingBirthdays = (req, res, next) => {
  const { error, value } = upcomingBirthdaysSchema.validate(req.query);
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.query = value;
  next();
};

/**
 * Validate upcoming festivals query parameters
 */
const validateUpcomingFestivals = (req, res, next) => {
  const { error, value } = upcomingFestivalsSchema.validate(req.query);
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.query = value;
  next();
};

/**
 * Validate month parameter for birthdays
 */
const validateMonthBirthdays = (req, res, next) => {
  const { error, value } = monthBirthdaysSchema.validate({
    month: req.params.month,
    year: req.query.year
  });
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.params.month = value.month;
  if (value.year) req.query.year = value.year;
  next();
};

/**
 * Validate search festivals query parameters
 */
const validateSearchFestivals = (req, res, next) => {
  const { error, value } = searchFestivalsSchema.validate(req.query);
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.query = value;
  next();
};

/**
 * Validate festival calendar query parameters
 */
const validateFestivalCalendar = (req, res, next) => {
  const { error, value } = festivalCalendarSchema.validate(req.query);
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.query = value;
  next();
};

/**
 * Validate festival ID parameter
 */
const validateFestivalIdParam = (req, res, next) => {
  const { festivalId } = req.params;
  
  if (!festivalId || typeof festivalId !== 'string') {
    return errorResponse(res, 'Valid festival ID is required', 400);
  }
  
  next();
};

/**
 * Validate toggle notifications request body
 */
const validateToggleNotifications = (req, res, next) => {
  const { error, value } = toggleNotificationsSchema.validate(req.body);
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.body = value;
  next();
};

/**
 * Validate sync history query parameters
 */
const validateSyncHistory = (req, res, next) => {
  const { error, value } = syncHistorySchema.validate(req.query);
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.query = value;
  next();
};

/**
 * Validate notification history query parameters
 */
const validateNotificationHistory = (req, res, next) => {
  const { error, value } = notificationHistorySchema.validate(req.query);
  
  if (error) {
    return errorResponse(res, `Validation error: ${error.details[0].message}`, 400);
  }
  
  req.query = value;
  next();
};

/**
 * Validate festival access (check if festival exists and is accessible)
 */
const validateFestivalAccess = async (req, res, next) => {
  try {
    const { festivalId } = req.params;
    
    const festival = await require('../config/database').prisma.festival.findUnique({
      where: { id: festivalId },
      select: {
        id: true,
        name: true,
        isActive: true
      }
    });

    if (!festival) {
      return errorResponse(res, 'Festival not found', 404);
    }

    if (!festival.isActive) {
      return errorResponse(res, 'Festival is not active', 400);
    }

    req.festival = festival;
    next();
  } catch (error) {
    console.error('Festival access validation error:', error);
    return errorResponse(res, 'Failed to validate festival access', 500);
  }
};

// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================

/**
 * Rate limit for admin sync operations
 */
const validateSyncRateLimit = (req, res, next) => {
  // Allow only 1 manual sync per hour per admin
  const userId = req.user?.id;
  const action = 'manual_festival_sync';
  
  // Simple in-memory rate limiting (you can enhance with Redis)
  const rateLimitKey = `${action}:${userId}`;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  if (!global.syncRateLimits) {
    global.syncRateLimits = new Map();
  }
  
  const lastSync = global.syncRateLimits.get(rateLimitKey);
  
  if (lastSync && (now - lastSync) < oneHour) {
    const waitTime = Math.ceil((oneHour - (now - lastSync)) / 1000 / 60);
    return errorResponse(res, `Please wait ${waitTime} minutes before triggering sync again`, 429);
  }
  
  global.syncRateLimits.set(rateLimitKey, now);
  next();
};

module.exports = {
  validateUpcomingBirthdays,
  validateUpcomingFestivals,
  validateMonthBirthdays,
  validateSearchFestivals,
  validateFestivalCalendar,
  validateFestivalIdParam,
  validateToggleNotifications,
  validateSyncHistory,
  validateNotificationHistory,
  validateFestivalAccess,
  validateSyncRateLimit
};