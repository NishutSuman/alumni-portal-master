// src/middleware/treasury.audit.middleware.js
const { prisma } = require('../config/database');

// ============================================
// TREASURY AUDIT ACTIONS
// ============================================

const TREASURY_ACTIONS = {
  // Yearly Balance Actions
  YEARLY_BALANCE_CREATE: 'TREASURY_YEARLY_BALANCE_CREATE',
  YEARLY_BALANCE_UPDATE: 'TREASURY_YEARLY_BALANCE_UPDATE',
  YEARLY_BALANCE_DELETE: 'TREASURY_YEARLY_BALANCE_DELETE',
  
  // Category Actions
  CATEGORY_CREATE: 'TREASURY_CATEGORY_CREATE',
  CATEGORY_UPDATE: 'TREASURY_CATEGORY_UPDATE',
  CATEGORY_DELETE: 'TREASURY_CATEGORY_DELETE',
  CATEGORY_REORDER: 'TREASURY_CATEGORY_REORDER',
  
  // Subcategory Actions
  SUBCATEGORY_CREATE: 'TREASURY_SUBCATEGORY_CREATE',
  SUBCATEGORY_UPDATE: 'TREASURY_SUBCATEGORY_UPDATE',
  SUBCATEGORY_DELETE: 'TREASURY_SUBCATEGORY_DELETE',
  SUBCATEGORY_REORDER: 'TREASURY_SUBCATEGORY_REORDER',
  
  // Expense Actions
  EXPENSE_CREATE: 'TREASURY_EXPENSE_CREATE',
  EXPENSE_UPDATE: 'TREASURY_EXPENSE_UPDATE',
  EXPENSE_DELETE: 'TREASURY_EXPENSE_DELETE',
  EXPENSE_APPROVE: 'TREASURY_EXPENSE_APPROVE',
  
  // Collection Actions
  COLLECTION_CREATE: 'TREASURY_COLLECTION_CREATE',
  COLLECTION_UPDATE: 'TREASURY_COLLECTION_UPDATE',
  COLLECTION_DELETE: 'TREASURY_COLLECTION_DELETE',
  COLLECTION_VERIFY: 'TREASURY_COLLECTION_VERIFY',
  
  // Balance Actions
  BALANCE_UPDATE: 'TREASURY_BALANCE_UPDATE',
  
  // Receipt Actions
  RECEIPT_UPLOAD: 'TREASURY_RECEIPT_UPLOAD',
  RECEIPT_DELETE: 'TREASURY_RECEIPT_DELETE',
  
  // Export Actions
  EXPORT_FINANCIAL_REPORT: 'TREASURY_EXPORT_FINANCIAL_REPORT',
  EXPORT_CATEGORY_REPORT: 'TREASURY_EXPORT_CATEGORY_REPORT'
};

// ============================================
// AUDIT LOGGING HELPER FUNCTIONS
// ============================================

/**
 * Log treasury activity to ActivityLog (user-facing)
 */
const logTreasuryActivity = async (userId, action, details = {}, req = null) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress: req?.ip || null,
        userAgent: req?.get('User-Agent') || null
      }
    });
  } catch (error) {
    console.error('Treasury activity logging error:', error);
    // Don't throw error - logging failure shouldn't break the main operation
  }
};

/**
 * Log treasury audit trail to AuditLog (admin-level)
 */
const logTreasuryAudit = async (actorId, action, entityType, entityId, oldValues = null, newValues = null, reason = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        reason
      }
    });
  } catch (error) {
    console.error('Treasury audit logging error:', error);
    // Don't throw error - logging failure shouldn't break the main operation
  }
};

/**
 * Extract relevant fields from object for audit logging
 */
const extractAuditFields = (obj, fields = null) => {
  if (!obj) return null;
  
  if (fields) {
    const result = {};
    fields.forEach(field => {
      if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    });
    return Object.keys(result).length > 0 ? result : null;
  }
  
  return obj;
};

// ============================================
// MIDDLEWARE FACTORY FUNCTIONS
// ============================================

/**
 * Create middleware to log treasury operations
 */
const auditTreasuryOperation = (action, entityType, options = {}) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Call original res.json first
      const result = originalJson.call(this, data);
      
      // Perform audit logging asynchronously (don't wait)
      setImmediate(async () => {
        try {
          if (data.success && req.user) {
            const userId = req.user.id;
            const entityId = options.getEntityId ? options.getEntityId(req, data) : 
                           req.params.id || req.params.categoryId || req.params.subcategoryId || 
                           req.params.expenseId || req.params.collectionId || data.data?.id;
            
            // Activity Log (user-facing)
            const activityDetails = {
              action,
              entityType,
              entityId,
              ...(options.getActivityDetails ? options.getActivityDetails(req, data) : {})
            };
            
            await logTreasuryActivity(userId, action, activityDetails, req);
            
            // Audit Log (admin-level) - only for critical operations
            if (options.requiresAuditLog !== false) {
              const oldValues = options.getOldValues ? options.getOldValues(req) : null;
              const newValues = options.getNewValues ? options.getNewValues(req, data) : 
                               extractAuditFields(req.body);
              
              await logTreasuryAudit(
                userId,
                action,
                entityType,
                entityId,
                oldValues,
                newValues,
                options.getReason ? options.getReason(req) : null
              );
            }
          }
        } catch (error) {
          console.error('Audit middleware error:', error);
          // Don't throw - continue with request
        }
      });
      
      return result;
    };
    
    next();
  };
};

