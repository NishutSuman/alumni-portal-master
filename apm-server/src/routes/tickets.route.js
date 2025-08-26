// ============================================
// COMPLETE TICKET ROUTES - PHASES 1, 2 & 3
// Advanced Features Integration
// ============================================

// FILE: src/routes/tickets.route.js (COMPLETE VERSION)

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/response');

// Import Phase 1-2 controllers
const ticketController = require('../controllers/support/ticket.controller');
const ticketAdminController = require('../controllers/support/ticketAdmin.controller');
const ticketCategoryController = require('../controllers/support/ticketCategory.controller');
const ticketMessageController = require('../controllers/support/ticketMessage.controller');
const ticketFileController = require('../controllers/support/ticketFile.controller');
const ticketAuditController = require('../controllers/support/ticketAudit.controller');

// Import Phase 3 controllers
const ticketTemplateController = require('../controllers/support/ticketTemplate.controller');
const ticketSearchController = require('../controllers/support/ticketSearch.controller');
const ticketBulkController = require('../controllers/support/ticketBulk.controller');
const ticketAdvancedController = require('../controllers/support/ticketAdvanced.controller');

const ticketAnalyticsController = require('../controllers/support/ticketAnalytics.controller');
const ticketExportController = require('../controllers/support/ticketExport.controller');
const ticketPerformanceController = require('../controllers/support/ticketPerformance.controller');

// Import middleware
const { authenticateToken, requireRole, optionalAuth } = require('../middleware/auth.middleware');
const { 
  uploadGeneral, 
  uploadTicketAttachments, 
  uploadMessageAttachments, 
  handleUploadError 
} = require('../middleware/upload.middleware');

// Import Phase 1-2 validation middleware
const {
  validateCreateTicket,
  validateUpdateTicket,
  validateAddMessage,
  validateReopenTicket,
  validateAdminResponse,
  validateCloseTicket,
  validateSatisfaction,
  validateTicketQuery,
  validateTicketIdParam,
  validateTicketAccess,
  validateUserCanUpdateTicket,
  validateCanReopenTicket,
  validateCategoryExists,
  validateAssignedAdminExists
} = require('../middleware/ticket.validation.middleware');

// Import Phase 2 validation middleware
const {
  validateEnhancedAddMessage,
  validateEditMessage,
  validateMessageReaction,
  validateMessageDraft,
  validateMessageIdParam,
  validateMessageEditPermission,
  validateMessageReactionPermission,
  validateFormattedContent
} = require('../middleware/ticketMessage.validation.middleware');

// Import Phase 3 validation middleware
const {
  validateTemplate,
  validateTemplateIdParam,
  validateTemplateAccess,
  validateAdvancedSearch,
  validateSaveFilter,
  validateBulkAssign,
  validateBulkStatus,
  validateBulkPriority,
  validateBulkClose,
  validateBulkCategory,
  validateBulkTicketSelection
} = require('../middleware/ticketAdvanced.validation.middleware');

// Import Phase 1-2 cache middleware
const {
  cacheUserTickets,
  cacheAdminTickets,
  cacheTicketDetails,
  cacheUserDashboard,
  cacheAdminDashboard,
  cacheCategories,
  cacheAvailableAdmins,
  invalidateTicketCaches
} = require('../middleware/ticket.cache.middleware');

const { 
  cacheAnalyticsOverview,
  cacheCategoryAnalysis, 
  cacheWeeklyTrends,
  cacheAdminPerformance,
  cacheCompleteAnalytics,
  autoInvalidateAnalyticsCaches
} = require('../middleware/ticket.cache.middleware');

// Import Phase 2 cache middleware
const {
  cacheMessageReactions,
  cacheMessageEditHistory,
  cacheFilePreview,
  cacheFileMetadata,
  cacheAuditTrail,
  invalidateMessageCaches
} = require('../middleware/ticketMessage.cache.middleware');

// Import Phase 3 cache middleware
const {
  cacheActiveTemplates,
  cacheTemplateDetails,
  cacheSearchConfig,
  cacheSearchSuggestions,
  cacheUserFilters,
  cacheBulkOperationStatus,
  cacheAdminBulkHistory,
  cacheTicketStatistics,
  cachePopularSearches,
  invalidateTemplateCaches,
  invalidateSearchCaches,
  invalidateBulkCaches
} = require('../middleware/ticketAdvanced.cache.middleware');

