// src/middleware/feedback.validation.middleware.js
const Joi = require('joi');
const { prisma } = require('../config/database');

// =============================================
// FEEDBACK VALIDATION SCHEMAS
// =============================================

const feedbackSchemas = {
  // Create or update feedback form
  createOrUpdateFeedbackForm: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional().default('Event Feedback').messages({
      'string.min': 'Title must be at least 3 characters long',
      'string.max': 'Title must be less than 200 characters'
    }),
    
    description: Joi.string().trim().max(1000).optional().allow(null, '').messages({
      'string.max': 'Description must be less than 1000 characters'
    }),
    
    allowAnonymous: Joi.boolean().optional().default(true),
    showAfterEvent: Joi.boolean().optional().default(true),
    autoSendReminders: Joi.boolean().optional().default(false),
    
    reminderDelayHours: Joi.number().integer().min(1).max(168).optional().default(24).messages({
      'number.min': 'Reminder delay must be at least 1 hour',
      'number.max': 'Reminder delay cannot exceed 168 hours (7 days)'
    }),
    
    closeAfterHours: Joi.number().integer().min(1).max(8760).optional().default(168).messages({
      'number.min': 'Close delay must be at least 1 hour', 
      'number.max': 'Close delay cannot exceed 8760 hours (1 year)'
    }),
    
    completionMessage: Joi.string().trim().max(500).optional().default('Thank you for your feedback!').messages({
      'string.max': 'Completion message must be less than 500 characters'
    })
  }),

  // Add feedback field
  addFeedbackField: Joi.object({
    fieldName: Joi.string().trim().min(2).max(100).required()
      .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .messages({
        'string.empty': 'Field name is required',
        'string.min': 'Field name must be at least 2 characters long',
        'string.max': 'Field name must be less than 100 characters',
        'string.pattern.base': 'Field name must start with a letter and contain only letters, numbers, and underscores'
      }),
      
    fieldLabel: Joi.string().trim().min(2).max(200).required().messages({
      'string.empty': 'Field label is required',
      'string.min': 'Field label must be at least 2 characters long',
      'string.max': 'Field label must be less than 200 characters'
    }),
    
    fieldType: Joi.string()
      .valid('TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'SELECT', 'RADIO', 'CHECKBOX', 'RATING', 'LIKERT', 'SENTIMENT')
      .required()
      .messages({
        'any.only': 'Field type must be one of: TEXT, EMAIL, PHONE, TEXTAREA, SELECT, RADIO, CHECKBOX, RATING, LIKERT, SENTIMENT',
        'any.required': 'Field type is required'
      }),
      
    options: Joi.when('fieldType', {
      is: Joi.string().valid('SELECT', 'RADIO', 'CHECKBOX'),
      then: Joi.array().items(Joi.string().trim().min(1)).min(1).required().messages({
        'array.min': 'At least one option is required for SELECT, RADIO, and CHECKBOX fields',
        'any.required': 'Options are required for SELECT, RADIO, and CHECKBOX fields'
      }),
      otherwise: Joi.array().optional()
    }),
    
    isRequired: Joi.boolean().optional().default(false),
    
    // Rating field specific validations
    minValue: Joi.when('fieldType', {
      is: 'RATING',
      then: Joi.number().integer().min(1).max(10).optional().default(1),
      otherwise: Joi.number().integer().optional()
    }),
    
    maxValue: Joi.when('fieldType', {
      is: 'RATING', 
      then: Joi.number().integer().min(Joi.ref('minValue')).max(10).optional().default(5),
      otherwise: Joi.number().integer().optional()
    }),
    
    stepValue: Joi.when('fieldType', {
      is: 'RATING',
      then: Joi.number().positive().max(5).optional().default(1),
      otherwise: Joi.number().optional()
    }),
    
    ratingStyle: Joi.when('fieldType', {
      is: 'RATING',
      then: Joi.string().valid('stars', 'numbers', 'emoji').optional().default('stars'),
      otherwise: Joi.string().optional()
    }),
    
    placeholder: Joi.string().trim().max(200).optional().messages({
      'string.max': 'Placeholder must be less than 200 characters'
    }),
    
    helpText: Joi.string().trim().max(500).optional().messages({
      'string.max': 'Help text must be less than 500 characters'
    })
  }),

  // Update feedback field
  updateFeedbackField: Joi.object({
    fieldName: Joi.string().trim().min(2).max(100).optional()
      .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    fieldLabel: Joi.string().trim().min(2).max(200).optional(),
    fieldType: Joi.string()
      .valid('TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'SELECT', 'RADIO', 'CHECKBOX', 'RATING', 'LIKERT', 'SENTIMENT')
      .optional(),
    options: Joi.array().items(Joi.string().trim().min(1)).optional(),
    isRequired: Joi.boolean().optional(),
    minValue: Joi.number().integer().optional(),
    maxValue: Joi.number().integer().optional(),
    stepValue: Joi.number().positive().optional(),
    ratingStyle: Joi.string().valid('stars', 'numbers', 'emoji').optional(),
    placeholder: Joi.string().trim().max(200).optional(),
    helpText: Joi.string().trim().max(500).optional()
  }),

  // Reorder feedback fields
  reorderFeedbackFields: Joi.object({
    fieldIds: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
      'array.min': 'At least one field ID is required',
      'any.required': 'Field IDs array is required'
    })
  }),

  // Submit feedback
  submitFeedback: Joi.object({
    responses: Joi.object().pattern(
      Joi.string().uuid(), // field ID
      Joi.alternatives().try(
        Joi.string(),
        Joi.number(),
        Joi.array().items(Joi.string()),
        Joi.boolean()
      )
    ).min(1).required().messages({
      'object.min': 'At least one response is required',
      'any.required': 'Responses are required'
    }),
    
    isAnonymous: Joi.boolean().optional().default(false)
  })
};

