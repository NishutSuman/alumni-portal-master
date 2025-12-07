// src/middleware/lifelink.validation.middleware.js
// LifeLink Network Validation Middleware

const Joi = require('joi');
// const { PrismaClient } = require('@prisma/client');
const { errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');


// const prisma = new PrismaClient();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const schemas = {
  // Blood profile update schema
  updateBloodProfile: Joi.object({
    bloodGroup: Joi.string()
      .valid(
        'A_POSITIVE', 'A_NEGATIVE', 
        'B_POSITIVE', 'B_NEGATIVE', 
        'AB_POSITIVE', 'AB_NEGATIVE', 
        'O_POSITIVE', 'O_NEGATIVE'
      )
      .optional()
      .allow(null),
    
    isBloodDonor: Joi.boolean()
      .default(false)
      .optional()
  }),

  // Add donation schema
  addDonation: Joi.object({
    donationDate: Joi.date()
      .max('now')
      .default(() => new Date())
      .optional(),
    
    location: Joi.string()
      .trim()
      .min(3)
      .max(200)
      .required()
      .messages({
        'string.min': 'Location must be at least 3 characters',
        'string.max': 'Location cannot exceed 200 characters',
        'any.required': 'Donation location is required'
      }),
    
    units: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .default(1)
      .optional(),
    
    notes: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow(null, '')
  }),

  // Blood requisition schema
  createRequisition: Joi.object({
    patientName: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Patient name must be at least 2 characters',
        'any.required': 'Patient name is required'
      }),
    
    hospitalName: Joi.string()
      .trim()
      .min(3)
      .max(200)
      .required()
      .messages({
        'any.required': 'Hospital name is required'
      }),
    
    contactNumber: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .required()
      .messages({
        'string.pattern.base': 'Please provide a valid 10-digit mobile number',
        'any.required': 'Contact number is required'
      }),
    
    alternateNumber: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .optional()
      .allow(null, ''),
    
    requiredBloodGroup: Joi.string()
      .valid(
        'A_POSITIVE', 'A_NEGATIVE', 
        'B_POSITIVE', 'B_NEGATIVE', 
        'AB_POSITIVE', 'AB_NEGATIVE', 
        'O_POSITIVE', 'O_NEGATIVE'
      )
      .required()
      .messages({
        'any.required': 'Required blood group is mandatory'
      }),
    
    unitsNeeded: Joi.number()
      .integer()
      .min(1)
      .max(10)
      .default(1)
      .optional(),
    
    urgencyLevel: Joi.string()
      .valid('HIGH', 'MEDIUM', 'LOW')
      .default('HIGH')
      .optional(),
    
    medicalCondition: Joi.string()
      .trim()
      .max(1000)
      .optional()
      .allow(null, ''),
    
    location: Joi.string()
      .trim()
      .min(3)
      .max(200)
      .required()
      .messages({
        'any.required': 'Location/area is required for donor search'
      }),
    
    additionalNotes: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow(null, ''),
    
    requiredByDate: Joi.date()
      .min('now')
      .required()
      .messages({
        'date.min': 'Required by date cannot be in the past',
        'any.required': 'Required by date is mandatory'
      }),
    
    allowContactReveal: Joi.boolean()
      .default(true)
      .optional()
  }),

  // Donor search schema
  searchDonors: Joi.object({
    requiredBloodGroup: Joi.string()
      .valid(
        'A_POSITIVE', 'A_NEGATIVE', 
        'B_POSITIVE', 'B_NEGATIVE', 
        'AB_POSITIVE', 'AB_NEGATIVE', 
        'O_POSITIVE', 'O_NEGATIVE'
      )
      .required(),
    
    location: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required(),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .optional()
  }),

  // Donor response schema
  respondToRequisition: Joi.object({
    response: Joi.string()
      .valid('WILLING', 'NOT_AVAILABLE', 'NOT_SUITABLE')
      .required(),
    
    message: Joi.string()
      .trim()
      .max(300)
      .optional()
      .allow(null, '')
  }),

  // Notification schemas
  notifyDonors: Joi.object({
    donorIds: Joi.array()
      .items(Joi.string().required())
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one donor must be selected',
        'array.max': 'Cannot notify more than 50 donors at once'
      }),
    
    customMessage: Joi.string()
      .trim()
      .max(200)
      .optional()
      .allow(null, '')
  }),

  // Query parameter schemas
  dashboardQuery: Joi.object({
    bloodGroup: Joi.string()
      .valid(
        'A_POSITIVE', 'A_NEGATIVE', 
        'B_POSITIVE', 'B_NEGATIVE', 
        'AB_POSITIVE', 'AB_NEGATIVE', 
        'O_POSITIVE', 'O_NEGATIVE'
      )
      .optional(),
    
    eligibleOnly: Joi.string()
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
      .optional(),
    
    city: Joi.string()
      .trim()
      .max(100)
      .optional()
  }),

  // Parameter schemas
  requisitionIdParam: Joi.object({
    requisitionId: Joi.string()
      .required()
      .messages({
        'any.required': 'Requisition ID is required'
      })
  }),

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