// ============================================
// PHASE 1 ROUTES: BASIC FUNCTIONALITY
// ============================================

/**
 * Get active ticket categories
 * GET /api/tickets/categories
 */
router.get(
  '/categories',
  [cacheCategories],
  asyncHandler(ticketCategoryController.getActiveCategories)
);

/**
 * Get available admins for assignment
 * GET /api/tickets/admins
 */
router.get(
  '/admins',
  [authenticateToken, cacheAvailableAdmins],
  asyncHandler(ticketCategoryController.getAvailableAdmins)
);

/**
 * Get user's dashboard statistics
 * GET /api/tickets/dashboard
 */
router.get(
  '/dashboard',
  [authenticateToken, cacheUserDashboard],
  asyncHandler(ticketController.getUserDashboard)
);

/**
 * Get user's tickets with filters
 * GET /api/tickets
 */
router.get(
  '/',
  [
    authenticateToken,
    validateTicketQuery,
    cacheUserTickets
  ],
  asyncHandler(ticketController.getUserTickets)
);

/**
 * Create new support ticket
 * POST /api/tickets
 */
router.post(
  '/',
  [
    authenticateToken,
    uploadTicketAttachments,
    handleUploadError,
    validateCreateTicket,
    validateCategoryExists,
    validateAssignedAdminExists,
    invalidateTicketCaches,
    autoInvalidateAnalyticsCaches
  ],
  asyncHandler(ticketController.createTicket)
);

/**
 * Get specific ticket details
 * GET /api/tickets/:ticketId
 */
router.get(
  '/:ticketId',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    cacheTicketDetails
  ],
  asyncHandler(ticketController.getTicketDetails)
);

/**
 * Update ticket
 * PUT /api/tickets/:ticketId
 */
router.put(
  '/:ticketId',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateUserCanUpdateTicket,
    validateUpdateTicket,
    validateCategoryExists,
    invalidateTicketCaches,
    autoInvalidateAnalyticsCaches
  ],
  asyncHandler(ticketController.updateTicket)
);

/**
 * Reopen closed ticket
 * POST /api/tickets/:ticketId/reopen
 */
router.post(
  '/:ticketId/reopen',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateCanReopenTicket,
    validateReopenTicket,
    invalidateTicketCaches
  ],
  asyncHandler(ticketController.reopenTicket)
);

/**
 * Rate ticket satisfaction
 * POST /api/tickets/:ticketId/satisfaction
 */
router.post(
  '/:ticketId/satisfaction',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateSatisfaction,
    invalidateTicketCaches
  ],
  asyncHandler(ticketController.rateTicket)
);

/**
 * Request email copy of ticket conversation
 * POST /api/tickets/:ticketId/email-copy
 */
router.post(
  '/:ticketId/email-copy',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess
  ],
  asyncHandler(ticketController.requestEmailCopy)
);

// ============================================
// PHASE 2 ROUTES: ENHANCED MESSAGING
// ============================================

/**
 * Add enhanced message to ticket
 * POST /api/tickets/:ticketId/messages
 */
router.post(
  '/:ticketId/messages',
  [
    authenticateToken,
    uploadMessageAttachments,
    handleUploadError,
    validateTicketIdParam,
    validateTicketAccess,
    validateEnhancedAddMessage,
    validateFormattedContent,
    invalidateMessageCaches
  ],
  asyncHandler(ticketController.addEnhancedMessage)
);

/**
 * Edit message
 * PUT /api/tickets/:ticketId/messages/:messageId
 */
router.put(
  '/:ticketId/messages/:messageId',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateMessageIdParam,
    validateMessageEditPermission,
    validateEditMessage,
    invalidateMessageCaches
  ],
  asyncHandler(ticketMessageController.editMessage)
);

/**
 * Add reaction to message
 * POST /api/tickets/:ticketId/messages/:messageId/react
 */
router.post(
  '/:ticketId/messages/:messageId/react',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateMessageIdParam,
    validateMessageReactionPermission,
    validateMessageReaction,
    invalidateMessageCaches
  ],
  asyncHandler(ticketMessageController.addReaction)
);

