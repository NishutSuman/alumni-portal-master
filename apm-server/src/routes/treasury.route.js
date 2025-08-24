// src/routes/treasury.route.js
const express = require('express');
const router = express.Router();

// ============================================
// MIDDLEWARE IMPORTS
// ============================================
const { 
  authenticateToken, 
  requireRole, 
  optionalAuth 
} = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/response');
const { uploadReceipt, handleUploadError } = require('../middleware/upload.middleware');

// Treasury-specific validation middleware
const {
  validateCreateExpenseCategory,
  validateUpdateExpenseCategory,
  validateCreateExpenseSubcategory,
  validateUpdateExpenseSubcategory,
  validateReorderCategories,
  validateReorderSubcategories,
  validateCategoryIdParam,
  validateSubcategoryIdParam,
  validateExpenseIdParam,
  validateCollectionIdParam,
  validateBalanceIdParam,
  validateYearParam,
  validateExpenseCategoryAccess,
  validateSubcategoryAccess,
  validateCreateExpense,
  validateUpdateExpense,
  validateCreateManualCollection,
  validateUpdateManualCollection,
  validateCreateYearlyBalance,
  validateUpdateYearlyBalance,
  validateUpdateAccountBalance
} = require('../middleware/treasury.validation.middleware');

// Treasury cache middleware
const {
  cacheExpenseCategories,
  cacheExpenseCategory,
  cacheExpenseSubcategories,
  cacheExpenseSubcategory,
  cacheExpenseStructure,
  cacheExpensesList,
  cacheExpense,
  cacheCollectionsList,
  cacheCollection,
  cacheYearlyBalances,
  cacheYearlyBalance,
  cacheAccountBalance,
  cacheBalanceHistory,
  autoInvalidateCategoriesCache,
  autoInvalidateSubcategoriesCache,
  autoInvalidateExpensesCache,
  autoInvalidateCollectionsCache,
  autoInvalidateBalanceCache,
  cacheDashboard,
  cacheDashboardYear,
  cacheAnalyticsCollections,
  cacheAnalyticsExpenses,
  cacheYearlySummary,
  cacheAnalyticsTrends,
} = require('../middleware/treasury.cache.middleware');

// Treasury audit middleware
const {
  auditCategoryCreate,
  auditCategoryUpdate,
  auditCategoryDelete,
  auditSubcategoryCreate,
  auditSubcategoryUpdate,
  auditSubcategoryDelete,
  auditExpenseCreate,
  auditExpenseUpdate,
  auditExpenseDelete,
  auditCollectionCreate,
  auditCollectionUpdate,
  auditCollectionDelete,
  auditBalanceUpdate,
  auditReceiptUpload,
  auditReceiptDelete
} = require('../middleware/treasury.audit.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const treasuryCategoryController = require('../controllers/treasury/treasuryCategory.controller');
const treasurySubcategoryController = require('../controllers/treasury/treasurySubcategory.controller');
const treasuryStructureController = require('../controllers/treasury/treasuryStructure.controller');
const treasuryExpenseController = require('../controllers/treasury/treasuryExpense.controller');
const treasuryCollectionController = require('../controllers/treasury/treasuryCollection.controller');
const treasuryBalanceController = require('../controllers/treasury/treasuryBalance.controller');
const treasuryReceiptController = require('../controllers/treasury/treasuryReceipt.controller');
const treasuryDashboardController = require('../controllers/treasury/treasuryDashboard.controller');
const treasuryAnalyticsController = require('../controllers/treasury/treasuryAnalytics.controller');
const treasuryReportsController = require('../controllers/treasury/treasuryReports.controller');

// ============================================
// EXPENSE CATEGORY ROUTES (PHASE 2)
// ============================================

/**
 * Get all expense categories with subcategories
 * GET /api/treasury/expense-categories
 */
router.get('/expense-categories',
  [
    optionalAuth,
    cacheExpenseCategories
  ],
  asyncHandler(treasuryCategoryController.getExpenseCategories)
);

/**
 * Get single expense category with details
 * GET /api/treasury/expense-categories/:categoryId
 */
router.get('/expense-categories/:categoryId',
  [
    optionalAuth,
    validateCategoryIdParam,
    cacheExpenseCategory
  ],
  asyncHandler(treasuryCategoryController.getExpenseCategory)
);

/**
 * Create new expense category
 * POST /api/treasury/expense-categories
 */
router.post('/expense-categories',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCreateExpenseCategory,
    auditCategoryCreate,
    autoInvalidateCategoriesCache
  ],
  asyncHandler(treasuryCategoryController.createExpenseCategory)
);

