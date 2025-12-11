// ==========================================
// SUBSCRIPTION ADMIN CONTROLLER
// File: apm-server/src/controllers/admin/subscriptionAdmin.controller.js
// Super Admin endpoints for subscription payment requests
// ==========================================

const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');
const SubscriptionService = require('../../services/subscription/SubscriptionService');
const FeatureService = require('../../services/subscription/FeatureService');
const { getTenantFilter } = require('../../utils/tenant.util');

// ==========================================
// PAYMENT REQUEST MANAGEMENT (Super Admin)
// ==========================================

/**
 * Get payment requests for Super Admin's organization
 * GET /api/admin/subscription/payment-requests
 * Access: SUPER_ADMIN only
 */
const getPaymentRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const { skip } = getPaginationParams(req.query, 20);
    const tenantFilter = getTenantFilter(req);

    // Get organization's subscription
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true },
      include: { subscription: true }
    });

    if (!organization?.subscription) {
      return successResponse(res, { requests: [], pagination: { total: 0 } }, 'No subscription found');
    }

    const whereClause = {
      subscriptionId: organization.subscription.id
    };

    if (status) {
      whereClause.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.subscriptionPaymentRequest.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.subscriptionPaymentRequest.count({ where: whereClause })
    ]);

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(res, requests, pagination, 'Payment requests retrieved successfully');
  } catch (error) {
    console.error('Get payment requests error:', error);
    return errorResponse(res, 'Failed to retrieve payment requests', 500);
  }
};

/**
 * Get single payment request details
 * GET /api/admin/subscription/payment-requests/:requestId
 * Access: SUPER_ADMIN only
 */
const getPaymentRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantFilter = getTenantFilter(req);

    const request = await prisma.subscriptionPaymentRequest.findUnique({
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

    if (!request) {
      return errorResponse(res, 'Payment request not found', 404);
    }

    // Verify request belongs to admin's organization
    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (request.subscription.organizationId !== organization?.id) {
      return errorResponse(res, 'Payment request not found', 404);
    }

    // If upgrade request, get new plan details
    let requestedPlan = null;
    if (request.requestedPlanId) {
      requestedPlan = await SubscriptionService.getPlan(request.requestedPlanId);
    }

    return successResponse(res, {
      request,
      requestedPlan,
      currentPlan: request.subscription.plan
    }, 'Payment request retrieved successfully');
  } catch (error) {
    console.error('Get payment request by ID error:', error);
    return errorResponse(res, 'Failed to retrieve payment request', 500);
  }
};

/**
 * Approve payment request
 * POST /api/admin/subscription/payment-requests/:requestId/approve
 * Access: SUPER_ADMIN only
 */
const approvePaymentRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responseNote } = req.body;
    const adminId = req.user.id;

    const request = await SubscriptionService.approvePaymentRequest(
      requestId,
      adminId,
      responseNote
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'payment_request_approved',
        details: {
          requestId,
          amount: request.amount,
          requestType: request.requestType
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { request }, 'Payment request approved successfully');
  } catch (error) {
    console.error('Approve payment request error:', error);
    return errorResponse(res, error.message || 'Failed to approve payment request', 500);
  }
};

/**
 * Reject payment request
 * POST /api/admin/subscription/payment-requests/:requestId/reject
 * Access: SUPER_ADMIN only
 */
const rejectPaymentRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responseNote } = req.body;
    const adminId = req.user.id;

    if (!responseNote) {
      return errorResponse(res, 'Rejection reason is required', 400);
    }

    const request = await SubscriptionService.rejectPaymentRequest(
      requestId,
      adminId,
      responseNote
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'payment_request_rejected',
        details: {
          requestId,
          reason: responseNote
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { request }, 'Payment request rejected');
  } catch (error) {
    console.error('Reject payment request error:', error);
    return errorResponse(res, error.message || 'Failed to reject payment request', 500);
  }
};

