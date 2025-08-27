const Joi = require('joi');

/**
 * Validation schemas for admin membership operations
 */
const adminMembershipSchemas = {
  // Bulk status update
  bulkUpdateStatus: Joi.object({
    userIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .max(100)
      .required()
      .messages({
        'array.min': 'At least one user ID is required',
        'array.max': 'Cannot update more than 100 users at once'
      }),
    newStatus: Joi.string()
      .valid('ACTIVE', 'EXPIRED', 'PENDING', 'SUSPENDED', 'INACTIVE')
      .required()
      .messages({
        'any.only': 'Status must be ACTIVE, EXPIRED, PENDING, SUSPENDED, or INACTIVE'
      }),
    reason: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Reason cannot exceed 500 characters'
      })
  }),
  
  // Individual status update
  updateUserStatus: Joi.object({
    status: Joi.string()
      .valid('ACTIVE', 'EXPIRED', 'PENDING', 'SUSPENDED', 'INACTIVE')
      .required()
      .messages({
        'any.only': 'Status must be ACTIVE, EXPIRED, PENDING, SUSPENDED, or INACTIVE'
      }),
    reason: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Reason cannot exceed 500 characters'
      })
  }),
  
  // Send reminders
  sendReminders: Joi.object({
    batchYear: Joi.number()
      .integer()
      .min(1990)
      .max(2030)
      .optional(),
    userIds: Joi.array()
      .items(Joi.string().uuid())
      .max(500)
      .optional()
      .messages({
        'array.max': 'Cannot send reminders to more than 500 users at once'
      })
  }).or('batchYear', 'userIds').messages({
    'object.missing': 'Either batchYear or userIds must be provided'
  })
};

/**
 * Validate bulk status update
 */
const validateBulkUpdateStatus = (req, res, next) => {
  const { error, value } = adminMembershipSchemas.bulkUpdateStatus.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Bulk update validation failed',
      errors
    });
  }
  
  req.body = value;
  next();
};

/**
 * Validate user status update
 */
const validateUpdateUserStatus = (req, res, next) => {
  const { error, value } = adminMembershipSchemas.updateUserStatus.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Status update validation failed',
      errors
    });
  }
  
  req.body = value;
  next();
};

/**
 * Validate send reminders request
 */
const validateSendReminders = (req, res, next) => {
  const { error, value } = adminMembershipSchemas.sendReminders.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Send reminders validation failed',
      errors
    });
  }
  
  req.body = value;
  next();
};

/**
 * Validate user ID parameter
 */
const validateUserIdParam = (req, res, next) => {
  const userId = req.params.userId;
  
  if (!userId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid user ID required'
    });
  }
  
  next();
};

module.exports = {
  validateBulkUpdateStatus,
  validateUpdateUserStatus,
  validateSendReminders,
  validateUserIdParam
};