// Validate user is a blood donor
const validateBloodDonor = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isBloodDonor: true,
        bloodGroup: true
      }
    });

    if (!user?.isBloodDonor) {
      return errorResponse(res, 'Only registered blood donors can perform this action', 403);
    }

    if (!user.bloodGroup) {
      return errorResponse(res, 'Please complete your blood group information first', 400);
    }

    req.userBloodGroup = user.bloodGroup;
    next();
  } catch (error) {
    console.error('Blood donor validation error:', error);
    return errorResponse(res, 'Failed to validate blood donor status', 500);
  }
};

// Validate requisition access
const validateRequisitionAccess = async (req, res, next) => {
  try {
    const { requisitionId } = req.params;
    const userId = req.user.id;

    const requisition = await prisma.bloodRequisition.findUnique({
      where: { id: requisitionId },
      select: {
        id: true,
        requesterId: true,
        status: true,
        expiresAt: true
      }
    });

    if (!requisition) {
      return errorResponse(res, 'Blood requisition not found', 404);
    }

    // Check if user is the requester or super admin
    if (requisition.requesterId !== userId && req.user.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'You do not have access to this requisition', 403);
    }

    req.requisition = requisition;
    next();
  } catch (error) {
    console.error('Requisition access validation error:', error);
    return errorResponse(res, 'Failed to validate requisition access', 500);
  }
};

// Validate requisition is active
const validateActiveRequisition = (req, res, next) => {
  try {
    const { requisition } = req;

    if (!requisition) {
      return errorResponse(res, 'Requisition validation required first', 500);
    }

    if (requisition.status !== 'ACTIVE') {
      return errorResponse(res, 'This requisition is no longer active', 400);
    }

    if (requisition.expiresAt && new Date() > new Date(requisition.expiresAt)) {
      return errorResponse(res, 'This requisition has expired', 400);
    }

    next();
  } catch (error) {
    console.error('Active requisition validation error:', error);
    return errorResponse(res, 'Failed to validate requisition status', 500);
  }
};

// Validate notification access
const validateNotificationAccess = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await prisma.donorNotification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        donorId: true,
        status: true,
        requisitionId: true
      }
    });

    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    if (notification.donorId !== userId) {
      return errorResponse(res, 'You do not have access to this notification', 403);
    }

    req.notification = notification;
    next();
  } catch (error) {
    console.error('Notification access validation error:', error);
    return errorResponse(res, 'Failed to validate notification access', 500);
  }
};

// Validate user hasn't already responded to requisition
const validateUniqueResponse = async (req, res, next) => {
  try {
    const { requisitionId } = req.params;
    const userId = req.user.id;

    const existingResponse = await prisma.donorResponse.findUnique({
      where: {
        donorId_requisitionId: {
          donorId: userId,
          requisitionId
        }
      }
    });

    if (existingResponse) {
      return errorResponse(res, 'You have already responded to this requisition', 400, {
        existingResponse: {
          response: existingResponse.response,
          respondedAt: existingResponse.respondedAt
        }
      });
    }

    next();
  } catch (error) {
    console.error('Unique response validation error:', error);
    return errorResponse(res, 'Failed to validate response uniqueness', 500);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Data validation
  validateUpdateBloodProfile: validate('updateBloodProfile'),
  validateAddDonation: validate('addDonation'),
  validateCreateRequisition: validate('createRequisition'),
  validateSearchDonors: validate('searchDonors'),
  validateRespondToRequisition: validate('respondToRequisition'),
  validateNotifyDonors: validate('notifyDonors'),

  // Query validation
  validateDashboardQuery: validate('dashboardQuery', 'query'),

  // Parameter validation
  validateRequisitionIdParam: validate('requisitionIdParam', 'params'),
  validateNotificationIdParam: validate('notificationIdParam', 'params'),

  // Business rule validation
  validateBloodDonor,
  validateRequisitionAccess,
  validateActiveRequisition,
  validateNotificationAccess,
  validateUniqueResponse
};