const express = require('express');
const router = express.Router();

// Import middleware (following existing pattern)
const { authenticateToken, requireRole } = require('../middleware/auth/auth.middleware');
const { asyncHandler } = require('../utils/response');
const { 
  requireAlumniVerification 
} = require('../middleware/auth/alumniVerification.middleware');

// Import payment-specific middleware
const {
  validateInitiatePayment,
  validateVerifyPayment,
  validateCalculatePayment,
  validateTransactionIdParam,
  validateProviderParam,
  validateAdminPaymentList,
  validatePaymentAnalytics,
  validatePaymentInitiationRules,
  validatePaymentVerificationRules,
  validateWebhookRequest
} = require('../middleware/validation/payment.validation.middleware');

// Import caching middleware
const {
  cacheUserPayments,
  cachePaymentStatus,
  cachePaymentCalculation,
  cacheAdminPayments,
  cachePaymentAnalytics,
  cacheInvoice,
  autoInvalidatePaymentCaches
} = require('../middleware/cache/payment.cache.middleware');

// Import controllers
const paymentController = require('../controllers/payment/payment.controller');
const invoiceController = require('../controllers/payment/invoice.controller');

// =============================================
// PUBLIC ROUTES
// =============================================

// Handle payment webhook from providers
router.post(
  '/webhook/:provider',
  [
    validateProviderParam,
    validateWebhookRequest,
    autoInvalidatePaymentCaches
  ],
  asyncHandler(paymentController.handleWebhook)
);

// =============================================
// USER ROUTES (Authenticated)
// =============================================

// Calculate payment total (preview) - CACHED
router.post(
  '/calculate',
  [
    authenticateToken,
    requireAlumniVerification,
    validateCalculatePayment,
    cachePaymentCalculation
  ],
  asyncHandler(paymentController.calculatePaymentTotal)
);

// Initiate payment transaction
router.post(
  '/initiate',
  [
    authenticateToken,
    requireAlumniVerification,
    validateInitiatePayment,
    validatePaymentInitiationRules,
    autoInvalidatePaymentCaches
  ],
  asyncHandler(paymentController.initiatePayment)
);

// Verify payment completion
router.post(
  '/:transactionId/verify',
  [
    authenticateToken,
    requireAlumniVerification,
    validateTransactionIdParam,
    validateVerifyPayment,
    validatePaymentVerificationRules,
    autoInvalidatePaymentCaches
  ],
  asyncHandler(paymentController.verifyPayment)
);

// Get payment status - CACHED
router.get(
  '/:transactionId/status',
  [
    authenticateToken,
    requireAlumniVerification,
    validateTransactionIdParam,
    cachePaymentStatus
  ],
  asyncHandler(paymentController.getPaymentStatus)
);

// Get user's payment history - CACHED
router.get(
  '/my-payments',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheUserPayments
  ],
  asyncHandler(paymentController.getUserPayments)
);

// =============================================
// INVOICE ROUTES (User)
// =============================================

// Generate invoice
router.post(
  '/:transactionId/invoice',
  [
    authenticateToken,
    requireAlumniVerification,
    validateTransactionIdParam,
    autoInvalidatePaymentCaches
  ],
  asyncHandler(invoiceController.generateInvoice)
);

// Get invoice data - CACHED
router.get(
  '/:transactionId/invoice',
  [
    authenticateToken,
    requireAlumniVerification,
    validateTransactionIdParam,
    cacheInvoice
  ],
  asyncHandler(invoiceController.getInvoice)
);

// Download invoice PDF
router.get(
  '/:transactionId/invoice/pdf',
  [
    authenticateToken,
    requireAlumniVerification,
    validateTransactionIdParam
  ],
  asyncHandler(invoiceController.downloadInvoicePDF)
);

// Resend invoice email
router.post(
  '/:transactionId/invoice/resend',
  [
    authenticateToken,
    requireAlumniVerification,
    validateTransactionIdParam
  ],
  asyncHandler(invoiceController.resendInvoiceEmail)
);

// =============================================
// ADMIN ROUTES
// =============================================

// Get all payments with filters - CACHED
router.get(
  '/admin/payments',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateAdminPaymentList,
    cacheAdminPayments
  ],
  asyncHandler(paymentController.getAdminPayments)
);

// Get payment analytics - CACHED
router.get(
  '/admin/payments/analytics',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validatePaymentAnalytics,
    cachePaymentAnalytics
  ],
  asyncHandler(paymentController.getPaymentAnalytics)
);

// Get detailed payment information
router.get(
  '/admin/payments/:transactionId',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTransactionIdParam
  ],
  asyncHandler(paymentController.getAdminPaymentDetails)
);

// Admin generate invoice
router.post(
  '/admin/payments/:transactionId/invoice',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTransactionIdParam,
    autoInvalidatePaymentCaches
  ],
  asyncHandler(invoiceController.adminGenerateInvoice)
);

// Admin get invoice
router.get(
  '/admin/payments/:transactionId/invoice',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateTransactionIdParam,
    cacheInvoice
  ],
  asyncHandler(invoiceController.adminGetInvoice)
);

module.exports = router;