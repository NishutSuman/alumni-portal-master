// ==========================================
// SUBSCRIPTION PAYMENT CONTROLLER
// File: apm-server/src/controllers/admin/subscriptionPayment.controller.js
// Super Admin endpoints for subscription payments via Razorpay
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const PaymentService = require('../../services/payment/PaymentService');
const { getTenantFilter } = require('../../utils/tenant.util');

// ==========================================
// SUBSCRIPTION PAYMENT INITIATION
// ==========================================

/**
 * Initiate payment for approved subscription renewal request
 * POST /api/admin/subscription/payment-requests/:requestId/initiate-payment
 * Access: SUPER_ADMIN only
 */
const initiateRenewalPayment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;
    const tenantFilter = getTenantFilter(req);

    // Verify the payment request exists and belongs to admin's organization
    const paymentRequest = await prisma.subscriptionPaymentRequest.findUnique({
      where: { id: requestId },
      include: {
        subscription: {
          include: {
            organization: true,
            plan: true
          }
        }
      }
    });

    if (!paymentRequest) {
      return errorResponse(res, 'Payment request not found', 404);
    }

    // Verify organization ownership
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (paymentRequest.subscription.organizationId !== organization?.id) {
      return errorResponse(res, 'Payment request not found', 404);
    }

    if (paymentRequest.status !== 'APPROVED') {
      return errorResponse(res, 'Payment request must be approved before payment', 400);
    }

    // Determine reference type based on request type
    let referenceType;
    if (paymentRequest.requestType === 'PLAN_UPGRADE') {
      referenceType = 'SUBSCRIPTION_UPGRADE';
    } else {
      referenceType = 'SUBSCRIPTION_RENEWAL';
    }

    // Initiate payment through PaymentService
    const paymentResult = await PaymentService.initiatePayment({
      referenceType,
      referenceId: requestId, // Payment request ID
      userId,
      description: `Subscription ${paymentRequest.requestType === 'PLAN_UPGRADE' ? 'Upgrade' : 'Renewal'} - ${paymentRequest.subscription.plan.name}`
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'subscription_payment_initiated',
        details: {
          requestId,
          transactionId: paymentResult.transaction.id,
          amount: paymentResult.transaction.amount,
          requestType: paymentRequest.requestType
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      transaction: paymentResult.transaction,
      breakdown: paymentResult.breakdown,
      items: paymentResult.items,
      provider: paymentResult.provider,
      paymentRequest: {
        id: paymentRequest.id,
        requestType: paymentRequest.requestType,
        amount: paymentRequest.amount
      }
    }, 'Payment initiated successfully');
  } catch (error) {
    console.error('Initiate renewal payment error:', error);
    return errorResponse(res, error.message || 'Failed to initiate payment', 500);
  }
};

/**
 * Initiate payment for new subscription (when no prior subscription exists)
 * POST /api/admin/subscription/initiate-new-subscription
 * Access: SUPER_ADMIN only
 * Body: { planId: string, billingCycle: 'MONTHLY' | 'YEARLY' }
 */
const initiateNewSubscriptionPayment = async (req, res) => {
  try {
    const { planId, billingCycle = 'YEARLY' } = req.body;
    const userId = req.user.id;
    const tenantFilter = getTenantFilter(req);

    if (!planId) {
      return errorResponse(res, 'Plan ID is required', 400);
    }

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Check if organization already has an active subscription
    const existingSubscription = await prisma.organizationSubscription.findUnique({
      where: { organizationId: organization.id }
    });

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      return errorResponse(res, 'Organization already has an active subscription. Use upgrade or renewal instead.', 400);
    }

    // Verify plan exists
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      return errorResponse(res, 'Plan not found', 404);
    }

    if (!plan.isActive) {
      return errorResponse(res, 'Selected plan is not available', 400);
    }

    // Initiate payment through PaymentService
    const paymentResult = await PaymentService.initiatePayment({
      referenceType: 'SUBSCRIPTION_NEW',
      referenceId: organization.id, // Organization ID
      userId,
      description: `New Subscription - ${plan.name} (${billingCycle})`,
      planId,
      billingCycle
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'new_subscription_payment_initiated',
        details: {
          organizationId: organization.id,
          planId,
          planName: plan.name,
          billingCycle,
          transactionId: paymentResult.transaction.id,
          amount: paymentResult.transaction.amount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      transaction: paymentResult.transaction,
      breakdown: paymentResult.breakdown,
      items: paymentResult.items,
      provider: paymentResult.provider,
      subscription: {
        organizationId: organization.id,
        organizationName: organization.name,
        planId: plan.id,
        planName: plan.name,
        billingCycle
      }
    }, 'Payment initiated successfully');
  } catch (error) {
    console.error('Initiate new subscription payment error:', error);
    return errorResponse(res, error.message || 'Failed to initiate payment', 500);
  }
};