// ============================================
// PRE-CONFIGURED AUDIT MIDDLEWARES
// ============================================

// Yearly Balance Audit Middlewares
const auditYearlyBalanceCreate = auditTreasuryOperation(
  TREASURY_ACTIONS.YEARLY_BALANCE_CREATE, 
  'YearlyBalance',
  {
    getActivityDetails: (req, data) => ({
      year: req.body.year,
      openingBalance: req.body.openingBalance
    })
  }
);

const auditYearlyBalanceUpdate = auditTreasuryOperation(
  TREASURY_ACTIONS.YEARLY_BALANCE_UPDATE, 
  'YearlyBalance',
  {
    getEntityId: (req) => req.params.year,
    getActivityDetails: (req, data) => ({
      year: req.params.year,
      updatedFields: Object.keys(req.body)
    })
  }
);

// Category Audit Middlewares
const auditCategoryCreate = auditTreasuryOperation(
  TREASURY_ACTIONS.CATEGORY_CREATE, 
  'ExpenseCategory',
  {
    getActivityDetails: (req, data) => ({
      categoryName: req.body.name,
      categoryId: data.data?.id
    })
  }
);

const auditCategoryUpdate = auditTreasuryOperation(
  TREASURY_ACTIONS.CATEGORY_UPDATE, 
  'ExpenseCategory',
  {
    getEntityId: (req) => req.params.categoryId,
    getActivityDetails: (req, data) => ({
      categoryId: req.params.categoryId,
      updatedFields: Object.keys(req.body)
    })
  }
);

const auditCategoryDelete = auditTreasuryOperation(
  TREASURY_ACTIONS.CATEGORY_DELETE, 
  'ExpenseCategory',
  {
    getEntityId: (req) => req.params.categoryId,
    getActivityDetails: (req, data) => ({
      categoryId: req.params.categoryId
    })
  }
);

// Subcategory Audit Middlewares
const auditSubcategoryCreate = auditTreasuryOperation(
  TREASURY_ACTIONS.SUBCATEGORY_CREATE, 
  'ExpenseSubcategory',
  {
    getActivityDetails: (req, data) => ({
      subcategoryName: req.body.name,
      categoryId: req.params.categoryId,
      subcategoryId: data.data?.id
    })
  }
);

const auditSubcategoryUpdate = auditTreasuryOperation(
  TREASURY_ACTIONS.SUBCATEGORY_UPDATE, 
  'ExpenseSubcategory',
  {
    getEntityId: (req) => req.params.subcategoryId,
    getActivityDetails: (req, data) => ({
      subcategoryId: req.params.subcategoryId,
      updatedFields: Object.keys(req.body)
    })
  }
);

const auditSubcategoryDelete = auditTreasuryOperation(
  TREASURY_ACTIONS.SUBCATEGORY_DELETE, 
  'ExpenseSubcategory',
  {
    getEntityId: (req) => req.params.subcategoryId,
    getActivityDetails: (req, data) => ({
      subcategoryId: req.params.subcategoryId
    })
  }
);

// Expense Audit Middlewares
const auditExpenseCreate = auditTreasuryOperation(
  TREASURY_ACTIONS.EXPENSE_CREATE, 
  'Expense',
  {
    getActivityDetails: (req, data) => ({
      amount: req.body.amount,
      description: req.body.description.substring(0, 100),
      subcategoryId: req.body.subcategoryId,
      linkedEventId: req.body.linkedEventId,
      expenseId: data.data?.id
    })
  }
);

const auditExpenseUpdate = auditTreasuryOperation(
  TREASURY_ACTIONS.EXPENSE_UPDATE, 
  'Expense',
  {
    getEntityId: (req) => req.params.expenseId,
    getActivityDetails: (req, data) => ({
      expenseId: req.params.expenseId,
      updatedFields: Object.keys(req.body)
    })
  }
);

const auditExpenseDelete = auditTreasuryOperation(
  TREASURY_ACTIONS.EXPENSE_DELETE, 
  'Expense',
  {
    getEntityId: (req) => req.params.expenseId,
    getActivityDetails: (req, data) => ({
      expenseId: req.params.expenseId
    })
  }
);