/**
 * Get message reactions
 * GET /api/tickets/:ticketId/messages/:messageId/reactions
 */
router.get(
  '/:ticketId/messages/:messageId/reactions',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateMessageIdParam,
    cacheMessageReactions
  ],
  asyncHandler(ticketMessageController.getMessageReactions)
);

/**
 * Get message edit history
 * GET /api/tickets/:ticketId/messages/:messageId/history
 */
router.get(
  '/:ticketId/messages/:messageId/history',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateMessageIdParam,
    cacheMessageEditHistory
  ],
  asyncHandler(ticketMessageController.getMessageEditHistory)
);

/**
 * Save message draft
 * POST /api/tickets/:ticketId/messages/draft
 */
router.post(
  '/:ticketId/messages/draft',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    validateMessageDraft
  ],
  asyncHandler(ticketMessageController.saveMessageDraft)
);

/**
 * Get message draft
 * GET /api/tickets/:ticketId/messages/draft
 */
router.get(
  '/:ticketId/messages/draft',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess
  ],
  asyncHandler(ticketMessageController.getMessageDraft)
);

/**
 * Clear message draft
 * DELETE /api/tickets/:ticketId/messages/draft
 */
router.delete(
  '/:ticketId/messages/draft',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess
  ],
  asyncHandler(ticketMessageController.clearMessageDraft)
);

// ============================================
// PHASE 2 ROUTES: FILE MANAGEMENT
// ============================================

/**
 * Get file preview
 * GET /api/tickets/files/:attachmentId/preview
 */
router.get(
  '/files/:attachmentId/preview',
  [authenticateToken, cacheFilePreview],
  asyncHandler(ticketFileController.getFilePreview)
);

/**
 * Download file
 * GET /api/tickets/files/:attachmentId/download
 */
router.get(
  '/files/:attachmentId/download',
  [authenticateToken],
  asyncHandler(ticketFileController.downloadFile)
);

/**
 * Get file thumbnail
 * GET /api/tickets/files/:attachmentId/thumbnail
 */
router.get(
  '/files/:attachmentId/thumbnail',
  [authenticateToken],
  asyncHandler(ticketFileController.getThumbnail)
);

/**
 * Get file metadata
 * GET /api/tickets/files/:attachmentId/metadata
 */
router.get(
  '/files/:attachmentId/metadata',
  [authenticateToken, cacheFileMetadata],
  asyncHandler(ticketFileController.getFileMetadata)
);

// ============================================
// PHASE 2 ROUTES: AUDIT TRAIL
// ============================================

/**
 * Get ticket audit trail
 * GET /api/tickets/:ticketId/audit
 */
router.get(
  '/:ticketId/audit',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess,
    cacheAuditTrail
  ],
  asyncHandler(ticketAuditController.getTicketAuditTrail)
);

// ============================================
// PHASE 3 ROUTES: TICKET TEMPLATES
// ============================================

/**
 * Get active templates
 * GET /api/tickets/templates
 */
router.get(
  '/templates',
  [optionalAuth, cacheActiveTemplates],
  asyncHandler(ticketTemplateController.getActiveTemplates)
);

/**
 * Get template details
 * GET /api/tickets/templates/:templateId
 */
router.get(
  '/templates/:templateId',
  [
    optionalAuth,
    validateTemplateIdParam,
    validateTemplateAccess,
    cacheTemplateDetails
  ],
  asyncHandler(ticketTemplateController.getTemplateDetails)
);

/**
 * Use template to create ticket
 * POST /api/tickets/templates/:templateId/use
 */
router.post(
  '/templates/:templateId/use',
  [
    authenticateToken,
    validateTemplateIdParam,
    validateTemplateAccess
  ],
  asyncHandler(ticketTemplateController.useTemplate)
);

// ============================================
// PHASE 3 ROUTES: ADVANCED SEARCH & FILTERS
// ============================================

/**
 * Get search configuration
 * GET /api/tickets/search/config
 */
router.get(
  '/search/config',
  [authenticateToken, cacheSearchConfig],
  asyncHandler(ticketAdvancedController.getSearchConfig)
);