/**
 * Update expense category
 * PUT /api/treasury/expense-categories/:categoryId
 */
router.put('/expense-categories/:categoryId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCategoryIdParam,
    validateExpenseCategoryAccess,
    validateUpdateExpenseCategory,
    auditCategoryUpdate,
    autoInvalidateCategoriesCache
  ],
  asyncHandler(treasuryCategoryController.updateExpenseCategory)
);

/**
 * Delete expense category
 * DELETE /api/treasury/expense-categories/:categoryId
 */
router.delete('/expense-categories/:categoryId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCategoryIdParam,
    validateExpenseCategoryAccess,
    auditCategoryDelete,
    autoInvalidateCategoriesCache
  ],
  asyncHandler(treasuryCategoryController.deleteExpenseCategory)
);

/**
 * Reorder expense categories
 * POST /api/treasury/expense-categories/reorder
 */
router.post('/expense-categories/reorder',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateReorderCategories,
    auditCategoryUpdate,
    autoInvalidateCategoriesCache
  ],
  asyncHandler(treasuryCategoryController.reorderExpenseCategories)
);

// ============================================
// EXPENSE SUBCATEGORY ROUTES (PHASE 2)
// ============================================

/**
 * Get all subcategories for a category
 * GET /api/treasury/expense-categories/:categoryId/subcategories
 */
router.get('/expense-categories/:categoryId/subcategories',
  [
    optionalAuth,
    validateCategoryIdParam,
    validateExpenseCategoryAccess,
    cacheExpenseSubcategories
  ],
  asyncHandler(treasurySubcategoryController.getCategorySubcategories)
);

/**
 * Get single subcategory with details
 * GET /api/treasury/expense-subcategories/:subcategoryId
 */
router.get('/expense-subcategories/:subcategoryId',
  [
    optionalAuth,
    validateSubcategoryIdParam,
    validateSubcategoryAccess,
    cacheExpenseSubcategory
  ],
  asyncHandler(treasurySubcategoryController.getExpenseSubcategory)
);

/**
 * Create new subcategory under a category
 * POST /api/treasury/expense-categories/:categoryId/subcategories
 */
router.post('/expense-categories/:categoryId/subcategories',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCategoryIdParam,
    validateExpenseCategoryAccess,
    validateCreateExpenseSubcategory,
    auditSubcategoryCreate,
    autoInvalidateSubcategoriesCache
  ],
  asyncHandler(treasurySubcategoryController.createExpenseSubcategory)
);

/**
 * Update expense subcategory
 * PUT /api/treasury/expense-subcategories/:subcategoryId
 */
router.put('/expense-subcategories/:subcategoryId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateSubcategoryIdParam,
    validateSubcategoryAccess,
    validateUpdateExpenseSubcategory,
    auditSubcategoryUpdate,
    autoInvalidateSubcategoriesCache
  ],
  asyncHandler(treasurySubcategoryController.updateExpenseSubcategory)
);

/**
 * Delete expense subcategory
 * DELETE /api/treasury/expense-subcategories/:subcategoryId
 */
router.delete('/expense-subcategories/:subcategoryId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateSubcategoryIdParam,
    validateSubcategoryAccess,
    auditSubcategoryDelete,
    autoInvalidateSubcategoriesCache
  ],
  asyncHandler(treasurySubcategoryController.deleteExpenseSubcategory)
);

/**
 * Reorder subcategories within a category
 * POST /api/treasury/expense-categories/:categoryId/subcategories/reorder
 */