const auditExpenseApprove = auditTreasuryOperation(
  TREASURY_ACTIONS.EXPENSE_APPROVE, 
  'Expense',
  {
    getEntityId: (req) => req.params.expenseId,
    getActivityDetails: (req, data) => ({
      expenseId: req.params.expenseId,
      approved: true
    })
  }
);

// Manual Collection Audit Middlewares
const auditCollectionCreate = auditTreasuryOperation(
  TREASURY_ACTIONS.COLLECTION_CREATE, 
  'ManualCollection',
  {
    getActivityDetails: (req, data) => ({
      amount: req.body.amount,
      description: req.body.description.substring(0, 100),
      collectionMode: req.body.collectionMode,
      linkedEventId: req.body.linkedEventId,
      collectionId: data.data?.id
    })
  }
);

const auditCollectionUpdate = auditTreasuryOperation(
  TREASURY_ACTIONS.COLLECTION_UPDATE, 
  'ManualCollection',
  {
    getEntityId: (req) => req.params.collectionId,
    getActivityDetails: (req, data) => ({
      collectionId: req.params.collectionId,
      updatedFields: Object.keys(req.body)
    })
  }
);

const auditCollectionDelete = auditTreasuryOperation(
  TREASURY_ACTIONS.COLLECTION_DELETE, 
  'ManualCollection',
  {
    getEntityId: (req) => req.params.collectionId,
    getActivityDetails: (req, data) => ({
      collectionId: req.params.collectionId
    })
  }
);

// Account Balance Audit Middlewares
const auditBalanceUpdate = auditTreasuryOperation(
  TREASURY_ACTIONS.BALANCE_UPDATE, 
  'AccountBalance',
  {
    getActivityDetails: (req, data) => ({
      currentBalance: req.body.currentBalance,
      balanceDate: req.body.balanceDate
    })
  }
);

// Receipt Audit Middlewares
const auditReceiptUpload = (entityType) => auditTreasuryOperation(
  TREASURY_ACTIONS.RECEIPT_UPLOAD, 
  entityType,
  {
    getEntityId: (req) => req.params.expenseId || req.params.collectionId,
    getActivityDetails: (req, data) => ({
      entityId: req.params.expenseId || req.params.collectionId,
      fileName: req.file?.originalname,
      fileSize: req.file?.size
    }),
    requiresAuditLog: false // Receipt uploads don't need audit log
  }
);

const auditReceiptDelete = (entityType) => auditTreasuryOperation(
  TREASURY_ACTIONS.RECEIPT_DELETE, 
  entityType,
  {
    getEntityId: (req) => req.params.expenseId || req.params.collectionId,
    getActivityDetails: (req, data) => ({
      entityId: req.params.expenseId || req.params.collectionId
    }),
    requiresAuditLog: false // Receipt deletions don't need audit log
  }
);

// ============================================
// EXPORT AND ANALYTICS AUDIT
// ============================================

const auditFinancialExport = auditTreasuryOperation(
  TREASURY_ACTIONS.EXPORT_FINANCIAL_REPORT,
  'FinancialReport',
  {
    getActivityDetails: (req, data) => ({
      year: req.params.year,
      format: req.query.format,
      exportType: 'financial_report'
    }),
    requiresAuditLog: false
  }
);

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get treasury audit statistics
 */
const getTreasuryAuditStats = async (startDate = null, endDate = null) => {
  try {
    const whereClause = {
      action: {
        startsWith: 'TREASURY_'
      }
    };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }
    
    const stats = await prisma.auditLog.groupBy({
      by: ['action'],
      where: whereClause,
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Treasury audit stats error:', error);
    return [];
  }
};

/**
 * Get recent treasury activities for a user
 */
const getRecentTreasuryActivities = async (userId, limit = 10) => {
  try {
    return await prisma.activityLog.findMany({
      where: {
        userId,
        action: {
          startsWith: 'TREASURY_'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true
      }
    });
  } catch (error) {
    console.error('Recent treasury activities error:', error);
    return [];
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Action constants
  TREASURY_ACTIONS,
  
  // Audit middleware factory
  auditTreasuryOperation,
  
  // Pre-configured middlewares
  auditYearlyBalanceCreate,
  auditYearlyBalanceUpdate,
  auditCategoryCreate,
  auditCategoryUpdate,
  auditCategoryDelete,
  auditSubcategoryCreate,
  auditSubcategoryUpdate,
  auditSubcategoryDelete,
  auditExpenseCreate,
  auditExpenseUpdate,
  auditExpenseDelete,
  auditExpenseApprove,
  auditCollectionCreate,
  auditCollectionUpdate,
  auditCollectionDelete,
  auditBalanceUpdate,
  auditReceiptUpload,
  auditReceiptDelete,
  auditFinancialExport,
  
  // Utility functions
  logTreasuryActivity,
  logTreasuryAudit,
  getTreasuryAuditStats,
  getRecentTreasuryActivities,
  
  // Helper functions
  extractAuditFields
};