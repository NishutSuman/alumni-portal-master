// src/routes/developer.route.js
// Developer Portal Routes - For managing multi-tenant organizations

const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developer/developer.controller');
const { authenticateToken, requireRole } = require('../middleware/auth/auth.middleware');
const { asyncHandler } = require('../utils/response');
const { uploadOrganizationFiles } = require('../middleware/upload.middleware');

// All routes require authentication and DEVELOPER role
router.use(authenticateToken);
router.use(requireRole(['DEVELOPER']));

// ==========================================
// DEVELOPER DASHBOARD
// ==========================================

// GET /api/developer/dashboard - Get developer dashboard overview
router.get('/dashboard', asyncHandler(developerController.getDeveloperDashboard));

// POST /api/developer/switch-tenant - Switch to organization context
router.post('/switch-tenant', asyncHandler(developerController.switchTenantContext));

// ==========================================
// SUBSCRIPTION PLANS MANAGEMENT
// ==========================================

// GET /api/developer/plans - Get all subscription plans
router.get('/plans', asyncHandler(developerController.getAllPlans));

// GET /api/developer/plans/:planId - Get single plan details
router.get('/plans/:planId', asyncHandler(developerController.getPlanById));

// POST /api/developer/plans - Create new subscription plan
router.post('/plans', asyncHandler(developerController.createPlan));

// PUT /api/developer/plans/:planId - Update subscription plan
router.put('/plans/:planId', asyncHandler(developerController.updatePlan));

// POST /api/developer/plans/:planId/features - Set features for a plan
router.post('/plans/:planId/features', asyncHandler(developerController.setPlanFeatures));

// ==========================================
// FEATURE CATALOG MANAGEMENT
// ==========================================

// GET /api/developer/features - Get all features
router.get('/features', asyncHandler(developerController.getAllFeatures));

// GET /api/developer/features/matrix - Get feature matrix (features x plans)
router.get('/features/matrix', asyncHandler(developerController.getFeatureMatrix));

// POST /api/developer/features - Create new feature
router.post('/features', asyncHandler(developerController.createFeature));

// POST /api/developer/features/seed - Seed default features
router.post('/features/seed', asyncHandler(developerController.seedFeatures));

// PUT /api/developer/features/:featureId - Update feature
router.put('/features/:featureId', asyncHandler(developerController.updateFeature));

// ==========================================
// PAYMENT REQUESTS (Developer creates, Admin pays)
// ==========================================

// GET /api/developer/payment-requests - Get all pending payment requests
router.get('/payment-requests', asyncHandler(developerController.getPendingPaymentRequests));

// ==========================================
// SUBSCRIPTION CRON/MANAGEMENT
// ==========================================

// POST /api/developer/subscriptions/check-expirations - Check and process expired subscriptions
router.post('/subscriptions/check-expirations', asyncHandler(developerController.checkExpirations));

// ==========================================
// ORGANIZATION MANAGEMENT
// ==========================================

// GET /api/developer/organizations - Get all organizations
router.get('/organizations', asyncHandler(developerController.getAllOrganizations));

// GET /api/developer/organizations/:orgId - Get single organization
router.get('/organizations/:orgId', asyncHandler(developerController.getOrganizationById));

// POST /api/developer/organizations - Create new organization
router.post('/organizations', asyncHandler(developerController.createOrganization));

// PUT /api/developer/organizations/:orgId - Update organization
router.put('/organizations/:orgId', asyncHandler(developerController.updateOrganization));

// POST /api/developer/organizations/:orgId/maintenance - Toggle maintenance mode
router.post('/organizations/:orgId/maintenance', asyncHandler(developerController.toggleMaintenanceMode));

// ==========================================
// ORGANIZATION SUBSCRIPTION MANAGEMENT
// ==========================================

// GET /api/developer/organizations/:orgId/subscription-details - Get subscription details with features
router.get('/organizations/:orgId/subscription-details', asyncHandler(developerController.getOrganizationSubscriptionDetails));

// POST /api/developer/organizations/:orgId/subscription - Create/assign subscription to organization
router.post('/organizations/:orgId/subscription', asyncHandler(developerController.createOrganizationSubscription));

// POST /api/developer/organizations/:orgId/subscription-legacy - Legacy: Update subscription status directly
router.post('/organizations/:orgId/subscription-legacy', asyncHandler(developerController.updateSubscription));

// POST /api/developer/organizations/:orgId/change-plan - Change organization's plan
router.post('/organizations/:orgId/change-plan', asyncHandler(developerController.changeOrganizationPlan));

// POST /api/developer/organizations/:orgId/suspend - Suspend organization
router.post('/organizations/:orgId/suspend', asyncHandler(developerController.suspendOrganization));

// POST /api/developer/organizations/:orgId/reactivate - Reactivate suspended organization
router.post('/organizations/:orgId/reactivate', asyncHandler(developerController.reactivateOrganization));