/**
 * Perform advanced search
 * POST /api/tickets/search
 */
router.post(
  '/search',
  [
    authenticateToken,
    validateAdvancedSearch
  ],
  asyncHandler(ticketSearchController.performAdvancedSearch)
);

/**
 * Get search suggestions
 * GET /api/tickets/search/suggestions
 */
router.get(
  '/search/suggestions',
  [
    authenticateToken,
    cacheSearchSuggestions
  ],
  asyncHandler(ticketSearchController.getSearchSuggestions)
);

/**
 * Get user's saved filters
 * GET /api/tickets/filters
 */
router.get(
  '/filters',
  [
    authenticateToken,
    cacheUserFilters
  ],
  asyncHandler(ticketSearchController.getUserFilters)
);

/**
 * Save search filter
 * POST /api/tickets/filters
 */
router.post(
  '/filters',
  [
    authenticateToken,
    validateSaveFilter,
    invalidateSearchCaches
  ],
  asyncHandler(ticketSearchController.saveFilter)
);

/**
 * Apply saved filter
 * POST /api/tickets/filters/:filterId/apply
 */
router.post(
  '/filters/:filterId/apply',
  [authenticateToken],
  asyncHandler(ticketSearchController.applyFilter)
);

/**
 * Delete saved filter
 * DELETE /api/tickets/filters/:filterId
 */
router.delete(
  '/filters/:filterId',
  [
    authenticateToken,
    invalidateSearchCaches
  ],
  asyncHandler(ticketSearchController.deleteFilter)
);

// ============================================
// ADMIN ROUTES: BASIC MANAGEMENT (Phase 1)
// ============================================

/**
 * Get admin dashboard statistics
 * GET /api/tickets/admin/dashboard
 */
router.get(
  '/admin/dashboard',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheAdminDashboard
  ],
  asyncHandler(ticketAdminController.getAdminDashboard)
);

/**
 * Get all tickets for admin
 * GET /api/tickets/admin
 */
router.get(
  '/admin',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTicketQuery,
    cacheAdminTickets
  ],
  asyncHandler(ticketAdminController.getAdminTickets)
);

/**
 * Get ticket details (admin view)
 * GET /api/tickets/admin/:ticketId
 */
router.get(
  '/admin/:ticketId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTicketIdParam,
    cacheTicketDetails
  ],
  asyncHandler(ticketAdminController.getAdminTicketDetails)
);

/**
 * Update ticket status
 * PATCH /api/tickets/admin/:ticketId/status
 */
router.patch(
  '/admin/:ticketId/status',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTicketIdParam,
    invalidateTicketCaches
  ],
  asyncHandler(ticketAdminController.updateTicketStatus)
);

/**
 * Admin respond to ticket
 * POST /api/tickets/admin/:ticketId/respond
 */
router.post(
  '/admin/:ticketId/respond',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    uploadTicketAttachments,
    handleUploadError,
    validateTicketIdParam,
    validateAdminResponse,
    invalidateTicketCaches,
    autoInvalidateAnalyticsCaches
  ],
  asyncHandler(ticketAdminController.respondToTicket)
);

/**
 * Assign ticket to admin
 * POST /api/tickets/admin/:ticketId/assign
 */
router.post(
  '/admin/:ticketId/assign',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTicketIdParam,
    validateAssignedAdminExists,
    invalidateTicketCaches
  ],
  asyncHandler(ticketAdminController.assignTicket)
);

/**
 * Close ticket
 * POST /api/tickets/admin/:ticketId/close
 */
router.post(
  '/admin/:ticketId/close',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTicketIdParam,
    validateCloseTicket,
    invalidateTicketCaches,
    autoInvalidateAnalyticsCaches
  ],
  asyncHandler(ticketAdminController.closeTicket)
);

// ============================================
// PHASE 3 ROUTES: ADMIN TEMPLATE MANAGEMENT
// ============================================

/**
 * Create ticket template
 * POST /api/tickets/admin/templates
 */
router.post(
  '/admin/templates',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTemplate,
    invalidateTemplateCaches
  ],
  asyncHandler(ticketTemplateController.createTemplate)
);

/**
 * Update ticket template
 * PUT /api/tickets/admin/templates/:templateId
 */
