// src/middleware/merchandise.validation.middleware.js
// Standalone Merchandise Validation - Independent of Events

const Joi = require('joi');
const { prisma } = require('../config/database');

// Validation schemas for merchandise operations
const merchandiseSchemas = {
  // Create merchandise
  createMerchandise: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Merchandise name must be at least 2 characters',
        'string.max': 'Merchandise name cannot exceed 100 characters',
        'any.required': 'Merchandise name is required'
      }),
    
    description: Joi.string()
      .max(1000)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    
    price: Joi.number()
      .positive()
      .precision(2)
      .min(1)
      .max(10000)
      .required()
      .messages({
        'number.positive': 'Price must be positive',
        'number.min': 'Price must be at least ₹1',
        'number.max': 'Price cannot exceed ₹10,000',
        'any.required': 'Price is required'
      }),
    
    stock: Joi.number()
      .integer()
      .min(0)
      .max(10000)
      .default(0)
      .messages({
        'number.min': 'Stock cannot be negative',
        'number.max': 'Stock cannot exceed 10,000'
      }),
    
    availableSizes: Joi.array()
      .items(
        Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'FREE_SIZE')
      )
      .min(1)
      .unique()
      .default(['FREE_SIZE'])
      .messages({
        'array.min': 'At least one size must be specified',
        'array.unique': 'Duplicate sizes are not allowed'
      }),
    
    category: Joi.string()
      .valid('T_SHIRTS', 'HOODIES', 'MUGS', 'ACCESSORIES', 'STICKERS', 'BOOKS', 'OTHER')
      .optional()
      .messages({
        'any.only': 'Invalid category'
      }),
    
    isActive: Joi.boolean().default(true)
  }),

  // Update merchandise
  updateMerchandise: Joi.object({
    name: Joi.string()
      .min(2)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Merchandise name must be at least 2 characters',
        'string.max': 'Merchandise name cannot exceed 100 characters'
      }),
    
    description: Joi.string()
      .max(1000)
      .optional()
      .allow(''),
    
    price: Joi.number()
      .positive()
      .precision(2)
      .min(1)
      .max(10000)
      .optional()
      .messages({
        'number.positive': 'Price must be positive',
        'number.min': 'Price must be at least ₹1',
        'number.max': 'Price cannot exceed ₹10,000'
      }),
    
    availableSizes: Joi.array()
      .items(
        Joi.string().valid('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'FREE_SIZE')
      )
      .min(1)
      .unique()
      .optional()
      .messages({
        'array.min': 'At least one size must be specified',
        'array.unique': 'Duplicate sizes are not allowed'
      }),
    
    category: Joi.string()
      .valid('T_SHIRTS', 'HOODIES', 'MUGS', 'ACCESSORIES', 'STICKERS', 'BOOKS', 'OTHER')
      .optional(),
    
    isActive: Joi.boolean().optional()
  }),

  // Update stock
  updateStock: Joi.object({
    stock: Joi.number()
      .integer()
      .min(0)
      .max(10000)
      .required()
      .messages({
        'number.min': 'Stock cannot be negative',
        'number.max': 'Stock cannot exceed 10,000',
        'any.required': 'Stock value is required'
      }),
    
    reason: Joi.string()
      .max(200)
      .optional()
      .messages({
        'string.max': 'Reason cannot exceed 200 characters'
      })
  }),

  // Add to cart
  addToCart: Joi.object({
    merchandiseId: Joi.string()
      .required()
      .messages({
        'any.required': 'Merchandise ID is required'
      }),
    
    quantity: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .required()
      .messages({
        'number.min': 'Quantity must be at least 1',
        'number.max': 'Cannot add more than 50 items at once',
        'any.required': 'Quantity is required'
      }),
    
    selectedSize: Joi.string()
      .valid('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'FREE_SIZE')
      .optional()
      .messages({
        'any.only': 'Invalid size selected'
      })
  }),

  // Update cart item
  updateCartItem: Joi.object({
    quantity: Joi.number()
      .integer()
      .min(1)
      .max(50)
      .required()
      .messages({
        'number.min': 'Quantity must be at least 1',
        'number.max': 'Cannot have more than 50 of same item',
        'any.required': 'Quantity is required'
      }),
    
    selectedSize: Joi.string()
      .valid('XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'FREE_SIZE')
      .optional()
      .messages({
        'any.only': 'Invalid size selected'
      })
  }),

  // Mark order as delivered
  markDelivered: Joi.object({
    deliveryNotes: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Delivery notes cannot exceed 500 characters'
      }),
    
    confirmationPhoto: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Confirmation photo must be a valid URL'
      })
  })
};

