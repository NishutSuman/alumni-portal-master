const Joi = require('joi');
const { prisma } = require('../config/database');
const { errorResponse } = require('../utils/response');

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

// Enhanced message creation (supports rich text)
const enhancedAddMessageSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required().messages({
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 5000 characters',
    'string.empty': 'Message is required',
    'any.required': 'Message is required'
  }),
  
  contentType: Joi.string().valid('PLAIN_TEXT', 'RICH_TEXT', 'HTML').default('PLAIN_TEXT').messages({
    'any.only': 'Content type must be one of: PLAIN_TEXT, RICH_TEXT, HTML'
  }),
  
  formattedContent: Joi.string().optional().messages({
    'string.base': 'Formatted content must be a valid JSON string'
  }),
  
  isInternalNote: Joi.boolean().default(false)
});

// Message edit validation
const editMessageSchema = Joi.object({
  message: Joi.string().min(1).max(5000).required().messages({
    'string.min': 'Message cannot be empty',
    'string.max': 'Message cannot exceed 5000 characters',
    'string.empty': 'Message is required',
    'any.required': 'Message is required'
  }),
  
  editReason: Joi.string().max(200).optional().messages({
    'string.max': 'Edit reason cannot exceed 200 characters'
  })
});

// Message reaction validation
const messageReactionSchema = Joi.object({
  reaction: Joi.string().valid(
    'HELPFUL', 'SOLVED', 'NEEDS_CLARIFICATION', 'THUMBS_UP', 'THUMBS_DOWN'
  ).required().messages({
    'any.only': 'Reaction must be one of: HELPFUL, SOLVED, NEEDS_CLARIFICATION, THUMBS_UP, THUMBS_DOWN',
    'any.required': 'Reaction is required'
  })
});

// Draft message validation
const messageDraftSchema = Joi.object({
  content: Joi.string().min(1).max(5000).required().messages({
    'string.min': 'Draft content cannot be empty',
    'string.max': 'Draft content cannot exceed 5000 characters',
    'string.empty': 'Draft content is required',
    'any.required': 'Draft content is required'
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

// Message ID parameter validation
const validateMessageIdParam = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    
    if (!messageId || typeof messageId !== 'string') {
      return errorResponse(res, 'Valid message ID is required', 400);
    }

    // Check if message exists
    const message = await prisma.ticketMessage.findUnique({
      where: { id: messageId },
      select: { 
        id: true, 
        ticketId: true, 
        senderId: true,
        isInternalNote: true,
        createdAt: true
      }
    });

    if (!message) {
      return errorResponse(res, 'Message not found', 404);
    }

    req.message = message;
    next();
  } catch (error) {
    console.error('Message ID validation error:', error);
    return errorResponse(res, 'Invalid message ID', 400);
  }
};

// ==========================================
// BUSINESS RULE VALIDATIONS
// ==========================================

// Check if user can edit the message
const validateMessageEditPermission = async (req, res, next) => {
  try {
    const { message, user } = req;
    
    if (!message) {
      return errorResponse(res, 'Message validation required first', 500);
    }

    // Permission check: user can edit their own messages, admins can edit any
    const isAdmin = user.role === 'SUPER_ADMIN';
    const isOwner = message.senderId === user.id;
    
    if (!isOwner && !isAdmin) {
      return errorResponse(res, 'Permission denied to edit this message', 403);
    }

    // Check if message is too old to edit (24 hours for users, unlimited for admins)
    if (!isAdmin) {
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (messageAge > maxEditAge) {
        return errorResponse(res, 'Message is too old to edit (24 hour limit)', 400);
      }
    }

    req.canEdit = true;
    next();
  } catch (error) {
    console.error('Message edit permission validation error:', error);
    return errorResponse(res, 'Permission validation failed', 500);
  }
};

// Check if user can react to the message
const validateMessageReactionPermission = async (req, res, next) => {
  try {
    const { message, user } = req;
    
    if (!message) {
      return errorResponse(res, 'Message validation required first', 500);
    }

    // Get ticket info for permission check
    const ticket = await prisma.ticket.findUnique({
      where: { id: message.ticketId },
      select: { userId: true, assignedToId: true }
    });

    if (!ticket) {
      return errorResponse(res, 'Associated ticket not found', 404);
    }

    // Permission check: ticket owner, assigned admin, or super admin can react
    const hasAccess = ticket.userId === user.id || 
                     ticket.assignedToId === user.id ||
                     user.role === 'SUPER_ADMIN';
    
    if (!hasAccess) {
      return errorResponse(res, 'Permission denied to react to this message', 403);
    }

    // Users cannot react to internal notes (only admins see them anyway)
    if (message.isInternalNote && user.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Cannot react to internal notes', 400);
    }

    req.ticket = ticket;
    next();
  } catch (error) {
    console.error('Message reaction permission validation error:', error);
    return errorResponse(res, 'Permission validation failed', 500);
  }
};

// Validate formatted content JSON
const validateFormattedContent = (req, res, next) => {
  try {
    const { formattedContent } = req.body;
    
    if (formattedContent) {
      try {
        JSON.parse(formattedContent);
      } catch (jsonError) {
        return errorResponse(res, 'Invalid JSON in formatted content', 400);
      }
    }
    
    next();
  } catch (error) {
    console.error('Formatted content validation error:', error);
    return errorResponse(res, 'Content validation failed', 500);
  }
};

// ==========================================
// EXPORTED MIDDLEWARE
// ==========================================

module.exports = {
  // Data validation middleware
  validateEnhancedAddMessage: validateData(enhancedAddMessageSchema),
  validateEditMessage: validateData(editMessageSchema),
  validateMessageReaction: validateData(messageReactionSchema),
  validateMessageDraft: validateData(messageDraftSchema),

  // Parameter validation
  validateMessageIdParam,

  // Business rule validation
  validateMessageEditPermission,
  validateMessageReactionPermission,
  validateFormattedContent
};