router.put(
  '/admin/templates/:templateId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTemplateIdParam,
    validateTemplate,
    invalidateTemplateCaches
  ],
  asyncHandler(ticketTemplateController.updateTemplate)
);

/**
 * Delete ticket template
 * DELETE /api/tickets/admin/templates/:templateId
 */
router.delete(
  '/admin/templates/:templateId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTemplateIdParam,
    invalidateTemplateCaches
  ],
  asyncHandler(ticketTemplateController.deleteTemplate)
);

// ============================================
// PHASE 3 ROUTES: BULK OPERATIONS
// ============================================

/**
 * Bulk assign tickets to admin
 * POST /api/tickets/admin/bulk/assign
 */
router.post(
  '/admin/bulk/assign',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateBulkAssign,
    validateBulkTicketSelection,
    invalidateBulkCaches
  ],
  asyncHandler(ticketBulkController.bulkAssignTickets)
);

/**
 * Bulk change ticket status
 * POST /api/tickets/admin/bulk/status
 */
router.post(
  '/admin/bulk/status',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateBulkStatus,
    validateBulkTicketSelection,
    invalidateBulkCaches
  ],
  asyncHandler(ticketBulkController.bulkChangeStatus)
);

/**
 * Bulk change ticket priority
 * POST /api/tickets/admin/bulk/priority
 */
router.post(
  '/admin/bulk/priority',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateBulkPriority,
    validateBulkTicketSelection,
    invalidateBulkCaches
  ],
  asyncHandler(ticketBulkController.bulkChangePriority)
);

/**
 * Bulk close tickets
 * POST /api/tickets/admin/bulk/close
 */
router.post(
  '/admin/bulk/close',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateBulkClose,
    validateBulkTicketSelection,
    invalidateBulkCaches
  ],
  asyncHandler(ticketBulkController.bulkCloseTickets)
);

/**
 * Bulk change ticket category
 * POST /api/tickets/admin/bulk/category
 */
router.post(
  '/admin/bulk/category',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateBulkCategory,
    validateBulkTicketSelection,
    invalidateBulkCaches
  ],
  asyncHandler(ticketBulkController.bulkChangeCategory)
);

/**
 * Get bulk operation status
 * GET /api/tickets/admin/bulk/operations/:operationId
 */
router.get(
  '/admin/bulk/operations/:operationId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheBulkOperationStatus
  ],
  asyncHandler(ticketBulkController.getBulkOperationStatus)
);

/**
 * Get bulk operation history
 * GET /api/tickets/admin/bulk/history
 */
router.get(
  '/admin/bulk/history',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheAdminBulkHistory
  ],
  asyncHandler(ticketBulkController.getBulkOperationHistory)
);

// ============================================
// PHASE 3 ROUTES: ADMIN ANALYTICS & CONFIG
// ============================================

/**
 * Get ticket statistics
 * GET /api/tickets/admin/statistics
 */
router.get(
  '/admin/statistics',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheTicketStatistics
  ],
  asyncHandler(ticketAdvancedController.getTicketStatistics)
);

/**
 * Get popular searches (admin analytics)
 * GET /api/tickets/admin/search/popular
 */
router.get(
  '/admin/search/popular',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cachePopularSearches
  ],
  asyncHandler(ticketSearchController.getPopularSearches)
);

/**
 * Get user audit history
 * GET /api/tickets/admin/users/:userId/audit
 */
router.get(
  '/admin/users/:userId/audit',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketAuditController.getUserAuditHistory)
);

// ============================================
// PHASE 4 ROUTES: ANALYTICS DASHBOARD
// ============================================

/**
 * Get dashboard overview analytics
 * GET /api/tickets/admin/analytics/overview
 */
router.get(
  '/admin/analytics/overview',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    // cacheTicketStatistics
    cacheAnalyticsOverview 
  ],
  asyncHandler(ticketAnalyticsController.getDashboardOverview)
);

/**
 * Get category analysis
 * GET /api/tickets/admin/analytics/categories
 */
router.get(
  '/admin/analytics/categories',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    // cacheTicketStatistics
    cacheCategoryAnalysis
  ],
  asyncHandler(ticketAnalyticsController.getCategoryAnalysis)
);

