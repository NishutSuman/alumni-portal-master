// src/middleware/poll.validation.middleware.js
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { errorResponse } = require('../utils/response');

const prisma = new PrismaClient();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const pollValidationSchemas = {
  createPoll: Joi.object({
    title: Joi.string()
      .trim()
      .min(3)
      .max(200)
      .required()
      .messages({
        'string.min': 'Poll title must be at least 3 characters',
        'string.max': 'Poll title cannot exceed 200 characters',
        'any.required': 'Poll title is required'
      }),
    description: Joi.string()
      .trim()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    options: Joi.array()
      .items(
        Joi.string()
          .trim()
          .min(1)
          .max(500)
          .required()
          .messages({
            'string.min': 'Poll option cannot be empty',
            'string.max': 'Poll option cannot exceed 500 characters'
          })
      )
      .min(2)
      .max(5)
      .unique()
      .required()
      .messages({
        'array.min': 'Poll must have at least 2 options',
        'array.max': 'Poll cannot have more than 5 options',
        'array.unique': 'Poll options must be unique',
        'any.required': 'Poll options are required'
      }),
    allowMultiple: Joi.boolean()
      .optional()
      .default(false),
    expiresAt: Joi.date()
      .iso()
      .min('now')
      .optional()
      .messages({
        'date.min': 'Expiry date must be in the future'
      }),
    isAnonymous: Joi.boolean()
      .optional()
      .default(false)
  }),

  updatePoll: Joi.object({
    title: Joi.string()
      .trim()
      .min(3)
      .max(200)
      .optional()
      .messages({
        'string.min': 'Poll title must be at least 3 characters',
        'string.max': 'Poll title cannot exceed 200 characters'
      }),
    description: Joi.string()
      .trim()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    isActive: Joi.boolean()
      .optional(),
    allowMultiple: Joi.boolean()
      .optional(),
    expiresAt: Joi.date()
      .iso()
      .min('now')
      .allow(null)
      .optional()
      .messages({
        'date.min': 'Expiry date must be in the future'
      }),
    isAnonymous: Joi.boolean()
      .optional()
  }),

  votePoll: Joi.object({
    optionIds: Joi.array()
      .items(
        Joi.string()
          .uuid()
          .required()
          .messages({
            'string.uuid': 'Invalid option ID format'
          })
      )
      .min(1)
      .max(5)
      .unique()
      .required()
      .messages({
        'array.min': 'At least one option must be selected',
        'array.max': 'Cannot select more than 5 options',
        'array.unique': 'Cannot select the same option twice',
        'any.required': 'Option selection is required'
      })
  })
};

// Parameter validation schemas
const pollParamSchemas = {
  pollIdParam: Joi.object({
    pollId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid poll ID format',
        'any.required': 'Poll ID is required'
      })
  })
};

// Query validation schemas
const pollQuerySchemas = {
  pollListQuery: Joi.object({
    isActive: Joi.string()
      .valid('true', 'false')
      .optional(),
    createdBy: Joi.string()
      .uuid()
      .optional(),
    hasExpired: Joi.string()
      .valid('true', 'false')
      .optional(),
    search: Joi.string()
      .trim()
      .max(100)
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
      .default(10)
      .optional(),
    sortBy: Joi.string()
      .valid('title', 'createdAt', 'updatedAt', 'expiresAt', 'voteCount')
      .default('createdAt')
      .optional(),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
      .optional()
  })
};

// ============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ============================================

// Generic validation function for request body
const validatePollData = (schemaName) => {
  return (req, res, next) => {
    const schema = pollValidationSchemas[schemaName];
    if (!schema) {
      return errorResponse(res, 'Invalid validation schema', 500);
    }

    const { error, value } = schema.validate(req.body, {
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

    req.body = value;
    next();
  };
};

// Generic parameter validation function
const validatePollParams = (schemaName) => {
  return (req, res, next) => {
    const schema = pollParamSchemas[schemaName];
    if (!schema) {
      return errorResponse(res, 'Invalid parameter validation schema', 500);
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

      return errorResponse(res, 'Parameter validation failed', 400, { errors });
    }

    req.params = value;
    next();
  };
};

// Query validation function
const validatePollQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = pollQuerySchemas[schemaName];
    if (!schema) {
      return errorResponse(res, 'Invalid query validation schema', 500);
    }

    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return errorResponse(res, 'Query validation failed', 400, { errors });
    }

    req.query = value;
    next();
  };
};