// Parameter validation schemas
const merchandiseParamSchemas = {
  merchandiseId: Joi.object({
    merchandiseId: Joi.string()
      .required()
      .messages({
        'any.required': 'Merchandise ID is required'
      })
  }),
  
  orderId: Joi.object({
    orderId: Joi.string()
      .required()
      .messages({
        'any.required': 'Order ID is required'
      })
  }),
  
  orderNumber: Joi.object({
    orderNumber: Joi.string()
      .pattern(/^ORD-\d{4}-\d{4}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid order number format',
        'any.required': 'Order number is required'
      })
  }),

  cartItemId: Joi.object({
    cartItemId: Joi.string()
      .required()
      .messages({
        'any.required': 'Cart item ID is required'
      })
  })
};

/**
 * Generic validation middleware generator
 */
const validateMerchandise = (schemaName) => {
  return (req, res, next) => {
    const schema = merchandiseSchemas[schemaName];
    
    if (!schema) {
      console.error(`Validation schema '${schemaName}' not found`);
      return res.status(500).json({
        success: false,
        message: 'Validation configuration error'
      });
    }

    const { error, value } = schema.validate(req.body, {
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
        message: 'Validation failed',
        errors
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Parameter validation middleware generator
 */
const validateMerchandiseParams = (schemaName) => {
  return (req, res, next) => {
    const schema = merchandiseParamSchemas[schemaName];
    
    if (!schema) {
      console.error(`Parameter validation schema '${schemaName}' not found`);
      return res.status(500).json({
        success: false,
        message: 'Parameter validation configuration error'
      });
    }

    const { error, value } = schema.validate(req.params, {
      abortEarly: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors
      });
    }

    req.params = { ...req.params, ...value };
    next();
  };
};

/**
 * Validate merchandise exists and is active
 */
const validateMerchandiseExists = async (req, res, next) => {
  try {
    const { merchandiseId } = req.params;
    
    const merchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId },
      select: { 
        id: true, 
        name: true, 
        isActive: true, 
        stock: true,
        availableSizes: true,
        price: true
      }
    });

    if (!merchandise) {
      return res.status(404).json({
        success: false,
        message: 'Merchandise item not found'
      });
    }

    req.merchandise = merchandise;
    next();

  } catch (error) {
    console.error('Validate merchandise exists error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate merchandise'
    });
  }
};

/**
 * Validate merchandise is active and available
 */
const validateMerchandiseAvailable = (req, res, next) => {
  const merchandise = req.merchandise;

  if (!merchandise.isActive) {
    return res.status(400).json({
      success: false,
      message: 'This merchandise item is currently unavailable'
    });
  }

  if (merchandise.stock <= 0) {
    return res.status(400).json({
      success: false,
      message: 'This merchandise item is out of stock'
    });
  }

  next();
};

/**
 * Validate selected size is available
 */
const validateSizeAvailable = (req, res, next) => {
  const merchandise = req.merchandise;
  const { selectedSize } = req.body;

  // If size is provided, validate it
  if (selectedSize && !merchandise.availableSizes.includes(selectedSize)) {
    return res.status(400).json({
      success: false,
      message: `Size '${selectedSize}' is not available for this item`,
      availableSizes: merchandise.availableSizes
    });
  }

  // If no size provided but merchandise has multiple sizes, require size selection
  if (!selectedSize && merchandise.availableSizes.length > 1 && !merchandise.availableSizes.includes('FREE_SIZE')) {
    return res.status(400).json({
      success: false,
      message: 'Please select a size for this item',
      availableSizes: merchandise.availableSizes
    });
  }

  next();
};

/**
 * Validate stock availability for cart operations
 */