router.post('/expense-categories/:categoryId/subcategories/reorder',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCategoryIdParam,
    validateExpenseCategoryAccess,
    validateReorderSubcategories,
    auditSubcategoryUpdate,
    autoInvalidateSubcategoriesCache
  ],
  asyncHandler(treasurySubcategoryController.reorderSubcategories)
);

// ============================================
// EXPENSE STRUCTURE ROUTES (PHASE 2)
// ============================================

/**
 * Get complete expense structure (categories -> subcategories)
 * GET /api/treasury/expense-structure
 */
router.get('/expense-structure',
  [
    optionalAuth,
    cacheExpenseStructure
  ],
  asyncHandler(treasuryStructureController.getExpenseStructure)
);

/**
 * Get structure for a specific category
 * GET /api/treasury/expense-structure/:categoryId
 */
router.get('/expense-structure/:categoryId',
  [
    optionalAuth,
    validateCategoryIdParam,
    validateExpenseCategoryAccess,
    cacheExpenseStructure
  ],
  asyncHandler(treasuryStructureController.getCategoryStructure)
);

/**
 * Reorder complete structure (categories and their subcategories)
 * POST /api/treasury/expense-structure/reorder
 */
router.post('/expense-structure/reorder',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    autoInvalidateCategoriesCache,
    autoInvalidateSubcategoriesCache
  ],
  asyncHandler(treasuryStructureController.reorderExpenseStructure)
);

/**
 * Get structure statistics
 * GET /api/treasury/expense-structure/statistics
 */
router.get('/expense-structure/statistics',
  [
    optionalAuth,
    cacheExpenseStructure
  ],
  asyncHandler(treasuryStructureController.getStructureStatistics)
);

// ============================================
// EXPENSE MANAGEMENT ROUTES (PHASE 3)
// ============================================

/**
 * Get all expenses with filters and pagination
 * GET /api/treasury/expenses
 */
router.get('/expenses',
  [
    optionalAuth,
    cacheExpensesList
  ],
  asyncHandler(treasuryExpenseController.getExpenses)
);

/**
 * Get single expense with detailed information
 * GET /api/treasury/expenses/:expenseId
 */
router.get('/expenses/:expenseId',
  [
    optionalAuth,
    validateExpenseIdParam,
    cacheExpense
  ],
  asyncHandler(treasuryExpenseController.getExpense)
);

/**
 * Create new expense entry
 * POST /api/treasury/expenses
 */
router.post('/expenses',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCreateExpense,
    auditExpenseCreate,
    autoInvalidateExpensesCache
  ],
  asyncHandler(treasuryExpenseController.createExpense)
);

/**
 * Update expense entry
 * PUT /api/treasury/expenses/:expenseId
 */
router.put('/expenses/:expenseId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateExpenseIdParam,
    validateUpdateExpense,
    auditExpenseUpdate,
    autoInvalidateExpensesCache
  ],
  asyncHandler(treasuryExpenseController.updateExpense)
);

/**
 * Delete expense entry
 * DELETE /api/treasury/expenses/:expenseId
 */
router.delete('/expenses/:expenseId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateExpenseIdParam,
    auditExpenseDelete,
    autoInvalidateExpensesCache
  ],
  asyncHandler(treasuryExpenseController.deleteExpense)
);

/**
 * Get expenses by category
 * GET /api/treasury/expenses/by-category/:categoryId
 */
router.get('/expenses/by-category/:categoryId',
  [
    optionalAuth,
    validateCategoryIdParam,
    cacheExpensesList
  ],
  asyncHandler(treasuryExpenseController.getExpensesByCategory)
);

/**
 * Get expenses by subcategory
 * GET /api/treasury/expenses/by-subcategory/:subcategoryId
 */
router.get('/expenses/by-subcategory/:subcategoryId',
  [
    optionalAuth,
    validateSubcategoryIdParam,
    cacheExpensesList
  ],
  asyncHandler(treasuryExpenseController.getExpensesBySubcategory)
);

// ============================================
// MANUAL COLLECTION ROUTES (PHASE 3)
// ============================================

