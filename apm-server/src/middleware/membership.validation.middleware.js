// src/middleware/membership.validation.middleware.js
const Joi = require('joi');
const { prisma } = require('../config/database');

/**
 * Validation schemas for membership operations
 */
const membershipSchemas = {
  // Batch membership settings
  batchMembershipSettings: Joi.object({
    membershipFee: Joi.number()
      .positive()
      .precision(2)
      .max(100000)
      .required()
      .messages({
        'number.base': 'Membership fee must be a number',
        'number.positive': 'Membership fee must be positive',
        'number.precision': 'Membership fee can have maximum 2 decimal places',
        'number.max': 'Membership fee cannot exceed ₹1,00,000',
        'any.required': 'Membership fee is required'
      }),
    membershipYear: Joi.number()
      .integer()
      .min(2024)
      .max(2030)
      .optional()
      .messages({
        'number.base': 'Membership year must be a number',
        'number.integer': 'Membership year must be an integer',
        'number.min': 'Membership year cannot be before 2024',
        'number.max': 'Membership year cannot be after 2030'
      }),
    description: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      })
  }),
  
  // Global membership settings  
  globalMembershipSettings: Joi.object({
    membershipFee: Joi.number()
      .positive()
      .precision(2)
      .max(100000)
      .required()
      .messages({
        'number.base': 'Membership fee must be a number',
        'number.positive': 'Membership fee must be positive',
        'number.precision': 'Membership fee can have maximum 2 decimal places',
        'number.max': 'Membership fee cannot exceed ₹1,00,000',
        'any.required': 'Membership fee is required'
      }),
    membershipYear: Joi.number()
      .integer()
      .min(2024)
      .max(2030)
      .optional()
      .messages({
        'number.base': 'Membership year must be a number',
        'number.integer': 'Membership year must be an integer',
        'number.min': 'Membership year cannot be before 2024',
        'number.max': 'Membership year cannot be after 2030'
      }),
    applyToAll: Joi.boolean()
      .default(false)
      .messages({
        'boolean.base': 'Apply to all must be true or false'
      }),
    description: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      })
  }),
  
  // Batch admin assignment
  batchAdminAssignment: Joi.object({
    userIds: Joi.array()
      .items(Joi.string().uuid().messages({
        'string.uuid': 'Each user ID must be a valid UUID'
      }))
      .min(1)
      .max(10)
      .required()
      .messages({
        'array.min': 'At least one user ID is required',
        'array.max': 'Cannot assign more than 10 batch admins at once',
        'any.required': 'User IDs array is required'
      }),
    action: Joi.string()
      .valid('assign', 'remove')
      .required()
      .messages({
        'any.only': 'Action must be either "assign" or "remove"',
        'any.required': 'Action is required'
      })
  }),
  
  // Membership payment initiation
  membershipPayment: Joi.object({
    membershipYear: Joi.number()
      .integer()
      .min(2024)
      .max(2030)
      .optional()
      .messages({
        'number.base': 'Membership year must be a number',
        'number.integer': 'Membership year must be an integer',
        'number.min': 'Membership year cannot be before 2024',
        'number.max': 'Membership year cannot be after 2030'
      })
  })
};

/**
 * Validate batch membership settings
 */
const validateBatchMembershipSettings = (req, res, next) => {
  const { error, value } = membershipSchemas.batchMembershipSettings.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Batch membership settings validation failed',
      errors
    });
  }
  
  req.body = value;
  next();
};

/**
 * Validate global membership settings
 */
const validateGlobalMembershipSettings = (req, res, next) => {
  const { error, value } = membershipSchemas.globalMembershipSettings.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Global membership settings validation failed',
      errors
    });
  }
  
  req.body = value;
  next();
};

/**
 * Validate batch admin assignment
 */
const validateBatchAdminAssignment = (req, res, next) => {
  const { error, value } = membershipSchemas.batchAdminAssignment.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Batch admin assignment validation failed',
      errors
    });
  }
  
  req.body = value;
  next();
};

/**
 * Validate batch year parameter
 */