/**
 * Complete payment (mark as paid)
 * POST /api/admin/subscription/payment-requests/:requestId/pay
 * Access: SUPER_ADMIN only
 */
const completePayment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { transactionId, amount, invoiceUrl } = req.body;
    const adminId = req.user.id;

    if (!transactionId) {
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    const request = await SubscriptionService.markPaymentRequestPaid(
      requestId,
      {
        transactionId,
        amount,
        invoiceUrl
      },
      adminId
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'subscription_payment_completed',
        details: {
          requestId,
          transactionId,
          amount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { request }, 'Payment completed and subscription updated');
  } catch (error) {
    console.error('Complete payment error:', error);
    return errorResponse(res, error.message || 'Failed to complete payment', 500);
  }
};

// ==========================================
// SUBSCRIPTION STATUS (Super Admin View)
// ==========================================

/**
 * Get organization's subscription status
 * GET /api/admin/subscription/status
 * Access: SUPER_ADMIN only
 */
const getSubscriptionStatus = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    const subscription = await SubscriptionService.getOrganizationSubscription(organization.id);
    const features = await FeatureService.getOrganizationFeatures(organization.id);
    const pendingRequests = await SubscriptionService.getPendingPaymentRequests(organization.id);

    // Calculate usage
    const usage = await SubscriptionService.getUsage(organization.id, 'monthly');

    // Calculate days remaining
    let daysRemaining = null;
    if (subscription?.currentPeriodEnd) {
      const now = new Date();
      const end = new Date(subscription.currentPeriodEnd);
      daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    }

    return successResponse(res, {
      organization: {
        id: organization.id,
        name: organization.name,
        subscriptionStatus: organization.subscriptionStatus,
        subscriptionEndsAt: organization.subscriptionEndsAt
      },
      subscription,
      features: {
        enabled: features.filter(f => f.isEnabled),
        disabled: features.filter(f => !f.isEnabled),
        total: features.length
      },
      usage,
      daysRemaining,
      pendingPaymentRequests: pendingRequests.length,
      alerts: generateSubscriptionAlerts(subscription, daysRemaining, usage)
    }, 'Subscription status retrieved successfully');
  } catch (error) {
    console.error('Get subscription status error:', error);
    return errorResponse(res, 'Failed to retrieve subscription status', 500);
  }
};

/**
 * Renew subscription directly (if organization has pre-approved)
 * POST /api/admin/subscription/renew
 * Access: SUPER_ADMIN only
 */