/**
 * Get all manual collections with filters and pagination
 * GET /api/treasury/manual-collections
 */
router.get('/manual-collections',
  [
    optionalAuth,
    cacheCollectionsList
  ],
  asyncHandler(treasuryCollectionController.getManualCollections)
);

/**
 * Get single manual collection with detailed information
 * GET /api/treasury/manual-collections/:collectionId
 */
router.get('/manual-collections/:collectionId',
  [
    optionalAuth,
    validateCollectionIdParam,
    cacheCollection
  ],
  asyncHandler(treasuryCollectionController.getManualCollection)
);

/**
 * Create new manual collection entry
 * POST /api/treasury/manual-collections
 */
router.post('/manual-collections',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCreateManualCollection,
    auditCollectionCreate,
    autoInvalidateCollectionsCache
  ],
  asyncHandler(treasuryCollectionController.createManualCollection)
);

/**
 * Update manual collection entry
 * PUT /api/treasury/manual-collections/:collectionId
 */
router.put('/manual-collections/:collectionId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCollectionIdParam,
    validateUpdateManualCollection,
    auditCollectionUpdate,
    autoInvalidateCollectionsCache
  ],
  asyncHandler(treasuryCollectionController.updateManualCollection)
);

/**
 * Delete manual collection entry
 * DELETE /api/treasury/manual-collections/:collectionId
 */
router.delete('/manual-collections/:collectionId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCollectionIdParam,
    auditCollectionDelete,
    autoInvalidateCollectionsCache
  ],
  asyncHandler(treasuryCollectionController.deleteManualCollection)
);

/**
 * Get collections by mode
 * GET /api/treasury/manual-collections/by-mode/:mode
 */
router.get('/manual-collections/by-mode/:mode',
  [
    optionalAuth,
    cacheCollectionsList
  ],
  asyncHandler(treasuryCollectionController.getCollectionsByMode)
);

/**
 * Get collections by category
 * GET /api/treasury/manual-collections/by-category/:category
 */
router.get('/manual-collections/by-category/:category',
  [
    optionalAuth,
    cacheCollectionsList
  ],
  asyncHandler(treasuryCollectionController.getCollectionsByCategory)
);

/**
 * Get collection statistics
 * GET /api/treasury/manual-collections/statistics
 */
router.get('/manual-collections/statistics',
  [
    optionalAuth,
    cacheCollectionsList
  ],
  asyncHandler(treasuryCollectionController.getCollectionStatistics)
);

// ============================================
// YEARLY BALANCE ROUTES (PHASE 3)
// ============================================

/**
 * Get all yearly balances
 * GET /api/treasury/yearly-balance
 */
router.get('/yearly-balance',
  [
    optionalAuth,
    cacheYearlyBalances
  ],
  asyncHandler(treasuryBalanceController.getYearlyBalances)
);

/**
 * Get yearly balance for specific year
 * GET /api/treasury/yearly-balance/:year
 */
router.get('/yearly-balance/:year',
  [
    optionalAuth,
    validateYearParam,
    cacheYearlyBalance
  ],
  asyncHandler(treasuryBalanceController.getYearlyBalance)
);

/**
 * Create yearly balance
 * POST /api/treasury/yearly-balance
 */
router.post('/yearly-balance',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCreateYearlyBalance,
    auditBalanceUpdate,
    autoInvalidateBalanceCache
  ],
  asyncHandler(treasuryBalanceController.createYearlyBalance)
);

/**
 * Update yearly balance
 * PUT /api/treasury/yearly-balance/:year
 */
router.put('/yearly-balance/:year',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateYearParam,
    validateUpdateYearlyBalance,
    auditBalanceUpdate,
    autoInvalidateBalanceCache
  ],
  asyncHandler(treasuryBalanceController.updateYearlyBalance)
);

/**
 * Delete yearly balance
 * DELETE /api/treasury/yearly-balance/:year
 */
router.delete('/yearly-balance/:year',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateYearParam,
    auditBalanceUpdate,
    autoInvalidateBalanceCache
  ],
  asyncHandler(treasuryBalanceController.deleteYearlyBalance)
);

