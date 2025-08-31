// src/middleware/validation/auth.validation.js
const Joi = require('joi');
const { errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

// ============================================
// VALIDATION SCHEMAS
// ============================================

const authSchemas = {
  // User registration schema
  register: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    
    fullName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z\s.]+$/)
      .required()
      .messages({
        'string.min': 'Full name must be at least 2 characters long',
        'string.max': 'Full name cannot exceed 100 characters',
        'string.pattern.base': 'Full name can only contain letters, spaces, and dots',
        'any.required': 'Full name is required'
      }),
    
    batch: Joi.number()
      .integer()
      .min(1990)
      .max(new Date().getFullYear())
      .required()
      .messages({
        'number.min': 'Batch year cannot be before 1990',
        'number.max': `Batch year cannot be after ${new Date().getFullYear()}`,
        'any.required': 'Batch year is required'
      })
  }),
  
  // User login schema
  login: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  }),
  
  // Change password schema
  changePassword: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'New password must be at least 8 characters long',
        'string.max': 'New password cannot exceed 128 characters',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      })
  }),
  
  // Forgot password schema
  forgotPassword: Joi.object({
    email: Joi.string()
      .email()
      .lowercase()
      .trim()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  }),
  
  // Reset password schema
  resetPassword: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'any.required': 'Reset token is required'
      }),
    
    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      })
  }),
  
  // Refresh token schema
  refreshToken: Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Refresh token is required'
      })
  })
};

// ============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Generic validation middleware factory
 * @param {string} schemaName - Name of schema to validate against
 * @param {string} property - Request property to validate (body, params, query)
 * @returns {Function} - Middleware function
 */
const validate = (schemaName, property = 'body') => {
  return (req, res, next) => {
    const schema = authSchemas[schemaName];
    
    if (!schema) {
      console.error(`Validation schema '${schemaName}' not found`);
      return errorResponse(res, 'Validation configuration error', 500);
    }

    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return errorResponse(res, 'Validation failed', 400, { errors });
    }

    req[property] = value;
    next();
  };
};

// ============================================
// SPECIFIC VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate user registration data
 */
const validateRegister = validate('register');

/**
 * Validate user login data
 */
const validateLogin = validate('login');

/**
 * Validate change password data
 */
const validateChangePassword = validate('changePassword');

/**
 * Validate forgot password data
 */
const validateForgotPassword = validate('forgotPassword');

/**
 * Validate reset password data
 */
const validateResetPassword = validate('resetPassword');

/**
 * Validate refresh token data
 */
const validateRefreshToken = validate('refreshToken');

/**
 * Custom validation for password confirmation
 */
const validatePasswordConfirmation = (req, res, next) => {
  const { password, confirmPassword } = req.body;
  
  if (password && confirmPassword && password !== confirmPassword) {
    return errorResponse(res, 'Password and confirm password do not match', 400);
  }
  
  next();
};

/**
 * Validate email verification token parameter
 */
const validateEmailToken = (req, res, next) => {
  const { token } = req.params;
  
  if (!token || token.length < 32) {
    return errorResponse(res, 'Valid verification token required', 400);
  }
  
  next();
};

// ============================================
// BUSINESS RULE VALIDATIONS
// ============================================

/**
 * Check if batch year is valid and exists
 */
const validateBatchYear = async (req, res, next) => {
  try {
    const { batch } = req.body;
    
    if (!batch) {
      return next(); // Let Joi validation handle this
    }
    
    const batchExists = await prisma.batch.findUnique({
      where: { year: parseInt(batch) },
      select: {
        id: true,
        year: true,
        name: true,
        description: true
      }
    });
    
    if (!batchExists) {
      return errorResponse(res, `Batch year ${batch} does not exist in our records`, 400);
    }
    
    // Add batch info to request for controller use
    req.batchInfo = batchExists;
    next();
    
  } catch (error) {
    console.error('Batch validation error:', error);
    return errorResponse(res, 'Batch validation failed', 500);
  }
};

/**
 * Check for duplicate registration attempts
 */
const checkDuplicateRegistration = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next();
    }
    
    // Check recent registration attempts from same IP
    const recentAttempts = await prisma.activityLog.findMany({
      where: {
        action: 'user_registration',
        ipAddress: req.ip,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        details: true,
        createdAt: true
      }
    });
    
    // Allow max 3 registrations per IP per day
    if (recentAttempts.length >= 3) {
      return errorResponse(res, 'Too many registration attempts from this location. Please try again tomorrow.', 429);
    }
    
    next();
    
  } catch (error) {
    console.error('Duplicate registration check error:', error);
    next(); // Don't fail registration if check fails
  }
};

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  validatePasswordConfirmation,
  validateEmailToken,
  validateBatchYear,
  checkDuplicateRegistration,
  authSchemas
};