const validateStockAvailability = (req, res, next) => {
  const merchandise = req.merchandise;
  const { quantity } = req.body;

  if (merchandise.stock < quantity) {
    return res.status(400).json({
      success: false,
      message: `Only ${merchandise.stock} items available in stock`,
      availableStock: merchandise.stock,
      requestedQuantity: quantity
    });
  }

  next();
};

/**
 * Validate order exists and belongs to user (for user operations)
 */
const validateOrderAccess = async (req, res, next) => {
  try {
    const { orderId, orderNumber } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = {};
    
    if (orderId) {
      whereClause.id = orderId;
    } else if (orderNumber) {
      whereClause.orderNumber = orderNumber;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Order ID or order number is required'
      });
    }

    // Super admins can access any order
    if (userRole !== 'SUPER_ADMIN') {
      whereClause.userId = userId;
    }

    const order = await prisma.merchandiseOrder.findFirst({
      where: whereClause,
      select: { 
        id: true, 
        orderNumber: true, 
        userId: true,
        status: true,
        deliveryStatus: true,
        totalAmount: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or access denied'
      });
    }

    req.order = order;
    next();

  } catch (error) {
    console.error('Validate order access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate order access'
    });
  }
};

/**
 * Validate cart item belongs to user
 */
const validateCartItemAccess = async (req, res, next) => {
  try {
    const { cartItemId } = req.params;
    const userId = req.user.id;

    const cartItem = await prisma.merchandiseCartItem.findFirst({
      where: { 
        id: cartItemId,
        userId 
      },
      select: { 
        id: true, 
        merchandiseId: true,
        quantity: true,
        selectedSize: true
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found or access denied'
      });
    }

    req.cartItem = cartItem;
    next();

  } catch (error) {
    console.error('Validate cart item access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate cart item access'
    });
  }
};

/**
 * Rate limiting for merchandise operations
 */
const merchandiseRateLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const action = req.route.path;
    const rateLimitKey = `merchandise:ratelimit:${userId}:${action.replace(/[/:]/g, '_')}`;

    // Check current attempts
    const attempts = await CacheService.get(rateLimitKey) || 0;

    // Different limits for different operations
    let maxAttempts = 20; // Default
    let windowSeconds = 3600; // 1 hour

    if (action.includes('cart')) {
      maxAttempts = 50; // Higher limit for cart operations
      windowSeconds = 1800; // 30 minutes
    } else if (action.includes('order')) {
      maxAttempts = 5; // Lower limit for order creation
      windowSeconds = 3600; // 1 hour
    }

    if (attempts >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: windowSeconds
      });
    }

    // Increment attempts counter
    await CacheService.set(rateLimitKey, attempts + 1, windowSeconds);

    next();

  } catch (error) {
    console.error('Merchandise rate limit error:', error);
    // Don't block request if rate limiting fails
    next();
  }
};

// Export specific validation middleware functions
const validateCreateMerchandise = validateMerchandise('createMerchandise');
const validateUpdateMerchandise = validateMerchandise('updateMerchandise');
const validateUpdateStock = validateMerchandise('updateStock');
const validateAddToCart = validateMerchandise('addToCart');
const validateUpdateCartItem = validateMerchandise('updateCartItem');
const validateMarkDelivered = validateMerchandise('markDelivered');

// Export parameter validation functions
const validateMerchandiseIdParam = validateMerchandiseParams('merchandiseId');
const validateOrderIdParam = validateMerchandiseParams('orderId');
const validateOrderNumberParam = validateMerchandiseParams('orderNumber');
const validateCartItemIdParam = validateMerchandiseParams('cartItemId');

module.exports = {
  // Schema validation
  validateCreateMerchandise,
  validateUpdateMerchandise,
  validateUpdateStock,
  validateAddToCart,
  validateUpdateCartItem,
  validateMarkDelivered,
  
  // Parameter validation
  validateMerchandiseIdParam,
  validateOrderIdParam,
  validateOrderNumberParam,
  validateCartItemIdParam,
  
  // Business logic validation
  validateMerchandiseExists,
  validateMerchandiseAvailable,
  validateSizeAvailable,
  validateStockAvailability,
  validateOrderAccess,
  validateCartItemAccess,
  
  // Rate limiting
  merchandiseRateLimit,
  
  // Export schemas for testing
  merchandiseSchemas,
  merchandiseParamSchemas
};