// ============================================
// ACCOUNT BALANCE ROUTES (PHASE 3)
// ============================================

/**
 * Get current account balance
 * GET /api/treasury/account-balance
 */
router.get('/account-balance',
  [
    optionalAuth,
    cacheAccountBalance
  ],
  asyncHandler(treasuryBalanceController.getCurrentAccountBalance)
);

/**
 * Get account balance history
 * GET /api/treasury/balance-history
 */
router.get('/balance-history',
  [
    optionalAuth,
    cacheBalanceHistory
  ],
  asyncHandler(treasuryBalanceController.getAccountBalanceHistory)
);

/**
 * Update account balance
 * POST /api/treasury/account-balance
 */
router.post('/account-balance',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateUpdateAccountBalance,
    auditBalanceUpdate,
    autoInvalidateBalanceCache
  ],
  asyncHandler(treasuryBalanceController.updateAccountBalance)
);

/**
 * Upload bank statement
 * POST /api/treasury/account-balance/:balanceId/statement
 */
router.post('/account-balance/:balanceId/statement',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateBalanceIdParam,
    uploadReceipt,
    handleUploadError,
    auditReceiptUpload('AccountBalance'),
    autoInvalidateBalanceCache
  ],
  asyncHandler(treasuryBalanceController.uploadBankStatement)
);

// ============================================
// RECEIPT MANAGEMENT ROUTES (PHASE 3)
// ============================================

/**
 * Upload receipt for expense
 * POST /api/treasury/expenses/:expenseId/receipt
 */
router.post('/expenses/:expenseId/receipt',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateExpenseIdParam,
    uploadReceipt,
    handleUploadError,
    auditReceiptUpload('Expense'),
    autoInvalidateExpensesCache
  ],
  asyncHandler(treasuryReceiptController.uploadExpenseReceipt)
);

/**
 * Upload receipt for manual collection
 * POST /api/treasury/manual-collections/:collectionId/receipt
 */
router.post('/manual-collections/:collectionId/receipt',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCollectionIdParam,
    uploadReceipt,
    handleUploadError,
    auditReceiptUpload('ManualCollection'),
    autoInvalidateCollectionsCache
  ],
  asyncHandler(treasuryReceiptController.uploadCollectionReceipt)
);

/**
 * View/Download expense receipt
 * GET /api/treasury/expenses/:expenseId/receipt
 */
router.get('/expenses/:expenseId/receipt',
  [
    optionalAuth,
    validateExpenseIdParam
  ],
  asyncHandler(treasuryReceiptController.getExpenseReceipt)
);

/**
 * View/Download collection receipt
 * GET /api/treasury/manual-collections/:collectionId/receipt
 */
router.get('/manual-collections/:collectionId/receipt',
  [
    optionalAuth,
    validateCollectionIdParam
  ],
  asyncHandler(treasuryReceiptController.getCollectionReceipt)
);

/**
 * Delete expense receipt
 * DELETE /api/treasury/expenses/:expenseId/receipt
 */
router.delete('/expenses/:expenseId/receipt',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateExpenseIdParam,
    auditReceiptDelete('Expense'),
    autoInvalidateExpensesCache
  ],
  asyncHandler(treasuryReceiptController.deleteExpenseReceipt)
);

/**
 * Delete collection receipt
 * DELETE /api/treasury/manual-collections/:collectionId/receipt
 */
router.delete('/manual-collections/:collectionId/receipt',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCollectionIdParam,
    auditReceiptDelete('ManualCollection'),
    autoInvalidateCollectionsCache
  ],
  asyncHandler(treasuryReceiptController.deleteCollectionReceipt)
);

/**
 * Get receipt summary (all receipts with basic info)
 * GET /api/treasury/receipts/summary
 */
router.get('/receipts/summary',
  [
    optionalAuth
  ],
  asyncHandler(treasuryReceiptController.getReceiptSummary)
);

/**
 * Validate receipt file (helper for upload validation)
 * POST /api/treasury/receipts/validate
 */