const validateBatchYearParam = (req, res, next) => {
  const batchYearStr = req.params.batchYear;
  const batchYear = parseInt(batchYearStr);
  
  if (!batchYearStr || isNaN(batchYear) || batchYear < 1990 || batchYear > 2030) {
    return res.status(400).json({
      success: false,
      message: 'Valid batch year required (1990-2030)',
      providedValue: batchYearStr
    });
  }
  
  req.params.batchYear = batchYear;
  next();
};

/**
 * Validate membership payment request
 */
const validateMembershipPayment = (req, res, next) => {
  const { error, value } = membershipSchemas.membershipPayment.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Membership payment validation failed',
      errors
    });
  }
  
  req.body = value;
  next();
};

/**
 * Business rules validation for batch settings
 */
const validateBatchExists = async (req, res, next) => {
  try {
    const batchYear = req.params.batchYear || req.body.batchYear;
    
    const batch = await prisma.batch.findUnique({
      where: { year: batchYear },
      select: { 
        year: true, 
        name: true, 
        totalMembers: true 
      }
    });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: `Batch ${batchYear} not found`,
        suggestion: 'Please check the batch year or contact administrator'
      });
    }
    
    // Add batch info to request for controller use
    req.batchInfo = batch;
    next();
  } catch (error) {
    console.error('Batch validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate batch'
    });
  }
};

/**
 * Validate users exist and are eligible for batch admin assignment
 */
const validateBatchAdminUsers = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    const batchYear = parseInt(req.params.batchYear);
    
    // Check if all users exist and are from the correct batch
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        batch: batchYear,
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        batch: true,
        role: true
      }
    });
    
    if (users.length !== userIds.length) {
      const foundIds = users.map(u => u.id);
      const missingIds = userIds.filter(id => !foundIds.includes(id));
      
      return res.status(400).json({
        success: false,
        message: 'Some users are invalid, inactive, or not from the specified batch',
        invalidUserIds: missingIds,
        validUsers: users.length,
        requestedUsers: userIds.length
      });
    }
    
    // Check for super admins (they shouldn't be assigned as batch admins)
    const superAdmins = users.filter(u => u.role === 'SUPER_ADMIN');
    if (superAdmins.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Super Admins cannot be assigned as Batch Admins',
        superAdminUsers: superAdmins.map(u => ({ id: u.id, name: u.fullName }))
      });
    }
    
    // Add valid users to request for controller use
    req.validUsers = users;
    next();
  } catch (error) {
    console.error('Batch admin users validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate batch admin users'
    });
  }
};

/**
 * Validate membership settings don't conflict
 */
const validateMembershipSettingsConflict = async (req, res, next) => {
  try {
    const membershipYear = req.body.membershipYear || new Date().getFullYear();
    const batchYear = req.params.batchYear;
    
    // Check if global setting with applyToAll exists for this year
    const globalSetting = await prisma.globalMembershipSettings.findFirst({
      where: {
        membershipYear: membershipYear,
        isActive: true,
        applyToAll: true
      }
    });
    
    if (globalSetting && batchYear) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set batch-specific fee when global setting with "Apply to All" is active',
        conflictingGlobalSetting: {
          id: globalSetting.id,
          fee: globalSetting.membershipFee,
          year: globalSetting.membershipYear
        },
        suggestion: 'Either disable the global setting or set it to not apply to all batches'
      });
    }
    
    next();
  } catch (error) {
    console.error('Membership settings conflict validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate membership settings conflict'
    });
  }
};

/**
 * Validate membership year is not in the past
 */
const validateMembershipYearNotPast = (req, res, next) => {
  const currentYear = new Date().getFullYear();
  const membershipYear = req.body.membershipYear || currentYear;
  
  if (membershipYear < currentYear) {
    return res.status(400).json({
      success: false,
      message: 'Cannot set membership settings for past years',
      currentYear: currentYear,
      requestedYear: membershipYear
    });
  }
  
  next();
};

module.exports = {
  validateBatchMembershipSettings,
  validateGlobalMembershipSettings,
  validateBatchAdminAssignment,
  validateBatchYearParam,
  validateMembershipPayment,
  validateBatchExists,
  validateBatchAdminUsers,
  validateMembershipSettingsConflict,
  validateMembershipYearNotPast
};