const renewSubscription = async (req, res) => {
  try {
    const { transactionId, amount, billingCycle } = req.body;
    const adminId = req.user.id;
    const tenantFilter = getTenantFilter(req);

    if (!transactionId) {
      return errorResponse(res, 'Transaction ID is required', 400);
    }

    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    const subscription = await SubscriptionService.renewSubscription(
      organization.id,
      { transactionId, amount },
      adminId
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'subscription_renewed',
        details: {
          organizationId: organization.id,
          transactionId,
          amount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { subscription }, 'Subscription renewed successfully');
  } catch (error) {
    console.error('Renew subscription error:', error);
    return errorResponse(res, error.message || 'Failed to renew subscription', 500);
  }
};

/**
 * Cancel subscription
 * POST /api/admin/subscription/cancel
 * Access: SUPER_ADMIN only
 */
const cancelSubscription = async (req, res) => {
  try {
    const { reason } = req.body;
    const adminId = req.user.id;
    const tenantFilter = getTenantFilter(req);

    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    const subscription = await SubscriptionService.cancelSubscription(
      organization.id,
      reason || 'Cancelled by admin',
      adminId
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'subscription_cancelled',
        details: {
          organizationId: organization.id,
          reason
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { subscription }, 'Subscription cancelled');
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return errorResponse(res, error.message || 'Failed to cancel subscription', 500);
  }
};

// ==========================================
// FEATURE MANAGEMENT (Super Admin View)
// ==========================================

/**
 * Get enabled features for organization
 * GET /api/admin/subscription/features
 * Access: SUPER_ADMIN only
 */
const getEnabledFeatures = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const organization = await prisma.organization.findFirst({
      where: { ...tenantFilter, isActive: true }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    const features = await FeatureService.getOrganizationFeatures(organization.id);

    // Group by category
    const featuresByCategory = features.reduce((acc, feature) => {
      if (!acc[feature.category]) {
        acc[feature.category] = [];
      }
      acc[feature.category].push(feature);
      return acc;
    }, {});

    return successResponse(res, {
      features,
      featuresByCategory,
      summary: {
        total: features.length,
        enabled: features.filter(f => f.isEnabled).length,
        disabled: features.filter(f => !f.isEnabled).length,
        premium: features.filter(f => f.isPremium && f.isEnabled).length
      }
    }, 'Features retrieved successfully');
  } catch (error) {
    console.error('Get enabled features error:', error);
    return errorResponse(res, 'Failed to retrieve features', 500);
  }
};

/**
 * Get available plans for upgrade
 * GET /api/admin/subscription/available-plans
 * Access: SUPER_ADMIN only
 */
const getAvailablePlans = async (req, res) => {
  try {
    const plans = await SubscriptionService.getAllPlans(false);
    const featureMatrix = await FeatureService.getFeatureMatrix();

    return successResponse(res, {
      plans,
      featureMatrix
    }, 'Available plans retrieved successfully');
  } catch (error) {
    console.error('Get available plans error:', error);
    return errorResponse(res, 'Failed to retrieve available plans', 500);
  }
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate subscription alerts
 */
function generateSubscriptionAlerts(subscription, daysRemaining, usage) {
  const alerts = [];

  if (!subscription) {
    alerts.push({
      type: 'error',
      message: 'No subscription found. Please contact support.'
    });
    return alerts;
  }

  // Status-based alerts
  switch (subscription.status) {
    case 'TRIAL':
      alerts.push({
        type: 'info',
        message: `Trial period: ${daysRemaining} days remaining`
      });
      if (daysRemaining <= 3) {
        alerts.push({
          type: 'warning',
          message: 'Trial ending soon. Please upgrade to continue using all features.'
        });
      }
      break;
    case 'GRACE_PERIOD':
      alerts.push({
        type: 'warning',
        message: `Grace period: ${daysRemaining} days remaining. Please renew to avoid service interruption.`
      });
      break;
    case 'EXPIRED':
      alerts.push({
        type: 'error',
        message: 'Subscription expired. Please renew to restore full access.'
      });
      break;
    case 'SUSPENDED':
      alerts.push({
        type: 'error',
        message: 'Subscription suspended. Please contact support.'
      });
      break;
  }

  // Renewal alerts
  if (subscription.status === 'ACTIVE' && daysRemaining && daysRemaining <= 7) {
    alerts.push({
      type: 'warning',
      message: `Subscription renews in ${daysRemaining} days`
    });
  }

  // Usage alerts
  if (usage) {
    if (usage.usersQuotaPercent >= 90) {
      alerts.push({
        type: 'warning',
        message: `User quota at ${usage.usersQuotaPercent.toFixed(0)}%. Consider upgrading.`
      });
    }
    if (usage.storageQuotaPercent >= 90) {
      alerts.push({
        type: 'warning',
        message: `Storage quota at ${usage.storageQuotaPercent.toFixed(0)}%. Consider upgrading.`
      });
    }
  }

  return alerts;
}

module.exports = {
  // Payment requests
  getPaymentRequests,
  getPaymentRequestById,
  approvePaymentRequest,
  rejectPaymentRequest,
  completePayment,

  // Subscription status
  getSubscriptionStatus,
  renewSubscription,
  cancelSubscription,

  // Features
  getEnabledFeatures,
  getAvailablePlans
};
