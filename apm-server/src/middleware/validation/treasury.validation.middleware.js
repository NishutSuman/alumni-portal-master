// src/middleware/treasury.validation.middleware.js
const Joi = require('joi');

// ============================================
// VALIDATION SCHEMAS
// ============================================

const treasurySchemas = {
  // Yearly Balance Validation
  createYearlyBalance: Joi.object({
    year: Joi.number()
      .integer()
      .min(2000)
      .max(2050)
      .required()
      .messages({
        'number.min': 'Year must be between 2000 and 2050',
        'number.max': 'Year must be between 2000 and 2050',
        'any.required': 'Year is required'
      }),
    openingBalance: Joi.number()
      .precision(2)
      .min(0)
      .required()
      .messages({
        'number.min': 'Opening balance cannot be negative',
        'any.required': 'Opening balance is required'
      }),
    notes: Joi.string().max(500).optional().allow(''),
  }),

  updateYearlyBalance: Joi.object({
    openingBalance: Joi.number()
      .precision(2)
      .min(0)
      .optional()
      .messages({
        'number.min': 'Opening balance cannot be negative'
      }),
    closingBalance: Joi.number()
      .precision(2)
      .optional(),
    notes: Joi.string().max(500).optional().allow(''),
  }),

  // Expense Category Validation
  createExpenseCategory: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Category name must be at least 2 characters',
        'string.max': 'Category name must be less than 100 characters',
        'any.required': 'Category name is required'
      }),
    description: Joi.string().trim().max(500).optional().allow(''),
    displayOrder: Joi.number().integer().min(0).optional()
  }),

  updateExpenseCategory: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    description: Joi.string().trim().max(500).optional().allow(''),
    isActive: Joi.boolean().optional(),
    displayOrder: Joi.number().integer().min(0).optional()
  }),

  // Expense Subcategory Validation
  createExpenseSubcategory: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Subcategory name must be at least 2 characters',
        'string.max': 'Subcategory name must be less than 100 characters',
        'any.required': 'Subcategory name is required'
      }),
    description: Joi.string().trim().max(500).optional().allow(''),
    displayOrder: Joi.number().integer().min(0).optional()
  }),

  updateExpenseSubcategory: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    description: Joi.string().trim().max(500).optional().allow(''),
    isActive: Joi.boolean().optional(),
    displayOrder: Joi.number().integer().min(0).optional()
  }),

  // Expense Entry Validation
  createExpense: Joi.object({
    amount: Joi.number()
      .positive()
      .precision(2)
      .max(10000000) // 1 crore limit
      .required()
      .messages({
        'number.positive': 'Amount must be positive',
        'number.max': 'Amount cannot exceed ₹1,00,00,000',
        'any.required': 'Amount is required'
      }),
    description: Joi.string()
      .trim()
      .min(5)
      .max(500)
      .required()
      .messages({
        'string.min': 'Description must be at least 5 characters',
        'string.max': 'Description must be less than 500 characters',
        'any.required': 'Description is required'
      }),
    expenseDate: Joi.date()
      .max('now')
      .required()
      .messages({
        'date.max': 'Expense date cannot be in the future',
        'any.required': 'Expense date is required'
      }),
    subcategoryId: Joi.string().uuid().optional(),
    linkedEventId: Joi.string().uuid().optional(),
    vendorName: Joi.string().trim().max(100).optional().allow(''),
    vendorContact: Joi.string().trim().max(50).optional().allow('')
  }),

  updateExpense: Joi.object({
    amount: Joi.number().positive().precision(2).max(10000000).optional(),
    description: Joi.string().trim().min(5).max(500).optional(),
    expenseDate: Joi.date().max('now').optional(),
    subcategoryId: Joi.string().uuid().optional().allow(null),
    linkedEventId: Joi.string().uuid().optional().allow(null),
    vendorName: Joi.string().trim().max(100).optional().allow(''),
    vendorContact: Joi.string().trim().max(50).optional().allow('')
  }),

  // Manual Collection Validation
  createManualCollection: Joi.object({
    amount: Joi.number()
      .positive()
      .precision(2)
      .max(10000000)
      .required()
      .messages({
        'number.positive': 'Amount must be positive',
        'number.max': 'Amount cannot exceed ₹1,00,00,000',
        'any.required': 'Amount is required'
      }),
    description: Joi.string()
      .trim()
      .min(5)
      .max(500)
      .required()
      .messages({
        'string.min': 'Description must be at least 5 characters',
        'string.max': 'Description must be less than 500 characters',
        'any.required': 'Description is required'
      }),
    collectionDate: Joi.date()
      .max('now')
      .required()
      .messages({
        'date.max': 'Collection date cannot be in the future',
        'any.required': 'Collection date is required'
      }),
    collectionMode: Joi.string()
      .valid('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI_OFFLINE', 'OTHER')
      .required()
      .messages({
        'any.only': 'Invalid collection mode',
        'any.required': 'Collection mode is required'
      }),
    category: Joi.string().trim().max(100).optional().allow(''),
    linkedEventId: Joi.string().uuid().optional(),
    donorName: Joi.string().trim().max(100).optional().allow(''),
    donorContact: Joi.string().trim().max(50).optional().allow('')
  }),

  updateManualCollection: Joi.object({
    amount: Joi.number().positive().precision(2).max(10000000).optional(),
    description: Joi.string().trim().min(5).max(500).optional(),
    collectionDate: Joi.date().max('now').optional(),
    collectionMode: Joi.string()
      .valid('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI_OFFLINE', 'OTHER')
      .optional(),
    category: Joi.string().trim().max(100).optional().allow(''),
    linkedEventId: Joi.string().uuid().optional().allow(null),
    donorName: Joi.string().trim().max(100).optional().allow(''),
    donorContact: Joi.string().trim().max(50).optional().allow('')
  }),

  // Account Balance Validation
  updateAccountBalance: Joi.object({
    currentBalance: Joi.number()
      .precision(2)
      .required()
      .messages({
        'any.required': 'Current balance is required'
      }),
    balanceDate: Joi.date()
      .max('now')
      .required()
      .messages({
        'date.max': 'Balance date cannot be in the future',
        'any.required': 'Balance date is required'
      }),
    notes: Joi.string().trim().max(500).optional().allow('')
  }),

  // Reorder Validation
  reorderCategories: Joi.object({
    categoryIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one category is required',
        'any.required': 'Category IDs are required'
      })
  }),

  reorderSubcategories: Joi.object({
    subcategoryIds: Joi.array()
      .items(Joi.string().uuid())
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one subcategory is required',
        'any.required': 'Subcategory IDs are required'
      })
  })
};

