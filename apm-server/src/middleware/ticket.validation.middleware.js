// ============================================
// FILE: src/middleware/ticket.validation.middleware.js
// ============================================

const Joi = require('joi');
const { prisma } = require('../config/database');
const { errorResponse } = require('../utils/response');

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

// Create ticket validation
const createTicketSchema = Joi.object({
  categoryId: Joi.string().required().messages({
    'string.empty': 'Category is required',
    'any.required': 'Category is required'
  }),
  
  subject: Joi.string().min(5).max(200).required().messages({
    'string.min': 'Subject must be at least 5 characters long',
    'string.max': 'Subject cannot exceed 200 characters',
    'string.empty': 'Subject is required',
    'any.required': 'Subject is required'
  }),
  
  description: Joi.string().min(10).max(5000).required().messages({
    'string.min': 'Description must be at least 10 characters long',
    'string.max': 'Description cannot exceed 5000 characters',
    'string.empty': 'Description is required',
    'any.required': 'Description is required'
  }),
  
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM').messages({
    'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
  }),
  
  assignedToId: Joi.string().optional().allow('').messages({
    'string.empty': 'Invalid admin selection'
  })
});

// Update ticket validation  
const updateTicketSchema = Joi.object({
  subject: Joi.string().min(5).max(200).optional().messages({
    'string.min': 'Subject must be at least 5 characters long',
    'string.max': 'Subject cannot exceed 200 characters'
  }),
  
  description: Joi.string().min(10).max(5000).optional().messages({
    'string.min': 'Description must be at least 10 characters long',
    'string.max': 'Description cannot exceed 5000 characters'
  }),
  
  categoryId: Joi.string().optional().messages({
    'string.empty': 'Invalid category selection'
  }),
  
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional().messages({
    'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
  })
});

// Add message validation
const addMessageSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 2000 characters',
    'string.empty': 'Message is required',
    'any.required': 'Message is required'
  }),
  
  isInternalNote: Joi.boolean().default(false)
});

// Reopen ticket validation
const reopenTicketSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required().messages({
    'string.min': 'Reason must be at least 5 characters long',
    'string.max': 'Reason cannot exceed 500 characters',
    'string.empty': 'Reason for reopening is required',
    'any.required': 'Reason for reopening is required'
  })
});

// Admin response validation
const adminResponseSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required().messages({
    'string.min': 'Response cannot be empty',
    'string.max': 'Response cannot exceed 2000 characters',
    'string.empty': 'Response is required',
    'any.required': 'Response is required'
  }),
  
  statusUpdate: Joi.string().valid('IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED').optional().messages({
    'any.only': 'Status must be one of: IN_PROGRESS, WAITING_FOR_USER, RESOLVED'
  })
});

// Close ticket validation
const closeTicketSchema = Joi.object({
  resolutionNote: Joi.string().min(5).max(1000).required().messages({
    'string.min': 'Resolution note must be at least 5 characters long',
    'string.max': 'Resolution note cannot exceed 1000 characters',
    'string.empty': 'Resolution note is required',
    'any.required': 'Resolution note is required'
  })
});

// Satisfaction rating validation
const satisfactionSchema = Joi.object({
  satisfaction: Joi.string().valid(
    'VERY_SATISFIED', 'SATISFIED', 'NEUTRAL', 'DISSATISFIED', 'VERY_DISSATISFIED'
  ).required().messages({
    'any.only': 'Satisfaction rating is required',
    'any.required': 'Satisfaction rating is required'
  }),
  
  satisfactionNote: Joi.string().max(500).optional().messages({
    'string.max': 'Feedback cannot exceed 500 characters'
  })
});

// Query parameter validation
const ticketQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  status: Joi.string().valid('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED', 'REOPENED').optional(),
  categoryId: Joi.string().optional(),
  priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional(),
  search: Joi.string().max(100).optional(),
  assignedToMe: Joi.boolean().default(false)
});

// Ticket category validation (Admin only)
const ticketCategorySchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Category name must be at least 2 characters long',
    'string.max': 'Category name cannot exceed 50 characters',
    'string.empty': 'Category name is required',
    'any.required': 'Category name is required'
  }),
  
  description: Joi.string().max(200).optional().messages({
    'string.max': 'Description cannot exceed 200 characters'
  }),
  
  icon: Joi.string().max(50).optional().messages({
    'string.max': 'Icon name cannot exceed 50 characters'
  }),
  
  priority: Joi.number().integer().min(0).default(0)
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