router.post('/receipts/validate',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    uploadReceipt,
    handleUploadError
  ],
  asyncHandler(treasuryReceiptController.validateReceiptFile)
);

// ============================================
// ROUTE ERROR HANDLING
// ============================================

// Handle undefined treasury routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Treasury route not found: ${req.method} ${req.baseUrl}${req.path}`,
    availableRoutes: {
      categories: 'GET /api/treasury/expense-categories',
      structure: 'GET /api/treasury/expense-structure',
      expenses: 'GET /api/treasury/expenses',
      collections: 'GET /api/treasury/manual-collections',
      balance: 'GET /api/treasury/account-balance'
    }
  });
});

// ============================================
// PHASE 4: DASHBOARD ROUTES
// ============================================

/**
 * Get main treasury dashboard
 * GET /api/treasury/dashboard
 */
router.get('/dashboard',
  [
    optionalAuth,
    cacheDashboard
  ],
  asyncHandler(treasuryDashboardController.getMainDashboard)
);

/**
 * Get yearly dashboard
 * GET /api/treasury/dashboard/:year
 */
router.get('/dashboard/:year',
  [
    optionalAuth,
    validateYearParam,
    cacheDashboardYear
  ],
  asyncHandler(treasuryDashboardController.getYearlyDashboard)
);

// ============================================
// PHASE 4: COLLECTION ANALYTICS ROUTES  
// ============================================

/**
 * Get comprehensive collection analytics
 * GET /api/treasury/analytics/collections
 */
router.get('/analytics/collections',
  [
    optionalAuth,
    cacheAnalyticsCollections
  ],
  asyncHandler(treasuryAnalyticsController.getCollectionAnalytics)
);

/**
 * Get online collection analytics (PaymentTransaction data)
 * GET /api/treasury/analytics/collections/online
 */
router.get('/analytics/collections/online',
  [
    optionalAuth,
    cacheAnalyticsCollections
  ],
  asyncHandler(treasuryAnalyticsController.getOnlineCollectionAnalytics)
);

/**
 * Get manual collection analytics breakdown
 * GET /api/treasury/analytics/collections/manual
 */
router.get('/analytics/collections/manual',
  [
    optionalAuth,
    cacheAnalyticsCollections
  ],
  asyncHandler(treasuryAnalyticsController.getManualCollectionAnalytics)
);

/**
 * Get collections by source analysis
 * GET /api/treasury/analytics/collections/by-source
 */
router.get('/analytics/collections/by-source',
  [
    optionalAuth,
    cacheAnalyticsCollections
  ],
  asyncHandler(treasuryAnalyticsController.getCollectionAnalytics) // Uses main analytics with source breakdown
);

// ============================================
// PHASE 4: EXPENSE ANALYTICS ROUTES
// ============================================

/**
 * Get comprehensive expense analytics
 * GET /api/treasury/analytics/expenses
 */
router.get('/analytics/expenses',
  [
    optionalAuth,
    cacheAnalyticsExpenses
  ],
  asyncHandler(treasuryAnalyticsController.getExpenseAnalytics)
);

/**
 * Get category-wise expense analytics
 * GET /api/treasury/analytics/expenses/by-category
 */
router.get('/analytics/expenses/by-category',
  [
    optionalAuth,
    cacheAnalyticsExpenses
  ],
  asyncHandler(treasuryAnalyticsController.getCategoryExpenseAnalytics)
);

/**
 * Get subcategory-wise expense analytics
 * GET /api/treasury/analytics/expenses/by-subcategory
 */
router.get('/analytics/expenses/by-subcategory',
  [
    optionalAuth,
    cacheAnalyticsExpenses
  ],
  asyncHandler(treasuryAnalyticsController.getExpenseAnalytics) // Uses main analytics with subcategory filter
);

/**
 * Get event-wise expense analytics
 * GET /api/treasury/analytics/expenses/by-event
 */
router.get('/analytics/expenses/by-event',
  [
    optionalAuth,
    cacheAnalyticsExpenses
  ],
  asyncHandler(treasuryAnalyticsController.getExpenseAnalytics) // Uses main analytics with event filter
);