// ============================================
// PARAMETER VALIDATION SCHEMAS
// ============================================

const treasuryParamSchemas = {
  yearParam: Joi.object({
    year: Joi.number().integer().min(2000).max(2050).required()
      .messages({
        'number.min': 'Invalid year parameter',
        'number.max': 'Invalid year parameter',
        'any.required': 'Year parameter is required'
      })
  }),

  categoryIdParam: Joi.object({
    categoryId: Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Invalid category ID format',
        'any.required': 'Category ID is required'
      })
  }),

  subcategoryIdParam: Joi.object({
    subcategoryId: Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Invalid subcategory ID format',
        'any.required': 'Subcategory ID is required'
      })
  }),

  expenseIdParam: Joi.object({
    expenseId: Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Invalid expense ID format',
        'any.required': 'Expense ID is required'
      })
  }),

  collectionIdParam: Joi.object({
    collectionId: Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Invalid collection ID format',
        'any.required': 'Collection ID is required'
      })
  }),

  balanceIdParam: Joi.object({
    balanceId: Joi.string().uuid().required()
      .messages({
        'string.uuid': 'Invalid balance ID format',
        'any.required': 'Balance ID is required'
      })
  })
};

// ============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ============================================

// Generic validation function
const validateTreasury = (schemaName) => {
  return (req, res, next) => {
    const schema = treasurySchemas[schemaName];
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
const validateTreasuryParams = (schemaName) => {
  return (req, res, next) => {
    const schema = treasuryParamSchemas[schemaName];
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

    req.params = value;
    next();
  };
};

// ============================================
// BUSINESS RULE VALIDATIONS
// ============================================

// Validate expense category exists and is active
const validateExpenseCategoryAccess = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    
    if (!categoryId) {
      return next();
    }

    const { prisma } = require('../config/database');
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, isActive: true }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Expense category not found'
      });
    }

    if (!category.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform operations on inactive category'
      });
    }

    req.categoryData = category;
    next();
  } catch (error) {
    console.error('Category access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Category validation failed'
    });
  }
};

