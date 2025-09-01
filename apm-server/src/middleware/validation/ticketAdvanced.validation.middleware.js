const Joi = require('joi');
const { prisma } = require('../../config/database');
const { errorResponse } = require('../../utils/response');

// ==========================================
// TEMPLATE VALIDATION SCHEMAS
// ==========================================

// Create/Update template validation
const templateSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Template name must be at least 3 characters long',
    'string.max': 'Template name cannot exceed 100 characters',
    'string.empty': 'Template name is required',
    'any.required': 'Template name is required'
  }),
  
  description: Joi.string().max(300).optional().messages({
    'string.max': 'Description cannot exceed 300 characters'
  }),
  
  categoryId: Joi.string().required().messages({
    'string.empty': 'Category is required',
    'any.required': 'Category is required'
  }),
  
  subjectTemplate: Joi.string().min(5).max(200).required().messages({
    'string.min': 'Subject template must be at least 5 characters long',
    'string.max': 'Subject template cannot exceed 200 characters',
    'string.empty': 'Subject template is required',
    'any.required': 'Subject template is required'
  }),
  
  descriptionTemplate: Joi.string().min(10).max(5000).required().messages({
    'string.min': 'Description template must be at least 10 characters long',
    'string.max': 'Description template cannot exceed 5000 characters',
    'string.empty': 'Description template is required',
    'any.required': 'Description template is required'
  }),
  
  priorityDefault: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM').messages({
    'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
  }),
  
  isPublic: Joi.boolean().default(true),
  
  hasCustomFields: Joi.boolean().default(false),
  
  customFields: Joi.object().optional(),
  
  sortOrder: Joi.number().integer().min(0).default(0)
});

// ==========================================
// SEARCH & FILTER VALIDATION SCHEMAS
// ==========================================

// Advanced search validation
const advancedSearchSchema = Joi.object({
  query: Joi.string().max(200).optional().messages({
    'string.max': 'Search query cannot exceed 200 characters'
  }),
  
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED', 'REOPENED').optional(),
  
  categoryId: Joi.string().optional(),
  
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  
  assignedToId: Joi.string().optional(),
  
  createdByBatch: Joi.number().integer().min(2000).max(2030).optional(),
  
  dateFrom: Joi.date().optional(),
  
  dateTo: Joi.date().optional(),
  
  hasAttachments: Joi.boolean().optional(),
  
  tags: Joi.array().items(Joi.string()).optional(),
  
  page: Joi.number().integer().min(1).default(1),
  
  limit: Joi.number().integer().min(1).max(50).default(20)
}).custom((obj, helpers) => {
  // Date validation: dateTo should be after dateFrom
  if (obj.dateFrom && obj.dateTo && obj.dateFrom >= obj.dateTo) {
    return helpers.error('any.custom', {
      message: 'End date must be after start date'
    });
  }
  return obj;
});

// Save filter validation
const saveFilterSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Filter name must be at least 3 characters long',
    'string.max': 'Filter name cannot exceed 100 characters',
    'string.empty': 'Filter name is required',
    'any.required': 'Filter name is required'
  }),
  
  description: Joi.string().max(300).optional().messages({
    'string.max': 'Description cannot exceed 300 characters'
  }),
  
  filterConfig: Joi.object().required().messages({
    'any.required': 'Filter configuration is required'
  }),
  
  isDefault: Joi.boolean().default(false)
});

// ==========================================
// BULK OPERATION VALIDATION SCHEMAS
// ==========================================

// Bulk assign validation
const bulkAssignSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string()).min(1).max(100).required().messages({
    'array.min': 'At least one ticket must be selected',
    'array.max': 'Cannot process more than 100 tickets at once',
    'any.required': 'Ticket IDs are required'
  }),
  
  assignedToId: Joi.string().required().messages({
    'string.empty': 'Admin selection is required',
    'any.required': 'Admin selection is required'
  })
});

// Bulk status change validation
const bulkStatusSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string()).min(1).max(100).required().messages({
    'array.min': 'At least one ticket must be selected',
    'array.max': 'Cannot process more than 100 tickets at once',
    'any.required': 'Ticket IDs are required'
  }),
  
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED').required().messages({
    'any.only': 'Status must be one of: OPEN, IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED',
    'any.required': 'Status is required'
  })
});

