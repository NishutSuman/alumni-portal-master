// ==========================================
// SUBSCRIPTION ADMIN ROUTES
// File: apm-server/src/routes/admin/subscriptionAdmin.route.js
// Super Admin endpoints for subscription management
// ==========================================

const express = require('express');
const router = express.Router();
const subscriptionAdminController = require('../../controllers/admin/subscriptionAdmin.controller');
const subscriptionPaymentController = require('../../controllers/admin/subscriptionPayment.controller');
const { authenticateToken, requireRole } = require('../../middleware/auth/auth.middleware');
const { asyncHandler } = require('../../utils/response');

// All routes require authentication and SUPER_ADMIN role
router.use(authenticateToken);
router.use(requireRole(['SUPER_ADMIN']));

// ==========================================
// SUBSCRIPTION STATUS
// ==========================================

/**
 * GET /api/admin/subscription/status
 * Get organization's subscription status with alerts
 */
router.get('/status', asyncHandler(subscriptionAdminController.getSubscriptionStatus));

/**
 * GET /api/admin/subscription/available-plans
 * Get available plans for upgrade with feature matrix
 */
router.get('/available-plans', asyncHandler(subscriptionAdminController.getAvailablePlans));

/**
 * GET /api/admin/subscription/features
 * Get enabled features for organization
 */
router.get('/features', asyncHandler(subscriptionAdminController.getEnabledFeatures));

// ==========================================
// PAYMENT REQUESTS
// ==========================================

/**
 * GET /api/admin/subscription/payment-requests
 * Get payment requests for organization
 * Query: ?status=PENDING|APPROVED|PAID|REJECTED|EXPIRED
 */
router.get('/payment-requests', asyncHandler(subscriptionAdminController.getPaymentRequests));

/**
 * GET /api/admin/subscription/payment-requests/:requestId
 * Get single payment request details
 */
router.get('/payment-requests/:requestId', asyncHandler(subscriptionAdminController.getPaymentRequestById));

/**
 * POST /api/admin/subscription/payment-requests/:requestId/approve
 * Approve payment request
 * Body: { responseNote?: string }
 */
router.post('/payment-requests/:requestId/approve', asyncHandler(subscriptionAdminController.approvePaymentRequest));

/**
 * POST /api/admin/subscription/payment-requests/:requestId/reject
 * Reject payment request
 * Body: { responseNote: string } (required)
 */
router.post('/payment-requests/:requestId/reject', asyncHandler(subscriptionAdminController.rejectPaymentRequest));

/**
 * POST /api/admin/subscription/payment-requests/:requestId/pay
 * Complete payment for request
 * Body: { transactionId: string, amount?: number, invoiceUrl?: string }
 */
router.post('/payment-requests/:requestId/pay', asyncHandler(subscriptionAdminController.completePayment));

// ==========================================
// SUBSCRIPTION ACTIONS
// ==========================================

/**
 * POST /api/admin/subscription/renew
 * Renew subscription directly
 * Body: { transactionId: string, amount?: number, billingCycle?: string }
 */
router.post('/renew', asyncHandler(subscriptionAdminController.renewSubscription));

/**
 * POST /api/admin/subscription/cancel
 * Cancel subscription
 * Body: { reason?: string }
 */
router.post('/cancel', asyncHandler(subscriptionAdminController.cancelSubscription));

// ==========================================
// RAZORPAY PAYMENT INTEGRATION
// ==========================================

/**
 * POST /api/admin/subscription/payment-requests/:requestId/initiate-payment
 * Initiate Razorpay payment for approved payment request
 * Returns: Razorpay order details for checkout
 */
router.post('/payment-requests/:requestId/initiate-payment', asyncHandler(subscriptionPaymentController.initiateRenewalPayment));

/**
 * POST /api/admin/subscription/initiate-new-subscription
 * Initiate payment for new subscription (no prior subscription)
 * Body: { planId: string, billingCycle: 'MONTHLY' | 'YEARLY' }
 */
router.post('/initiate-new-subscription', asyncHandler(subscriptionPaymentController.initiateNewSubscriptionPayment));

/**
 * POST /api/admin/subscription/verify-payment
 * Verify Razorpay payment callback
 * Body: { transactionId, razorpay_payment_id, razorpay_order_id, razorpay_signature }
 */
router.post('/verify-payment', asyncHandler(subscriptionPaymentController.verifySubscriptionPayment));

/**
 * GET /api/admin/subscription/payment-history
 * Get subscription payment history for organization
 */
router.get('/payment-history', asyncHandler(subscriptionPaymentController.getSubscriptionPaymentHistory));

/**
 * GET /api/admin/subscription/invoice/:transactionId
 * Get or generate invoice for subscription payment
 */
router.get('/invoice/:transactionId', asyncHandler(subscriptionPaymentController.getSubscriptionInvoice));

module.exports = router;