// ============================================
// PHASE 4: FINANCIAL SUMMARY ROUTES
// ============================================

/**
 * Get yearly financial summary
 * GET /api/treasury/analytics/yearly-summary/:year
 */
router.get('/analytics/yearly-summary/:year',
  [
    optionalAuth,
    validateYearParam,
    cacheYearlySummary
  ],
  asyncHandler(treasuryAnalyticsController.getYearlyFinancialSummary)
);

/**
 * Get current surplus/deficit analysis
 * GET /api/treasury/analytics/surplus-deficit
 */
router.get('/analytics/surplus-deficit',
  [
    optionalAuth,
    cacheAnalyticsCollections
  ],
  asyncHandler(treasuryAnalyticsController.getSurplusDeficitAnalysis)
);

/**
 * Get multi-year financial trends
 * GET /api/treasury/analytics/trends
 */
router.get('/analytics/trends',
  [
    optionalAuth,
    cacheAnalyticsTrends
  ],
  asyncHandler(treasuryAnalyticsController.getSurplusDeficitAnalysis) // Can be extended for multi-year trends
);

// ============================================
// PHASE 4: REPORTS & EXPORTS ROUTES
// ============================================

/**
 * Get financial report (JSON format)
 * GET /api/treasury/reports/financial/:year
 */
router.get('/reports/financial/:year',
  [
    optionalAuth,
    validateYearParam
  ],
  asyncHandler(treasuryReportsController.getFinancialReport)
);

/**
 * Export financial report to Excel
 * GET /api/treasury/reports/export/excel/:year
 */
router.get('/reports/export/excel/:year',
  [
    optionalAuth,
    validateYearParam
  ],
  asyncHandler(treasuryReportsController.exportFinancialReportExcel)
);

/**
 * Export financial report to PDF
 * GET /api/treasury/reports/export/pdf/:year
 */
router.get('/reports/export/pdf/:year',
  [
    optionalAuth,
    validateYearParam
  ],
  asyncHandler(treasuryReportsController.exportFinancialReportPDF)
);

/**
 * Get category-specific report
 * GET /api/treasury/reports/category-wise/:categoryId
 */
router.get('/reports/category-wise/:categoryId',
  [
    optionalAuth,
    validateCategoryIdParam
  ],
  asyncHandler(treasuryReportsController.getCategoryWiseReport)
);

/**
 * Get receipt summary report
 * GET /api/treasury/reports/receipt-summary
 */
router.get('/reports/receipt-summary',
  [
    optionalAuth
  ],
  asyncHandler(treasuryReportsController.getReceiptSummaryReport)
);



// ============================================
// ROUTE DOCUMENTATION SUMMARY
// ============================================

/**
 * Treasury API Routes - Complete Phase 1-3 Implementation
 * 
 * Base URL: /api/treasury
 * Total Endpoints: 45+
 * 
 * PHASE 2 - Categories & Structure (20 endpoints):
 * - Categories: 6 endpoints (CRUD + reorder)
 * - Subcategories: 6 endpoints (CRUD + reorder) 
 * - Structure: 4 endpoints (hierarchy + statistics)
 * 
 * PHASE 3 - Expenses & Collections (25+ endpoints):
 * - Expenses: 7 endpoints (CRUD + by-category/subcategory)
 * - Manual Collections: 8 endpoints (CRUD + by-mode/category + statistics)
 * - Yearly Balance: 5 endpoints (CRUD)
 * - Account Balance: 3 endpoints (current + history + update)
 * - Receipts: 8 endpoints (upload/view/delete for expenses/collections)
 * 
 * Access Control:
 * - Read Operations: Public (complete transparency)
 * - Write Operations: SuperAdmin only
 * - All operations logged in audit trail
 * 
 * Features:
 * - Complete manual fund management
 * - Hierarchical expense categorization
 * - Receipt upload/management for transparency
 * - Financial balance tracking (yearly + current)
 * - Comprehensive caching with auto-invalidation
 * - Full audit trail for accountability
 */

module.exports = router;