// Validate ticket ID parameter
const validateTicketIdParam = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    
    if (!ticketId || typeof ticketId !== 'string') {
      return errorResponse(res, 'Valid ticket ID is required', 400);
    }

    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, assignedToId: true, status: true }
    });

    if (!ticket) {
      return errorResponse(res, 'Ticket not found', 404);
    }

    req.ticket = ticket;
    next();
  } catch (error) {
    console.error('Ticket ID validation error:', error);
    return errorResponse(res, 'Invalid ticket ID', 400);
  }
};

// ==========================================
// BUSINESS RULE VALIDATIONS
// ==========================================

// Check if user owns the ticket or is admin
const validateTicketAccess = (req, res, next) => {
  try {
    const { ticket, user } = req;
    
    if (!ticket) {
      return errorResponse(res, 'Ticket validation required first', 500);
    }

    // Super admins can access any ticket
    if (user.role === 'SUPER_ADMIN') {
      req.isAdmin = true;
      return next();
    }

    // Users can only access their own tickets
    if (ticket.userId !== user.id) {
      return errorResponse(res, 'Access denied', 403);
    }

    req.isAdmin = false;
    next();
  } catch (error) {
    console.error('Ticket access validation error:', error);
    return errorResponse(res, 'Access validation failed', 500);
  }
};

// Validate ticket can be updated by user
const validateUserCanUpdateTicket = (req, res, next) => {
  try {
    const { ticket, user } = req;
    
    // Only ticket owner can update
    if (ticket.userId !== user.id) {
      return errorResponse(res, 'Only ticket owner can update ticket', 403);
    }

    // Cannot update closed tickets (user must reopen first)
    if (['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      return errorResponse(res, 'Cannot update closed tickets. Please reopen first.', 400);
    }

    next();
  } catch (error) {
    console.error('User update validation error:', error);
    return errorResponse(res, 'Update validation failed', 500);
  }
};

// Validate ticket can be reopened
const validateCanReopenTicket = (req, res, next) => {
  try {
    const { ticket } = req;
    
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      return errorResponse(res, 'Only resolved or closed tickets can be reopened', 400);
    }

    // Add limit for reopen count if needed
    if (ticket.reopenCount >= 5) {
      return errorResponse(res, 'This ticket has been reopened too many times. Please create a new ticket.', 400);
    }

    next();
  } catch (error) {
    console.error('Reopen validation error:', error);
    return errorResponse(res, 'Reopen validation failed', 500);
  }
};

// Validate category exists and is active
const validateCategoryExists = async (req, res, next) => {
  try {
    const { categoryId } = req.body;
    
    if (!categoryId) {
      return next();
    }

    const category = await prisma.ticketCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, isActive: true }
    });

    if (!category) {
      return errorResponse(res, 'Selected category does not exist', 400);
    }

    if (!category.isActive) {
      return errorResponse(res, 'Selected category is not available', 400);
    }

    req.category = category;
    next();
  } catch (error) {
    console.error('Category validation error:', error);
    return errorResponse(res, 'Category validation failed', 500);
  }
};

// Validate assigned admin exists and is active
const validateAssignedAdminExists = async (req, res, next) => {
  try {
    const { assignedToId } = req.body;
    
    if (!assignedToId) {
      return next();
    }

    const admin = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, fullName: true, role: true, isActive: true }
    });

    if (!admin) {
      return errorResponse(res, 'Selected admin does not exist', 400);
    }

    if (admin.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Selected user is not an admin', 400);
    }

    if (!admin.isActive) {
      return errorResponse(res, 'Selected admin is not available', 400);
    }

    req.assignedAdmin = admin;
    next();
  } catch (error) {
    console.error('Assigned admin validation error:', error);
    return errorResponse(res, 'Admin validation failed', 500);
  }
};

// ==========================================
// EXPORTED MIDDLEWARE
// ==========================================

module.exports = {
  // Data validation middleware
  validateCreateTicket: validateData(createTicketSchema),
  validateUpdateTicket: validateData(updateTicketSchema),
  validateAddMessage: validateData(addMessageSchema),
  validateReopenTicket: validateData(reopenTicketSchema),
  validateAdminResponse: validateData(adminResponseSchema),
  validateCloseTicket: validateData(closeTicketSchema),
  validateSatisfaction: validateData(satisfactionSchema),
  validateTicketQuery: validateData(ticketQuerySchema, 'query'),
  validateTicketCategory: validateData(ticketCategorySchema),

  // Parameter validation
  validateTicketIdParam,

  // Business rule validation
  validateTicketAccess,
  validateUserCanUpdateTicket,
  validateCanReopenTicket,
  validateCategoryExists,
  validateAssignedAdminExists
};
