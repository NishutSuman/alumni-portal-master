// src/middleware/sponsor.validation.middleware.js
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { errorResponse } = require('../utils/response');

const prisma = new PrismaClient();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const sponsorValidationSchemas = {
  createSponsor: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Sponsor name must be at least 2 characters',
        'string.max': 'Sponsor name cannot exceed 100 characters',
        'any.required': 'Sponsor name is required'
      }),
    category: Joi.string()
      .valid('GOLD', 'SILVER', 'BRONZE')
      .required()
      .messages({
        'any.only': 'Sponsor category must be one of: GOLD, SILVER, BRONZE',
        'any.required': 'Sponsor category is required'
      }),
    description: Joi.string()
      .trim()
      .max(2000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 2000 characters'
      }),
    website: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .allow('')
      .optional()
      .messages({
        'string.uri': 'Website must be a valid URL'
      }),
    contactEmail: Joi.string()
      .email()
      .allow('')
      .optional()
      .messages({
        'string.email': 'Contact email must be a valid email address'
      }),
    displayOrder: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Display order must be a non-negative integer'
      })
  }),

  updateSponsor: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Sponsor name must be at least 2 characters',
        'string.max': 'Sponsor name cannot exceed 100 characters'
      }),
    category: Joi.string()
      .valid('GOLD', 'SILVER', 'BRONZE')
      .optional()
      .messages({
        'any.only': 'Sponsor category must be one of: GOLD, SILVER, BRONZE'
      }),
    description: Joi.string()
      .trim()
      .max(2000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 2000 characters'
      }),
    website: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .allow('')
      .optional()
      .messages({
        'string.uri': 'Website must be a valid URL'
      }),
    contactEmail: Joi.string()
      .email()
      .allow('')
      .optional()
      .messages({
        'string.email': 'Contact email must be a valid email address'
      }),
    isActive: Joi.boolean()
      .optional(),
    displayOrder: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Display order must be a non-negative integer'
      })
  }),

  reorderSponsors: Joi.object({
    sponsors: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().required(),
          displayOrder: Joi.number().integer().min(0).required()
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one sponsor is required for reordering'
      })
  })
};

// Parameter validation schemas
const sponsorParamSchemas = {
  sponsorIdParam: Joi.object({
    sponsorId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid sponsor ID format',
        'any.required': 'Sponsor ID is required'
      })
  })
};

// Query validation schemas
const sponsorQuerySchemas = {
  sponsorListQuery: Joi.object({
    category: Joi.string()
      .valid('GOLD', 'SILVER', 'BRONZE')
      .optional(),
    isActive: Joi.string()
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
      .valid('name', 'category', 'displayOrder', 'createdAt', 'updatedAt')
      .default('displayOrder')
      .optional(),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('asc')
      .optional()
  })
};

// ============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ============================================

// Generic validation function for request body
const validateSponsorData = (schemaName) => {
  return (req, res, next) => {
    const schema = sponsorValidationSchemas[schemaName];
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
const validateSponsorParams = (schemaName) => {
  return (req, res, next) => {
    const schema = sponsorParamSchemas[schemaName];
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
const validateSponsorQuery = (schemaName) => {
  return (req, res, next) => {
    const schema = sponsorQuerySchemas[schemaName];
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

// Validate sponsor name uniqueness
const validateSponsorNameUnique = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { sponsorId } = req.params;

    if (!name) {
      return next();
    }

    const existingSponsor = await prisma.sponsor.findFirst({
      where: {
        name: name.trim(),
        ...(sponsorId && { id: { not: sponsorId } })
      },
      select: { id: true, name: true }
    });

    if (existingSponsor) {
      return errorResponse(res, 'Sponsor name already exists', 409, {
        field: 'name',
        existingSponsor: existingSponsor.name
      });
    }

    next();
  } catch (error) {
    console.error('Sponsor name validation error:', error);
    return errorResponse(res, 'Failed to validate sponsor name', 500);
  }
};

// Validate sponsor access/existence
const validateSponsorAccess = async (req, res, next) => {
  try {
    const { sponsorId } = req.params;

    const sponsor = await prisma.sponsor.findUnique({
      where: { id: sponsorId },
      select: {
        id: true,
        name: true,
        category: true,
        isActive: true
      }
    });

    if (!sponsor) {
      return errorResponse(res, 'Sponsor not found', 404);
    }

    req.sponsor = sponsor;
    next();
  } catch (error) {
    console.error('Sponsor access validation error:', error);
    return errorResponse(res, 'Failed to validate sponsor access', 500);
  }
};

// Validate file uploads
const validateSponsorFileUpload = (req, res, next) => {
  try {
    const files = req.files;
    const file = req.file;
    const errors = [];

    // Check if we have files to validate
    const filesToValidate = [];
    if (files) {
      // Multiple files (fields upload)
      if (files.logoFile) filesToValidate.push(...files.logoFile);
      if (files.headPhotoFile) filesToValidate.push(...files.headPhotoFile);
    } else if (file) {
      // Single file upload
      filesToValidate.push(file);
    }

    if (filesToValidate.length === 0) {
      return next(); // No files to validate
    }

    filesToValidate.forEach((file, index) => {
      // File type validation
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        errors.push(`File ${index + 1}: Invalid file type. Only JPEG, PNG, and WebP are allowed`);
      }

      // File size validation (3MB per file)
      const maxSize = 3 * 1024 * 1024; // 3MB
      if (file.size > maxSize) {
        errors.push(`File ${index + 1}: File size exceeds 3MB limit`);
      }
    });

    if (errors.length > 0) {
      return errorResponse(res, 'File validation failed', 400, { errors });
    }

    next();
  } catch (error) {
    console.error('Sponsor file upload validation error:', error);
    return errorResponse(res, 'File upload validation failed', 500);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Data validation
  validateCreateSponsor: validateSponsorData('createSponsor'),
  validateUpdateSponsor: validateSponsorData('updateSponsor'),
  validateReorderSponsors: validateSponsorData('reorderSponsors'),

  // Parameter validation
  validateSponsorIdParam: validateSponsorParams('sponsorIdParam'),

  // Query validation
  validateSponsorListQuery: validateSponsorQuery('sponsorListQuery'),

  // Business rule validation
  validateSponsorNameUnique,
  validateSponsorAccess,
  validateSponsorFileUpload
};