// Bulk priority change validation
const bulkPrioritySchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string()).min(1).max(100).required().messages({
    'array.min': 'At least one ticket must be selected',
    'array.max': 'Cannot process more than 100 tickets at once',
    'any.required': 'Ticket IDs are required'
  }),
  
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').required().messages({
    'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT',
    'any.required': 'Priority is required'
  })
});

// Bulk close validation
const bulkCloseSchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string()).min(1).max(100).required().messages({
    'array.min': 'At least one ticket must be selected',
    'array.max': 'Cannot process more than 100 tickets at once',
    'any.required': 'Ticket IDs are required'
  }),
  
  resolutionNote: Joi.string().min(5).max(1000).required().messages({
    'string.min': 'Resolution note must be at least 5 characters long',
    'string.max': 'Resolution note cannot exceed 1000 characters',
    'string.empty': 'Resolution note is required',
    'any.required': 'Resolution note is required'
  })
});

// Bulk category change validation
const bulkCategorySchema = Joi.object({
  ticketIds: Joi.array().items(Joi.string()).min(1).max(100).required().messages({
    'array.min': 'At least one ticket must be selected',
    'array.max': 'Cannot process more than 100 tickets at once',
    'any.required': 'Ticket IDs are required'
  }),
  
  categoryId: Joi.string().required().messages({
    'string.empty': 'Category is required',
    'any.required': 'Category is required'
  })
});

// ==========================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ==========================================

// Generic validation helper
const validateData = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
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

// Template ID parameter validation
const validateTemplateIdParam = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    
    if (!templateId || typeof templateId !== 'string') {
      return errorResponse(res, 'Valid template ID is required', 400);
    }

    // Check if template exists
    const template = await prisma.ticketTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, isActive: true, isPublic: true, createdBy: true }
    });

    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    req.template = template;
    next();
  } catch (error) {
    console.error('Template ID validation error:', error);
    return errorResponse(res, 'Invalid template ID', 400);
  }
};

// ==========================================
// BUSINESS RULE VALIDATIONS
// ==========================================

// Validate user can access template
const validateTemplateAccess = async (req, res, next) => {
  try {
    const { template, user } = req;
    
    if (!template) {
      return errorResponse(res, 'Template validation required first', 500);
    }

    // Check if template is active
    if (!template.isActive) {
      return errorResponse(res, 'Template is not active', 400);
    }

    // Check access permissions
    if (!template.isPublic) {
      // Private templates only accessible to creator and super admins
      if (template.createdBy !== user.id && user.role !== 'SUPER_ADMIN') {
        return errorResponse(res, 'Access denied to this template', 403);
      }
    }

    next();
  } catch (error) {
    console.error('Template access validation error:', error);
    return errorResponse(res, 'Template access validation failed', 500);
  }
};

// Validate bulk operation ticket selection
const validateBulkTicketSelection = async (req, res, next) => {
  try {
    const { ticketIds } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return errorResponse(res, 'At least one ticket must be selected', 400);
    }

    // Check if all tickets exist and admin has permission
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: ticketIds } },
      select: { id: true, status: true }
    });

    if (tickets.length !== ticketIds.length) {
      return errorResponse(res, 'Some selected tickets do not exist', 400);
    }

    req.selectedTickets = tickets;
    next();
  } catch (error) {
    console.error('Bulk ticket selection validation error:', error);
    return errorResponse(res, 'Ticket selection validation failed', 500);
  }
};

// ==========================================
// EXPORTED MIDDLEWARE
// ==========================================

module.exports = {
  // Template validation
  validateTemplate: validateData(templateSchema),
  validateTemplateIdParam,
  validateTemplateAccess,
  
  // Search validation
  validateAdvancedSearch: validateData(advancedSearchSchema),
  validateSaveFilter: validateData(saveFilterSchema),
  
  // Bulk operation validation
  validateBulkAssign: validateData(bulkAssignSchema),
  validateBulkStatus: validateData(bulkStatusSchema),
  validateBulkPriority: validateData(bulkPrioritySchema),
  validateBulkClose: validateData(bulkCloseSchema),
  validateBulkCategory: validateData(bulkCategorySchema),
  validateBulkTicketSelection
};