// ============================================
// BUSINESS RULE VALIDATIONS
// ============================================

// Validate poll access/existence
const validatePollAccess = async (req, res, next) => {
  try {
    const { pollId } = req.params;

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: {
        id: true,
        title: true,
        isActive: true,
        expiresAt: true,
        createdBy: true
      }
    });

    if (!poll) {
      return errorResponse(res, 'Poll not found', 404);
    }

    req.poll = poll;
    next();
  } catch (error) {
    console.error('Poll access validation error:', error);
    return errorResponse(res, 'Failed to validate poll access', 500);
  }
};

// Validate poll is active and not expired
const validatePollAvailable = (req, res, next) => {
  try {
    const { poll } = req;

    if (!poll) {
      return errorResponse(res, 'Poll validation required first', 500);
    }

    if (!poll.isActive) {
      return errorResponse(res, 'This poll is no longer active', 400);
    }

    if (poll.expiresAt && new Date() > new Date(poll.expiresAt)) {
      return errorResponse(res, 'This poll has expired', 400);
    }

    next();
  } catch (error) {
    console.error('Poll availability validation error:', error);
    return errorResponse(res, 'Failed to validate poll availability', 500);
  }
};

// Validate user hasn't already voted (for single-vote polls)
const validateUserVoteEligibility = async (req, res, next) => {
  try {
    const { pollId } = req.params;
    const userId = req.user.id;

    // Check if user has already voted
    const existingVote = await prisma.pollVote.findFirst({
      where: {
        pollId,
        userId
      },
      select: { id: true }
    });

    if (existingVote) {
      return errorResponse(res, 'You have already voted in this poll', 409);
    }

    next();
  } catch (error) {
    console.error('User vote eligibility validation error:', error);
    return errorResponse(res, 'Failed to validate vote eligibility', 500);
  }
};

// Validate selected options belong to the poll
const validatePollOptions = async (req, res, next) => {
  try {
    const { pollId } = req.params;
    const { optionIds } = req.body;

    // Get all options for this poll
    const pollOptions = await prisma.pollOption.findMany({
      where: { pollId },
      select: { id: true }
    });

    const validOptionIds = pollOptions.map(option => option.id);
    const invalidOptions = optionIds.filter(id => !validOptionIds.includes(id));

    if (invalidOptions.length > 0) {
      return errorResponse(res, 'Invalid poll options selected', 400, {
        invalidOptions
      });
    }

    // For single-vote polls, ensure only one option is selected
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { allowMultiple: true }
    });

    if (!poll.allowMultiple && optionIds.length > 1) {
      return errorResponse(res, 'This poll allows only one option selection', 400);
    }

    req.validOptionIds = optionIds;
    next();
  } catch (error) {
    console.error('Poll options validation error:', error);
    return errorResponse(res, 'Failed to validate poll options', 500);
  }
};

// Validate poll modification permissions
const validatePollModifyPermission = (req, res, next) => {
  try {
    const { poll } = req;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Super admin can modify any poll
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Poll creator can modify their own poll
    if (poll.createdBy === userId) {
      return next();
    }

    return errorResponse(res, 'You do not have permission to modify this poll', 403);
  } catch (error) {
    console.error('Poll modify permission validation error:', error);
    return errorResponse(res, 'Failed to validate poll modification permissions', 500);
  }
};

// Validate poll has votes (for deletion restrictions)
const validatePollHasNoVotes = async (req, res, next) => {
  try {
    const { pollId } = req.params;

    const voteCount = await prisma.pollVote.count({
      where: { pollId }
    });

    if (voteCount > 0) {
      return errorResponse(res, 'Cannot delete poll that has received votes', 400, {
        voteCount
      });
    }

    next();
  } catch (error) {
    console.error('Poll votes validation error:', error);
    return errorResponse(res, 'Failed to validate poll votes', 500);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Data validation
  validateCreatePoll: validatePollData('createPoll'),
  validateUpdatePoll: validatePollData('updatePoll'),
  validateVotePoll: validatePollData('votePoll'),

  // Parameter validation
  validatePollIdParam: validatePollParams('pollIdParam'),

  // Query validation
  validatePollListQuery: validatePollQuery('pollListQuery'),

  // Business rule validation
  validatePollAccess,
  validatePollAvailable,
  validateUserVoteEligibility,
  validatePollOptions,
  validatePollModifyPermission,
  validatePollHasNoVotes
};