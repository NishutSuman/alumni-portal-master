// src/middleware/photo.validation.middleware.js
const Joi = require('joi');
const { prisma } = require('../config/database');

// ============================================
// VALIDATION SCHEMAS
// ============================================

const photoValidationSchemas = {
  // Album validation schemas
  createAlbum: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Album name must be at least 2 characters',
        'string.max': 'Album name must be less than 100 characters',
        'any.required': 'Album name is required'
      }),
    description: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Description must be less than 500 characters'
      })
  }),

  updateAlbum: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Album name must be at least 2 characters',
        'string.max': 'Album name must be less than 100 characters'
      }),
    description: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Description must be less than 500 characters'
      }),
    isArchived: Joi.boolean().optional()
  }),

  // Photo validation schemas
  updatePhoto: Joi.object({
    caption: Joi.string()
      .trim()
      .max(500)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Caption must be less than 500 characters'
      }),
    tags: Joi.array()
      .items(Joi.string().uuid().messages({
        'string.uuid': 'Invalid user ID format'
      }))
      .max(20)
      .optional()
      .messages({
        'array.max': 'Maximum 20 user tags allowed'
      })
  }),

  bulkUploadPhotos: Joi.object({
    albumId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid album ID format',
        'any.required': 'Album ID is required'
      }),
    bulkCaption: Joi.string()
      .trim()
      .max(200)
      .optional()
      .allow('', null)
      .messages({
        'string.max': 'Bulk caption must be less than 200 characters'
      })
  }),

  bulkDeletePhotos: Joi.object({
    photoIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one photo ID is required',
        'array.max': 'Maximum 50 photos can be deleted at once',
        'any.required': 'Photo IDs are required'
      })
  }),

  movePhotos: Joi.object({
    photoIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one photo ID is required',
        'array.max': 'Maximum 50 photos can be moved at once'
      }),
    targetAlbumId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid target album ID format',
        'any.required': 'Target album ID is required'
      })
  }),

  setCover: Joi.object({
    photoId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid photo ID format',
        'any.required': 'Photo ID is required'
      })
  })
};

// Parameter validation schemas
const photoParamSchemas = {
  albumIdParam: Joi.object({
    albumId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid album ID format',
        'any.required': 'Album ID is required'
      })
  }),

  photoIdParam: Joi.object({
    photoId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid photo ID format',
        'any.required': 'Photo ID is required'
      })
  })
};

// ============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ============================================

// Generic validation function
const validatePhotoData = (schemaName) => {
  return (req, res, next) => {
    const schema = photoValidationSchemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        message: 'Invalid validation schema'
      });
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

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    req.body = value;
    next();
  };
};

// Generic parameter validation function
const validatePhotoParams = (schemaName) => {
  return (req, res, next) => {
    const schema = photoParamSchemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        message: 'Invalid parameter validation schema'
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

    req.params = { ...req.params, ...value };
    next();
  };
};

// ============================================
// BUSINESS LOGIC VALIDATION
// ============================================

/**
 * Validate album access permissions
 */
const validateAlbumAccess = async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const userId = req.user.id;

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        name: true,
        createdBy: true,
        isArchived: true
      }
    });

    if (!album) {
      return res.status(404).json({
        success: false,
        message: 'Album not found'
      });
    }

    // Only admin can manage albums, but let's also check if it's the creator
    if (album.createdBy !== userId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to access this album'
      });
    }

    // Store album data for use in controllers
    req.albumData = album;
    next();
  } catch (error) {
    console.error('Album access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Album access validation failed'
    });
  }
};

/**
 * Validate photo access permissions
 */
const validatePhotoAccess = async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      include: {
        album: {
          select: {
            id: true,
            name: true,
            createdBy: true,
            isArchived: true
          }
        }
      }
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    // Check permissions (photo uploader, album creator, or super admin)
    const canAccess = photo.uploadedBy === userId || 
                     photo.album?.createdBy === userId ||
                     req.user.role === 'SUPER_ADMIN';

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to access this photo'
      });
    }

    // Store photo data for use in controllers
    req.photoData = photo;
    next();
  } catch (error) {
    console.error('Photo access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Photo access validation failed'
    });
  }
};

/**
 * Validate album name uniqueness
 */
const validateAlbumNameUnique = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { albumId } = req.params; // For updates

    if (!name) {
      return next(); // Skip if no name provided (handled by schema validation)
    }

    const whereClause = { 
      name: name.trim(),
      isArchived: false
    };

    // For updates, exclude the current album
    if (albumId) {
      whereClause.id = { not: albumId };
    }

    const existingAlbum = await prisma.album.findFirst({
      where: whereClause,
      select: { id: true, name: true }
    });

    if (existingAlbum) {
      return res.status(409).json({
        success: false,
        message: 'An album with this name already exists'
      });
    }

    next();
  } catch (error) {
    console.error('Album name uniqueness validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Album name validation failed'
    });
  }
};

/**
 * Validate photo upload requirements
 */
const validatePhotoUpload = (req, res, next) => {
  try {
    // Check if files are provided
    const files = req.files || req.file;
    
    if (!files || (Array.isArray(files) && files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'No photos provided for upload'
      });
    }

    // Validate file types and sizes (additional check beyond multer)
    const filesToValidate = Array.isArray(files) ? files : [files];
    const errors = [];

    filesToValidate.forEach((file, index) => {
      // File type validation
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        errors.push(`File ${index + 1}: Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed`);
      }

      // File size validation (5MB per photo)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        errors.push(`File ${index + 1}: File size exceeds 5MB limit`);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Photo validation failed',
        errors
      });
    }

    next();
  } catch (error) {
    console.error('Photo upload validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Photo upload validation failed'
    });
  }
};

// ============================================
// EXPORTED MIDDLEWARE FUNCTIONS
// ============================================

// Schema validation
const validateCreateAlbum = validatePhotoData('createAlbum');
const validateUpdateAlbum = validatePhotoData('updateAlbum');
const validateUpdatePhoto = validatePhotoData('updatePhoto');
const validateBulkUploadPhotos = validatePhotoData('bulkUploadPhotos');
const validateBulkDeletePhotos = validatePhotoData('bulkDeletePhotos');
const validateMovePhotos = validatePhotoData('movePhotos');
const validateSetCover = validatePhotoData('setCover');

// Parameter validation
const validateAlbumIdParam = validatePhotoParams('albumIdParam');
const validatePhotoIdParam = validatePhotoParams('photoIdParam');

module.exports = {
  // Schema validation
  validateCreateAlbum,
  validateUpdateAlbum,
  validateUpdatePhoto,
  validateBulkUploadPhotos,
  validateBulkDeletePhotos,
  validateMovePhotos,
  validateSetCover,
  
  // Parameter validation
  validateAlbumIdParam,
  validatePhotoIdParam,
  
  // Business logic validation
  validateAlbumAccess,
  validatePhotoAccess,
  validateAlbumNameUnique,
  validatePhotoUpload,
  
  // Export schemas for testing
  photoValidationSchemas,
  photoParamSchemas
};