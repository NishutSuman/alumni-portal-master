// src/middleware/batchCollection.validation.middleware.js
const Joi = require('joi');
const { prisma } = require('../../config/database');

// Validation schemas
const batchCollectionSchemas = {
  createBatchCollection: Joi.object({
    targetAmount: Joi.number()
      .positive()
      .min(100)
      .max(100000)
      .precision(2)
      .required()
      .messages({
        'number.base': 'Target amount must be a number',
        'number.positive': 'Target amount must be positive',
        'number.min': 'Target amount must be at least ₹100',
        'number.max': 'Target amount cannot exceed ₹1,00,000',
        'any.required': 'Target amount is required'
      }),
    
    description: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      })
  }),

  batchAdminPayment: Joi.object({
    amount: Joi.number()
      .positive()
      .min(10)
      .max(50000)
      .precision(2)
      .required()
      .messages({
        'number.base': 'Payment amount must be a number',
        'number.positive': 'Payment amount must be positive',
        'number.min': 'Minimum payment amount is ₹10',
        'number.max': 'Maximum payment amount is ₹50,000',
        'any.required': 'Payment amount is required'
      }),
    
    notes: Joi.string()
      .max(200)
      .optional()
      .messages({
        'string.max': 'Notes cannot exceed 200 characters'
      })
  }),

  approveRejectCollection: Joi.object({
    reason: Joi.string()
      .min(10)
      .max(300)
      .required()
      .messages({
        'string.min': 'Reason must be at least 10 characters',
        'string.max': 'Reason cannot exceed 300 characters',
        'any.required': 'Reason is required'
      })
  })
};

/**
 * Validate event ID parameter
 */
const validateEventIdParam = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!eventId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid event ID is required'
      });
    }

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { 
        id: true, 
        title: true, 
        status: true,
        startsAt: true,
        registrationEndsAt: true
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Attach event to request for use in controller
    req.event = event;
    next();

  } catch (error) {
    console.error('Validate event ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate event'
    });
  }
};

/**
 * Validate batch year parameter
 */
const validateBatchYearParam = async (req, res, next) => {
  try {
    const { batchYear } = req.params;

    // Validate batch year format
    const yearNumber = parseInt(batchYear);
    if (isNaN(yearNumber) || yearNumber < 1990 || yearNumber > new Date().getFullYear() + 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch year. Must be between 1990 and next year.'
      });
    }

    // Verify batch exists
    const batch = await prisma.batch.findUnique({
      where: { year: yearNumber },
      select: { year: true, name: true }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: `Batch ${yearNumber} not found`
      });
    }

    // Attach batch to request
    req.batch = batch;
    next();

  } catch (error) {
    console.error('Validate batch year error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate batch year'
    });
  }
};

/**
 * Validate create batch collection request
 */
const validateCreateBatchCollection = (req, res, next) => {
  const { error, value } = batchCollectionSchemas.createBatchCollection.validate(req.body, {
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
      message: 'Batch collection validation failed',
      errors
    });
  }

  req.body = value;
  next();
};

/**
 * Validate batch admin payment request
 */
const validateBatchAdminPayment = (req, res, next) => {
  const { error, value } = batchCollectionSchemas.batchAdminPayment.validate(req.body, {
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
      message: 'Payment validation failed',
      errors
    });
  }

  req.body = value;
  next();
};

/**
 * Validate approve/reject collection request
 */
const validateApproveRejectCollection = (req, res, next) => {
  const { error, value } = batchCollectionSchemas.approveRejectCollection.validate(req.body, {
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
      message: 'Approval/rejection validation failed',
      errors
    });
  }

  req.body = value;
  next();
};

/**
 * Validate event is eligible for batch collection
 */
const validateEventEligibleForBatchCollection = (req, res, next) => {
  try {
    const event = req.event; // Should be attached by validateEventIdParam

    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create batch collection for unpublished event'
      });
    }

    if (new Date() > new Date(event.registrationEndsAt)) {
      return res.status(400).json({
        success: false,
        message: 'Registration period has ended for this event'
      });
    }

    next();

  } catch (error) {
    console.error('Validate event eligibility error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate event eligibility'
    });
  }
};

/**
 * Check if user is batch admin for the specified batch
 */
const requireBatchAdminForBatch = async (req, res, next) => {
  try {
    const { batchYear } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Super admins have access to all batches
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Check if user is batch admin for this specific batch
    const assignment = await prisma.batchAdminAssignment.findUnique({
      where: {
        userId_batchYear: {
          userId,
          batchYear: parseInt(batchYear)
        }
      },
      select: { isActive: true }
    });

    if (!assignment || !assignment.isActive) {
      return res.status(403).json({
        success: false,
        message: `You are not authorized as batch admin for batch ${batchYear}`
      });
    }

    next();

  } catch (error) {
    console.error('Require batch admin error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify batch admin authorization'
    });
  }
};

/**
 * Validate no duplicate batch collection exists
 */
const validateNoDuplicateBatchCollection = async (req, res, next) => {
  try {
    const { eventId, batchYear } = req.params;

    const existingCollection = await prisma.batchEventCollection.findUnique({
      where: {
        eventId_batchYear: {
          eventId,
          batchYear: parseInt(batchYear)
        }
      },
      select: { 
        id: true, 
        status: true,
        targetAmount: true,
        collectedAmount: true 
      }
    });

    if (existingCollection) {
      return res.status(409).json({
        success: false,
        message: `Batch collection already exists for this event and batch`,
        existingCollection: {
          id: existingCollection.id,
          status: existingCollection.status,
          targetAmount: existingCollection.targetAmount,
          collectedAmount: existingCollection.collectedAmount
        }
      });
    }

    next();

  } catch (error) {
    console.error('Validate no duplicate collection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate duplicate collection'
    });
  }
};

/**
 * Validate batch has active admins
 */
const validateBatchHasActiveAdmins = async (req, res, next) => {
  try {
    const { batchYear } = req.params;

    const activeAdmins = await prisma.batchAdminAssignment.count({
      where: {
        batchYear: parseInt(batchYear),
        isActive: true
      }
    });

    if (activeAdmins === 0) {
      return res.status(400).json({
        success: false,
        message: `No active batch admins found for batch ${batchYear}. Please assign batch admins before creating collection.`
      });
    }

    next();

  } catch (error) {
    console.error('Validate batch has active admins error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate batch admin requirements'
    });
  }
};

/**
 * Rate limiting for batch collection operations
 */
const batchCollectionRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const action = req.route.path;
    const rateLimitKey = `batch_collection:ratelimit:${userId}:${action}`;

    // Check current attempts
    const attempts = await CacheService.get(rateLimitKey) || 0;

    // Allow 10 attempts per hour for batch collection operations
    if (attempts >= 10) {
      return res.status(429).json({
        success: false,
        message: 'Too many batch collection operation attempts. Please try again later.',
        retryAfter: 3600 // 1 hour
      });
    }

    // Increment attempts counter
    await CacheService.set(rateLimitKey, attempts + 1, 3600); // 1 hour TTL

    next();

  } catch (error) {
    console.error('Batch collection rate limit error:', error);
    // Don't block request if rate limiting fails
    next();
  }
};

module.exports = {
  validateEventIdParam,
  validateBatchYearParam,
  validateCreateBatchCollection,
  validateBatchAdminPayment,
  validateApproveRejectCollection,
  validateEventEligibleForBatchCollection,
  requireBatchAdminForBatch,
  validateNoDuplicateBatchCollection,
  validateBatchHasActiveAdmins,
  batchCollectionRateLimit,

  // Export schemas for testing
  batchCollectionSchemas
};