// Parameter validation schemas
const feedbackParamSchemas = {
  eventId: Joi.object({
    eventId: Joi.string().uuid().required().messages({
      'string.uuid': 'Invalid event ID format',
      'any.required': 'Event ID is required'
    })
  }),
  
  fieldId: Joi.object({
    eventId: Joi.string().uuid().required().messages({
      'string.uuid': 'Invalid event ID format',
      'any.required': 'Event ID is required'
    }),
    fieldId: Joi.string().uuid().required().messages({
      'string.uuid': 'Invalid field ID format',
      'any.required': 'Field ID is required'
    })
  })
};

// =============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// =============================================

// Generic validation middleware
const validateFeedback = (schemaName, property = 'body') => {
  return (req, res, next) => {
    const schema = feedbackSchemas[schemaName];
    
    if (!schema) {
      return res.status(500).json({
        success: false,
        message: 'Validation schema not found'
      });
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

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    req[property] = value;
    next();
  };
};

// Parameter validation middleware
const validateFeedbackParams = (schemaName) => {
  return (req, res, next) => {
    const schema = feedbackParamSchemas[schemaName];
    
    if (!schema) {
      return res.status(500).json({
        success: false,
        message: 'Parameter validation schema not found'
      });
    }

    const { error, value } = schema.validate(req.params, {
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
        message: 'Parameter validation failed',
        errors
      });
    }

    req.params = value;
    next();
  };
};

// =============================================
// BUSINESS LOGIC VALIDATION
// =============================================

// Validate feedback form access permissions
const validateFeedbackFormAccess = async (req, res, next) => {
  const { eventId } = req.params;
  const userId = req.user?.id;
  const isAdmin = req.user?.role === 'SUPER_ADMIN';
  
  try {
    // Get event and feedback form
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        feedbackForm: {
          select: {
            id: true,
            isActive: true,
            allowAnonymous: true,
            showAfterEvent: true,
            closeAfterHours: true
          }
        }
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (!event.feedbackForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found for this event'
      });
    }

    // Admin always has access
    if (isAdmin) {
      req.eventData = event;
      return next();
    }

    // Check if form is active
    if (!event.feedbackForm.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Feedback form is not active'
      });
    }

    // Check timing constraints
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    
    if (event.feedbackForm.showAfterEvent && now < eventDate) {
      return res.status(403).json({
        success: false,
        message: 'Feedback form not available yet'
      });
    }

    // Check if form is closed
    const closeDate = new Date(eventDate.getTime() + (event.feedbackForm.closeAfterHours * 60 * 60 * 1000));
    if (now > closeDate) {
      return res.status(403).json({
        success: false,
        message: 'Feedback form is now closed'
      });
    }

    req.eventData = event;
    next();

  } catch (error) {
    console.error('Feedback form access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate access'
    });
  }
};

// Validate feedback submission permissions
const validateFeedbackSubmission = async (req, res, next) => {
  const { eventId } = req.params;
  const { isAnonymous } = req.body;
  const userId = req.user?.id;
  
  try {
    const event = req.eventData; // Should be set by validateFeedbackFormAccess
    
    if (!event) {
      return res.status(500).json({
        success: false,
        message: 'Event data not available'
      });
    }

    // Check anonymous submission permission
    if (isAnonymous && !event.feedbackForm.allowAnonymous) {
      return res.status(400).json({
        success: false,
        message: 'Anonymous feedback not allowed for this form'
      });
    }

    // For non-anonymous, require authentication
    if (!isAnonymous && !userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required for non-anonymous feedback'
      });
    }

    // Check if user already submitted (for identified responses)
    if (!isAnonymous && userId) {
      const existingResponse = await prisma.eventFeedbackResponse.findFirst({
        where: {
          feedbackFormId: event.feedbackForm.id,
          userId
        }
      });

      if (existingResponse) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted feedback for this event'
        });
      }
    }

    next();

  } catch (error) {
    console.error('Feedback submission validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate submission'
    });
  }
};

// Validate field modification permissions
const validateFieldModification = async (req, res, next) => {
  const { eventId } = req.params;
  
  try {
    // Check if feedback form has responses
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId },
      include: {
        _count: {
          select: { responses: true }
        }
      }
    });

    if (!feedbackForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found'
      });
    }

    if (feedbackForm._count.responses > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify form with existing responses'
      });
    }

    req.feedbackFormData = feedbackForm;
    next();

  } catch (error) {
    console.error('Field modification validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate modification'
    });
  }
};

// =============================================
// EXPORTED MIDDLEWARE FUNCTIONS
// =============================================

// Form management validation
const validateCreateOrUpdateFeedbackForm = validateFeedback('createOrUpdateFeedbackForm');
const validateAddFeedbackField = validateFeedback('addFeedbackField');
const validateUpdateFeedbackField = validateFeedback('updateFeedbackField');
const validateReorderFeedbackFields = validateFeedback('reorderFeedbackFields');

// Feedback submission validation
const validateSubmitFeedback = validateFeedback('submitFeedback');

// Parameter validation
const validateEventIdParam = validateFeedbackParams('eventId');
const validateFieldIdParam = validateFeedbackParams('fieldId');

module.exports = {
  // Schema validation
  validateCreateOrUpdateFeedbackForm,
  validateAddFeedbackField,
  validateUpdateFeedbackField,
  validateReorderFeedbackFields,
  validateSubmitFeedback,
  
  // Parameter validation
  validateEventIdParam,
  validateFieldIdParam,
  
  // Business logic validation
  validateFeedbackFormAccess,
  validateFeedbackSubmission,
  validateFieldModification,
  
  // Export schemas for testing
  feedbackSchemas,
  feedbackParamSchemas
};