/**
 * Get weekly trends
 * GET /api/tickets/admin/analytics/trends
 */
router.get(
  '/admin/analytics/trends',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    // cacheTicketStatistics
    cacheWeeklyTrends
  ],
  asyncHandler(ticketAnalyticsController.getWeeklyTrends)
);

/**
 * Get admin performance metrics
 * GET /api/tickets/admin/analytics/performance
 */
router.get(
  '/admin/analytics/performance',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    // cacheTicketStatistics
    cacheAdminPerformance 
  ],
  asyncHandler(ticketAnalyticsController.getAdminPerformance)
);

/**
 * Get priority distribution
 * GET /api/tickets/admin/analytics/priority-distribution
 */
router.get(
  '/admin/analytics/priority-distribution',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cacheTicketStatistics
  ],
  asyncHandler(ticketAnalyticsController.getPriorityDistribution)
);

/**
 * Get complete analytics dashboard
 * GET /api/tickets/admin/analytics/complete
 */
router.get(
  '/admin/analytics/complete',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    // cacheTicketStatistics
    cacheCompleteAnalytics
  ],
  asyncHandler(ticketAnalyticsController.getCompleteAnalytics)
);

/**
 * Refresh analytics cache
 * POST /api/tickets/admin/analytics/refresh
 */
router.post(
  '/admin/analytics/refresh',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketAnalyticsController.refreshAnalyticsCache)
);

// ============================================
// PHASE 4 ROUTES: EXPORT FUNCTIONALITY
// ============================================

/**
 * Export ticket conversation as PDF
 * GET /api/tickets/:ticketId/export/pdf
 */
router.get(
  '/:ticketId/export/pdf',
  [
    authenticateToken,
    validateTicketIdParam,
    validateTicketAccess
  ],
  asyncHandler(ticketExportController.exportTicketPDF)
);

/**
 * Export tickets list as CSV (Admin)
 * POST /api/tickets/admin/export/csv
 */
router.post(
  '/admin/export/csv',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketExportController.exportTicketsCSV)
);

/**
 * Get export history (Admin)
 * GET /api/tickets/admin/export/history
 */
router.get(
  '/admin/export/history',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketExportController.getExportHistory)
);

/**
 * Get export statistics (Admin)
 * GET /api/tickets/admin/export/stats
 */
router.get(
  '/admin/export/stats',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketExportController.getExportStats)
);

// ============================================
// PHASE 4 ROUTES: PERFORMANCE OPTIMIZATION
// ============================================

/**
 * Get database performance metrics
 * GET /api/tickets/admin/performance/metrics
 */
router.get(
  '/admin/performance/metrics',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketPerformanceController.getDatabaseMetrics)
);

/**
 * Run manual performance cleanup
 * POST /api/tickets/admin/performance/cleanup
 */
router.post(
  '/admin/performance/cleanup',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketPerformanceController.runManualCleanup)
);

/**
 * Get cleanup history
 * GET /api/tickets/admin/performance/cleanup-history
 */
router.get(
  '/admin/performance/cleanup-history',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketPerformanceController.getCleanupHistory)
);

/**
 * Get performance recommendations
 * GET /api/tickets/admin/performance/recommendations
 */
router.get(
  '/admin/performance/recommendations',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketPerformanceController.getPerformanceRecommendations)
);

/**
 * Test notification system
 * POST /api/tickets/admin/performance/test-notification
 */
router.post(
  '/admin/performance/test-notification',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN')
  ],
  asyncHandler(ticketPerformanceController.testNotificationSystem)
);