// Validate subcategory belongs to correct category
const validateSubcategoryAccess = async (req, res, next) => {
  try {
    const { categoryId, subcategoryId } = req.params;
    
    if (!subcategoryId) {
      return next();
    }

    const { prisma } = require('../config/database');
    const subcategory = await prisma.expenseSubcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        category: {
          select: { id: true, name: true, isActive: true }
        }
      }
    });

    if (!subcategory) {
      return res.status(404).json({
        success: false,
        message: 'Expense subcategory not found'
      });
    }

    if (!subcategory.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform operations on inactive subcategory'
      });
    }

    if (categoryId && subcategory.categoryId !== categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory does not belong to specified category'
      });
    }

    if (!subcategory.category.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform operations on subcategory with inactive category'
      });
    }

    req.subcategoryData = subcategory;
    next();
  } catch (error) {
    console.error('Subcategory access validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Subcategory validation failed'
    });
  }
};

// ============================================
// EXPORTED MIDDLEWARE FUNCTIONS
// ============================================

// Yearly Balance Validation
const validateCreateYearlyBalance = validateTreasury('createYearlyBalance');
const validateUpdateYearlyBalance = validateTreasury('updateYearlyBalance');

// Category Validation
const validateCreateExpenseCategory = validateTreasury('createExpenseCategory');
const validateUpdateExpenseCategory = validateTreasury('updateExpenseCategory');

// Subcategory Validation
const validateCreateExpenseSubcategory = validateTreasury('createExpenseSubcategory');
const validateUpdateExpenseSubcategory = validateTreasury('updateExpenseSubcategory');

// Expense Validation
const validateCreateExpense = validateTreasury('createExpense');
const validateUpdateExpense = validateTreasury('updateExpense');

// Collection Validation
const validateCreateManualCollection = validateTreasury('createManualCollection');
const validateUpdateManualCollection = validateTreasury('updateManualCollection');

// Account Balance Validation
const validateUpdateAccountBalance = validateTreasury('updateAccountBalance');

// Reorder Validation
const validateReorderCategories = validateTreasury('reorderCategories');
const validateReorderSubcategories = validateTreasury('reorderSubcategories');

// Parameter Validation
const validateYearParam = validateTreasuryParams('yearParam');
const validateCategoryIdParam = validateTreasuryParams('categoryIdParam');
const validateSubcategoryIdParam = validateTreasuryParams('subcategoryIdParam');
const validateExpenseIdParam = validateTreasuryParams('expenseIdParam');
const validateCollectionIdParam = validateTreasuryParams('collectionIdParam');
const validateBalanceIdParam = validateTreasuryParams('balanceIdParam');

module.exports = {
  // Schema validation
  validateCreateYearlyBalance,
  validateUpdateYearlyBalance,
  validateCreateExpenseCategory,
  validateUpdateExpenseCategory,
  validateCreateExpenseSubcategory,
  validateUpdateExpenseSubcategory,
  validateCreateExpense,
  validateUpdateExpense,
  validateCreateManualCollection,
  validateUpdateManualCollection,
  validateUpdateAccountBalance,
  validateReorderCategories,
  validateReorderSubcategories,
  
  // Parameter validation
  validateYearParam,
  validateCategoryIdParam,
  validateSubcategoryIdParam,
  validateExpenseIdParam,
  validateCollectionIdParam,
  validateBalanceIdParam,
  
  // Business logic validation
  validateExpenseCategoryAccess,
  validateSubcategoryAccess,
  
  // Export schemas for testing
  treasurySchemas,
  treasuryParamSchemas
};