/**
 * Verify subscription payment (callback from Razorpay)
 * POST /api/admin/subscription/verify-payment
 * Access: SUPER_ADMIN only
 * Body: { transactionId, razorpay_payment_id, razorpay_order_id, razorpay_signature }
 */
const verifySubscriptionPayment = async (req, res) => {
  try {
    const { transactionId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const userId = req.user.id;

    if (!transactionId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return errorResponse(res, 'Missing payment verification data', 400);
    }

    // Verify the transaction belongs to subscription payment
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    const subscriptionTypes = ['SUBSCRIPTION_RENEWAL', 'SUBSCRIPTION_UPGRADE', 'SUBSCRIPTION_NEW'];
    if (!subscriptionTypes.includes(transaction.referenceType)) {
      return errorResponse(res, 'Invalid transaction type', 400);
    }

    // Verify payment through PaymentService
    const verificationResult = await PaymentService.verifyPayment({
      transactionId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'subscription_payment_verified',
        details: {
          transactionId,
          transactionNumber: transaction.transactionNumber,
          amount: transaction.amount,
          referenceType: transaction.referenceType,
          paymentId: razorpay_payment_id,
          success: verificationResult.success
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      success: verificationResult.success,
      transaction: verificationResult.transaction,
      message: 'Payment verified and subscription updated successfully'
    }, 'Payment verified successfully');
  } catch (error) {
    console.error('Verify subscription payment error:', error);
    return errorResponse(res, error.message || 'Payment verification failed', 500);
  }
};

/**
 * Get payment history for organization's subscriptions
 * GET /api/admin/subscription/payment-history
 * Access: SUPER_ADMIN only
 */
const getSubscriptionPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const tenantFilter = getTenantFilter(req);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Get subscription payment transactions
    const [transactions, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where: {
          referenceType: {
            in: ['SUBSCRIPTION_RENEWAL', 'SUBSCRIPTION_UPGRADE', 'SUBSCRIPTION_NEW']
          },
          metadata: {
            path: ['organizationId'],
            equals: organization.id
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          }
        }
      }),
      prisma.paymentTransaction.count({
        where: {
          referenceType: {
            in: ['SUBSCRIPTION_RENEWAL', 'SUBSCRIPTION_UPGRADE', 'SUBSCRIPTION_NEW']
          },
          metadata: {
            path: ['organizationId'],
            equals: organization.id
          }
        }
      })
    ]);

    return successResponse(res, {
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }, 'Payment history retrieved successfully');
  } catch (error) {
    console.error('Get subscription payment history error:', error);
    return errorResponse(res, 'Failed to retrieve payment history', 500);
  }
};

/**
 * Get invoice for a subscription payment
 * GET /api/admin/subscription/invoice/:transactionId
 * Access: SUPER_ADMIN only
 */
const getSubscriptionInvoice = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const tenantFilter = getTenantFilter(req);

    // Get the transaction
    const transaction = await prisma.paymentTransaction.findUnique({
      where: { id: transactionId },
      include: {
        user: {
          select: {
            fullName: true,
            email: true
          }
        },
        invoice: true
      }
    });

    if (!transaction) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    // Verify organization ownership
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (transaction.metadata?.organizationId !== organization?.id) {
      return errorResponse(res, 'Transaction not found', 404);
    }

    // Get or generate invoice
    let invoice = transaction.invoice;

    if (!invoice) {
      // Generate invoice (placeholder - actual PDF generation would go here)
      invoice = await prisma.paymentInvoice.create({
        data: {
          transactionId: transaction.id,
          invoiceNumber: `INV-SUB-${Date.now()}`,
          amount: transaction.amount,
          currency: transaction.currency || 'INR',
          status: 'GENERATED',
          items: transaction.breakdown || {},
          billingDetails: {
            organizationName: transaction.metadata?.organizationName,
            planName: transaction.metadata?.planName || transaction.metadata?.newPlanName,
            billingCycle: transaction.metadata?.billingCycle
          },
          generatedAt: new Date()
        }
      });
    }

    return successResponse(res, {
      invoice,
      transaction: {
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        amount: transaction.amount,
        status: transaction.status,
        completedAt: transaction.completedAt
      }
    }, 'Invoice retrieved successfully');
  } catch (error) {
    console.error('Get subscription invoice error:', error);
    return errorResponse(res, 'Failed to retrieve invoice', 500);
  }
};

module.exports = {
  initiateRenewalPayment,
  initiateNewSubscriptionPayment,
  verifySubscriptionPayment,
  getSubscriptionPaymentHistory,
  getSubscriptionInvoice
};