router.post('/admin/test-notifications', [
  authenticateToken,
  requireRole('SUPER_ADMIN')
], asyncHandler(async (req, res) => {
  try {
    const { testType } = req.body;
    const TicketNotificationService = require('../../services/ticketNotification.service');
    
    let result;
    switch (testType) {
      case 'delayed_check':
        result = await TicketNotificationService.checkAndSendDelayedNotifications();
        break;
      case 'notification_stats':
        result = await TicketNotificationService.getNotificationStats();
        break;
      default:
        return errorResponse(res, 'Invalid test type', 400);
    }
    
    return successResponse(res, result, 'Notification test completed');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
}));


module.exports = router;

// ============================================
// ROUTE SUMMARY - ALL PHASES
// ============================================

/*
COMPLETE API ENDPOINT SUMMARY (35+ endpoints):

PHASE 1 - BASIC FUNCTIONALITY (12 endpoints):
✅ GET    /api/tickets/categories              # Get categories
✅ GET    /api/tickets/admins                  # Get available admins
✅ GET    /api/tickets/dashboard               # User dashboard
✅ GET    /api/tickets                         # User tickets list
✅ POST   /api/tickets                         # Create ticket
✅ GET    /api/tickets/:ticketId               # Ticket details
✅ PUT    /api/tickets/:ticketId               # Update ticket
✅ POST   /api/tickets/:ticketId/reopen        # Reopen ticket
✅ POST   /api/tickets/:ticketId/satisfaction  # Rate ticket
✅ POST   /api/tickets/:ticketId/email-copy    # Request email copy
✅ GET    /api/tickets/admin/dashboard         # Admin dashboard
✅ GET    /api/tickets/admin                   # Admin tickets list

PHASE 2 - ENHANCED MESSAGING (15 endpoints):
✅ POST   /api/tickets/:ticketId/messages                    # Enhanced messaging
✅ PUT    /api/tickets/:ticketId/messages/:messageId         # Edit message
✅ POST   /api/tickets/:ticketId/messages/:messageId/react   # Add reaction
✅ GET    /api/tickets/:ticketId/messages/:messageId/reactions # Get reactions
✅ GET    /api/tickets/:ticketId/messages/:messageId/history # Edit history
✅ POST   /api/tickets/:ticketId/messages/draft              # Save draft
✅ GET    /api/tickets/:ticketId/messages/draft              # Get draft
✅ DELETE /api/tickets/:ticketId/messages/draft              # Clear draft
✅ GET    /api/tickets/files/:attachmentId/preview          # File preview
✅ GET    /api/tickets/files/:attachmentId/download         # Download file
✅ GET    /api/tickets/files/:attachmentId/thumbnail        # Image thumbnail
✅ GET    /api/tickets/files/:attachmentId/metadata         # File metadata
✅ GET    /api/tickets/:ticketId/audit                      # Audit trail
✅ PATCH  /api/tickets/admin/:ticketId/status              # Update status
✅ POST   /api/tickets/admin/:ticketId/respond             # Admin respond

PHASE 3 - ADVANCED FEATURES (12+ endpoints):
✅ GET    /api/tickets/templates                           # Get templates
✅ GET    /api/tickets/templates/:templateId               # Template details
✅ POST   /api/tickets/templates/:templateId/use           # Use template
✅ GET    /api/tickets/search/config                       # Search config
✅ POST   /api/tickets/search                              # Advanced search
✅ GET    /api/tickets/search/suggestions                  # Search suggestions
✅ GET    /api/tickets/filters                             # Get saved filters
✅ POST   /api/tickets/filters                             # Save filter
✅ POST   /api/tickets/filters/:filterId/apply             # Apply filter
✅ DELETE /api/tickets/filters/:filterId                   # Delete filter
✅ POST   /api/tickets/admin/templates                     # Create template
✅ PUT    /api/tickets/admin/templates/:templateId         # Update template
✅ DELETE /api/tickets/admin/templates/:templateId         # Delete template
✅ POST   /api/tickets/admin/bulk/assign                   # Bulk assign
✅ POST   /api/tickets/admin/bulk/status                   # Bulk status change
✅ POST   /api/tickets/admin/bulk/priority                 # Bulk priority change
✅ POST   /api/tickets/admin/bulk/close                    # Bulk close
✅ POST   /api/tickets/admin/bulk/category                 # Bulk category change
✅ GET    /api/tickets/admin/bulk/operations/:operationId  # Operation status
✅ GET    /api/tickets/admin/bulk/history                  # Operation history
✅ GET    /api/tickets/admin/statistics                    # Advanced statistics
✅ GET    /api/tickets/admin/search/popular                # Popular searches
✅ GET    /api/tickets/admin/users/:userId/audit           # User audit history

TOTAL: 35+ endpoints covering all functionality
*/