// GET /api/developer/organizations/:orgId/subscription-audit - Get subscription audit logs
router.get('/organizations/:orgId/subscription-audit', asyncHandler(developerController.getSubscriptionAuditLogs));

// ==========================================
// ORGANIZATION FEATURE MANAGEMENT
// ==========================================

// GET /api/developer/organizations/:orgId/features - Get organization features
router.get('/organizations/:orgId/features', asyncHandler(developerController.getOrganizationFeatures));

// POST /api/developer/organizations/:orgId/features/:featureCode/toggle - Toggle feature
router.post('/organizations/:orgId/features/:featureCode/toggle', asyncHandler(developerController.toggleOrganizationFeature));

// POST /api/developer/organizations/:orgId/features/:featureCode/limit - Set feature limit
router.post('/organizations/:orgId/features/:featureCode/limit', asyncHandler(developerController.setOrganizationFeatureLimit));

// ==========================================
// ORGANIZATION PAYMENT REQUESTS
// ==========================================

// POST /api/developer/organizations/:orgId/payment-request - Create payment request (Dev -> Admin)
router.post('/organizations/:orgId/payment-request', asyncHandler(developerController.createPaymentRequest));

// ==========================================
// ORGANIZATION STATISTICS
// ==========================================

// GET /api/developer/organizations/:orgId/stats - Get organization statistics
router.get('/organizations/:orgId/stats', asyncHandler(developerController.getOrganizationStats));

// ==========================================
// ORGANIZATION FILE UPLOADS
// ==========================================

// POST /api/developer/organizations/:orgId/upload - Upload organization files (logo, bylaw, certificate)
router.post('/organizations/:orgId/upload', uploadOrganizationFiles, asyncHandler(developerController.uploadOrganizationFiles));

// DELETE /api/developer/organizations/:orgId/files/:fileType - Delete organization file
router.delete('/organizations/:orgId/files/:fileType', asyncHandler(developerController.deleteOrganizationFile));

// ==========================================
// ORGANIZATION USER MANAGEMENT
// ==========================================

// GET /api/developer/organizations/:orgId/users - Get all users with pagination & filters
router.get('/organizations/:orgId/users', asyncHandler(developerController.getOrganizationUsers));

// GET /api/developer/organizations/:orgId/users/:userId - Get single user details
router.get('/organizations/:orgId/users/:userId', asyncHandler(developerController.getOrganizationUser));

// POST /api/developer/organizations/:orgId/users - Create new user
router.post('/organizations/:orgId/users', asyncHandler(developerController.createOrganizationUser));

// PUT /api/developer/organizations/:orgId/users/:userId - Update user
router.put('/organizations/:orgId/users/:userId', asyncHandler(developerController.updateOrganizationUser));

// POST /api/developer/organizations/:orgId/users/:userId/reset-password - Reset user password
router.post('/organizations/:orgId/users/:userId/reset-password', asyncHandler(developerController.resetUserPassword));

// POST /api/developer/organizations/:orgId/users/:userId/toggle-status - Block/Unblock user
router.post('/organizations/:orgId/users/:userId/toggle-status', asyncHandler(developerController.toggleUserStatus));

// DELETE /api/developer/organizations/:orgId/users/:userId - Delete user
router.delete('/organizations/:orgId/users/:userId', asyncHandler(developerController.deleteOrganizationUser));

// ==========================================
// ORGANIZATION ACTIVITY LOGS
// ==========================================

// GET /api/developer/organizations/:orgId/activity-logs - Get activity logs
router.get('/organizations/:orgId/activity-logs', asyncHandler(developerController.getOrganizationActivityLogs));

// ==========================================
// ORGANIZATION EMAIL CONFIGURATION
// ==========================================

// GET /api/developer/organizations/:orgId/email-config - Get email configuration
router.get('/organizations/:orgId/email-config', asyncHandler(developerController.getOrganizationEmailConfig));

// POST /api/developer/organizations/:orgId/email-config - Save/Update email configuration
router.post('/organizations/:orgId/email-config', asyncHandler(developerController.saveOrganizationEmailConfig));

// POST /api/developer/organizations/:orgId/email-config/test - Test email configuration
router.post('/organizations/:orgId/email-config/test', asyncHandler(developerController.testOrganizationEmailConfig));

// POST /api/developer/organizations/:orgId/email-config/activate - Activate email configuration
router.post('/organizations/:orgId/email-config/activate', asyncHandler(developerController.activateOrganizationEmailConfig));

// POST /api/developer/organizations/:orgId/email-config/deactivate - Deactivate email configuration
router.post('/organizations/:orgId/email-config/deactivate', asyncHandler(developerController.deactivateOrganizationEmailConfig));

// DELETE /api/developer/organizations/:orgId/email-config - Delete email configuration
router.delete('/organizations/:orgId/email-config', asyncHandler(developerController.deleteOrganizationEmailConfig));

// GET /api/developer/organizations/:orgId/email-config/stats - Get email statistics
router.get('/organizations/:orgId/email-config/stats', asyncHandler(developerController.getOrganizationEmailStats));

module.exports = router;
