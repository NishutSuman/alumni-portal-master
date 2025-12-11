// ==========================================
// SUBSCRIPTION MANAGEMENT SERVICE
// File: apm-server/src/services/subscription/SubscriptionService.js
// Handles subscription lifecycle, plans, and billing
// ==========================================

const { PrismaClient } = require('@prisma/client');
const { CacheService } = require('../../config/redis');

const prisma = new PrismaClient();

class SubscriptionService {

  // ==========================================
  // SUBSCRIPTION PLAN MANAGEMENT (Developer)
  // ==========================================

  /**
   * Get all subscription plans
   */
  static async getAllPlans(includeInactive = false) {
    const cacheKey = `subscription:plans:${includeInactive}`;
    let plans = await CacheService.get(cacheKey);

    if (!plans) {
      plans = await prisma.subscriptionPlan.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          featureOverrides: {
            include: {
              feature: {
                select: { code: true, name: true, category: true }
              }
            }
          }
        }
      });

      await CacheService.set(cacheKey, plans, 3600); // 1 hour cache
    }

    return plans;
  }

  /**
   * Get plan by ID or code
   */
  static async getPlan(planIdOrCode) {
    return await prisma.subscriptionPlan.findFirst({
      where: {
        OR: [
          { id: planIdOrCode },
          { code: planIdOrCode }
        ]
      },
      include: {
        featureOverrides: {
          include: {
            feature: true
          }
        }
      }
    });
  }

  /**
   * Create a new subscription plan (Developer only)
   */
  static async createPlan(planData, createdBy) {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: planData.name,
        code: planData.code.toUpperCase(),
        description: planData.description,
        priceMonthly: planData.priceMonthly,
        priceYearly: planData.priceYearly,
        currency: planData.currency || 'INR',
        maxUsers: planData.maxUsers || 100,
        maxStorageMB: planData.maxStorageMB || 5120,
        maxEventsPerMonth: planData.maxEventsPerMonth || 10,
        maxPostsPerMonth: planData.maxPostsPerMonth || 50,
        maxEmailsPerMonth: planData.maxEmailsPerMonth || 1000,
        maxPushPerMonth: planData.maxPushPerMonth || 5000,
        trialDays: planData.trialDays || 14,
        gracePeriodDays: planData.gracePeriodDays || 7,
        supportLevel: planData.supportLevel || 'email',
        supportResponseHrs: planData.supportResponseHrs || 48,
        includedFeatures: planData.includedFeatures || [],
        isPopular: planData.isPopular || false,
        sortOrder: planData.sortOrder || 0
      }
    });

    // Clear plans cache
    await CacheService.delPattern('subscription:plans:*');

    // Log audit
    await this.logAudit(null, 'PLAN_CREATED', {
      planId: plan.id,
      planCode: plan.code
    }, createdBy, 'DEVELOPER');

    return plan;
  }

  /**
   * Update subscription plan
   */
  static async updatePlan(planId, planData, updatedBy) {
    const plan = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: planData
    });

    // Clear plans cache
    await CacheService.delPattern('subscription:plans:*');

    return plan;
  }

  /**
   * Set features for a plan
   */
  static async setPlanFeatures(planId, featureOverrides, updatedBy) {
    // Delete existing overrides
    await prisma.planFeatureOverride.deleteMany({
      where: { planId }
    });

    // Create new overrides
    if (featureOverrides && featureOverrides.length > 0) {
      await prisma.planFeatureOverride.createMany({
        data: featureOverrides.map(override => ({
          planId,
          featureId: override.featureId,
          isEnabled: override.isEnabled ?? true,
          limit: override.limit,
          limitType: override.limitType
        }))
      });
    }

    // Clear cache
    await CacheService.delPattern('subscription:plans:*');

    return await this.getPlan(planId);
  }

  // ==========================================
  // ORGANIZATION SUBSCRIPTION MANAGEMENT
  // ==========================================

  /**
   * Get organization's subscription
   */
  static async getOrganizationSubscription(organizationId) {
    const cacheKey = `subscription:org:${organizationId}`;
    let subscription = await CacheService.get(cacheKey);

    if (!subscription) {
      subscription = await prisma.organizationSubscription.findUnique({
        where: { organizationId },
        include: {
          plan: {
            include: {
              featureOverrides: {
                include: { feature: true }
              }
            }
          },
          organization: {
            select: { id: true, name: true, tenantCode: true }
          }
        }
      });

      if (subscription) {
        await CacheService.set(cacheKey, subscription, 300); // 5 min cache
      }
    }

    return subscription;
  }

  /**
   * Create subscription for organization (usually after org creation)
   */
  static async createSubscription(organizationId, planId, options = {}) {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error('Subscription plan not found');
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (plan.trialDays * 24 * 60 * 60 * 1000));

    const subscription = await prisma.organizationSubscription.create({
      data: {
        organizationId,
        planId: plan.id,
        status: 'TRIAL',
        billingCycle: options.billingCycle || 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        autoRenew: options.autoRenew ?? true,
        customMaxUsers: options.customMaxUsers,
        customMaxStorageMB: options.customMaxStorageMB
      },
      include: {
        plan: true,
        organization: true
      }
    });

    // Update organization's subscription status
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: 'TRIAL',
        subscriptionStartAt: now,
        subscriptionEndsAt: trialEndsAt,
        maxUsers: options.customMaxUsers || plan.maxUsers,
        storageQuotaMB: options.customMaxStorageMB || plan.maxStorageMB
      }
    });

    // Initialize default features based on plan
    await this.initializeOrganizationFeatures(organizationId, plan);

    // Log audit
    await this.logAudit(organizationId, 'SUBSCRIPTION_CREATED', {
      planId: plan.id,
      planCode: plan.code,
      trialEndsAt
    }, options.createdBy, options.createdByRole || 'DEVELOPER');

    // Clear cache
    await CacheService.del(`subscription:org:${organizationId}`);

    return subscription;
  }

  /**
   * Activate subscription after payment
   */
  static async activateSubscription(organizationId, paymentDetails, activatedBy) {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const plan = subscription.plan;
    const now = new Date();
    let periodEnd;

    // Calculate period end based on billing cycle
    switch (subscription.billingCycle) {
      case 'MONTHLY':
        periodEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        break;
      case 'QUARTERLY':
        periodEnd = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
        break;
      case 'YEARLY':
        periodEnd = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000));
        break;
      default:
        periodEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    }

    const previousStatus = subscription.status;

    // Update subscription
    const updated = await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        lastPaymentId: paymentDetails.transactionId,
        lastPaymentAmount: paymentDetails.amount,
        lastPaymentDate: now,
        nextBillingDate: periodEnd,
        renewalReminderSent: false
      }
    });

    // Update organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: periodEnd,
        isMaintenanceMode: false
      }
    });

    // Log audit
    await this.logAudit(organizationId, 'SUBSCRIPTION_ACTIVATED', {
      previousStatus,
      paymentId: paymentDetails.transactionId,
      amount: paymentDetails.amount,
      periodEnd
    }, activatedBy, 'SUPER_ADMIN');

    // Clear cache
    await CacheService.del(`subscription:org:${organizationId}`);
    await CacheService.delPattern(`tenant:${subscription.organization?.tenantCode}:*`);

    return updated;
  }

  /**
   * Renew subscription
   */
  static async renewSubscription(organizationId, paymentDetails, renewedBy) {
    return await this.activateSubscription(organizationId, paymentDetails, renewedBy);
  }

  /**
   * Upgrade/Downgrade subscription plan
   */
  static async changePlan(organizationId, newPlanId, changedBy, changedByRole) {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newPlan = await this.getPlan(newPlanId);
    if (!newPlan) {
      throw new Error('New plan not found');
    }

    const previousPlanId = subscription.planId;
    const isUpgrade = newPlan.priceMonthly > subscription.plan.priceMonthly;

    // Update subscription
    const updated = await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        planId: newPlanId,
        customMaxUsers: null, // Reset custom limits
        customMaxStorageMB: null
      }
    });

    // Update organization limits
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        maxUsers: newPlan.maxUsers,
        storageQuotaMB: newPlan.maxStorageMB
      }
    });

    // Update features
    await this.initializeOrganizationFeatures(organizationId, newPlan);

    // Log audit
    await this.logAudit(organizationId, isUpgrade ? 'SUBSCRIPTION_UPGRADED' : 'SUBSCRIPTION_DOWNGRADED', {
      previousPlanId,
      newPlanId,
      previousPlanCode: subscription.plan.code,
      newPlanCode: newPlan.code
    }, changedBy, changedByRole);

    // Clear cache
    await CacheService.del(`subscription:org:${organizationId}`);
    await CacheService.delPattern(`features:org:${organizationId}:*`);

    return updated;
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(organizationId, reason, cancelledBy) {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const previousStatus = subscription.status;

    // Update subscription
    const updated = await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledBy,
        autoRenew: false
      }
    });

    // Update organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: 'CANCELLED'
      }
    });

    // Log audit
    await this.logAudit(organizationId, 'SUBSCRIPTION_CANCELLED', {
      previousStatus,
      reason
    }, cancelledBy, 'SUPER_ADMIN');

    // Clear cache
    await CacheService.del(`subscription:org:${organizationId}`);

    return updated;
  }

  /**
   * Suspend subscription (by developer for non-payment, etc.)
   */
  static async suspendSubscription(organizationId, reason, suspendedBy) {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const previousStatus = subscription.status;

    // Update subscription
    const updated = await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'SUSPENDED'
      }
    });

    // Update organization - put in maintenance mode
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: 'SUSPENDED',
        isMaintenanceMode: true,
        maintenanceMessage: reason || 'Your subscription has been suspended. Please contact support.'
      }
    });

    // Log audit
    await this.logAudit(organizationId, 'SUBSCRIPTION_SUSPENDED', {
      previousStatus,
      reason
    }, suspendedBy, 'DEVELOPER');

    // Clear cache
    await CacheService.del(`subscription:org:${organizationId}`);

    return updated;
  }

  /**
   * Reactivate suspended subscription
   */
  static async reactivateSubscription(organizationId, reactivatedBy, reactivatedByRole) {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.status !== 'SUSPENDED') {
      throw new Error('Only suspended subscriptions can be reactivated');
    }

    // Check if subscription period is still valid
    const now = new Date();
    let newStatus = 'ACTIVE';

    if (subscription.currentPeriodEnd < now) {
      // Period expired while suspended
      newStatus = 'EXPIRED';
    }

    // Update subscription
    const updated = await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        status: newStatus
      }
    });

    // Update organization
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: newStatus,
        isMaintenanceMode: false,
        maintenanceMessage: null
      }
    });

    // Log audit
    await this.logAudit(organizationId, 'SUBSCRIPTION_REACTIVATED', {
      previousStatus: 'SUSPENDED',
      newStatus
    }, reactivatedBy, reactivatedByRole);

    // Clear cache
    await CacheService.del(`subscription:org:${organizationId}`);

    return updated;
  }

  // ==========================================
  // SUBSCRIPTION STATUS CHECKS
  // ==========================================

  /**
   * Check and update expired subscriptions (run as cron job)
   */
  static async checkExpiredSubscriptions() {
    const now = new Date();

    // Find subscriptions that have expired
    const expiredSubscriptions = await prisma.organizationSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        currentPeriodEnd: { lt: now }
      },
      include: {
        organization: true,
        plan: true
      }
    });

    const results = {
      processed: 0,
      expired: 0,
      gracePeriod: 0,
      errors: []
    };

    for (const sub of expiredSubscriptions) {
      try {
        results.processed++;

        // Check if grace period applies
        const gracePeriodEnd = new Date(sub.currentPeriodEnd.getTime() +
          (sub.plan.gracePeriodDays * 24 * 60 * 60 * 1000));

        if (gracePeriodEnd > now) {
          // Enter grace period
          await prisma.organizationSubscription.update({
            where: { id: sub.id },
            data: {
              status: 'GRACE_PERIOD',
              gracePeriodEndsAt: gracePeriodEnd
            }
          });

          await prisma.organization.update({
            where: { id: sub.organizationId },
            data: {
              subscriptionStatus: 'GRACE_PERIOD'
            }
          });

          results.gracePeriod++;

          // Log audit
          await this.logAudit(sub.organizationId, 'SUBSCRIPTION_GRACE_PERIOD', {
            previousStatus: sub.status,
            gracePeriodEndsAt: gracePeriodEnd
          }, null, 'SYSTEM');
        } else {
          // Expired
          await prisma.organizationSubscription.update({
            where: { id: sub.id },
            data: {
              status: 'EXPIRED'
            }
          });

          await prisma.organization.update({
            where: { id: sub.organizationId },
            data: {
              subscriptionStatus: 'EXPIRED',
              isMaintenanceMode: true,
              maintenanceMessage: 'Your subscription has expired. Please renew to continue using the platform.'
            }
          });

          results.expired++;

          // Log audit
          await this.logAudit(sub.organizationId, 'SUBSCRIPTION_EXPIRED', {
            previousStatus: sub.status
          }, null, 'SYSTEM');
        }

        // Clear cache
        await CacheService.del(`subscription:org:${sub.organizationId}`);

      } catch (error) {
        results.errors.push({
          organizationId: sub.organizationId,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Check grace period expirations
   */
  static async checkGracePeriodExpirations() {
    const now = new Date();

    const expiredGracePeriod = await prisma.organizationSubscription.findMany({
      where: {
        status: 'GRACE_PERIOD',
        gracePeriodEndsAt: { lt: now }
      },
      include: { organization: true }
    });

    for (const sub of expiredGracePeriod) {
      await prisma.organizationSubscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' }
      });

      await prisma.organization.update({
        where: { id: sub.organizationId },
        data: {
          subscriptionStatus: 'EXPIRED',
          isMaintenanceMode: true,
          maintenanceMessage: 'Your subscription has expired. Please renew to continue.'
        }
      });

      await this.logAudit(sub.organizationId, 'SUBSCRIPTION_EXPIRED', {
        previousStatus: 'GRACE_PERIOD'
      }, null, 'SYSTEM');

      await CacheService.del(`subscription:org:${sub.organizationId}`);
    }

    return { expired: expiredGracePeriod.length };
  }

  // ==========================================
  // FEATURE INITIALIZATION
  // ==========================================

  /**
   * Initialize organization features based on plan
   */
  static async initializeOrganizationFeatures(organizationId, plan) {
    // Get all features
    const allFeatures = await prisma.feature.findMany({
      where: { isActive: true }
    });

    // Get plan feature overrides
    const planOverrides = await prisma.planFeatureOverride.findMany({
      where: { planId: plan.id }
    });

    const planOverrideMap = new Map(
      planOverrides.map(o => [o.featureId, o])
    );

    // Delete existing org features
    await prisma.organizationFeature.deleteMany({
      where: { organizationId }
    });

    // Create org features based on plan
    const orgFeatures = allFeatures.map(feature => {
      const override = planOverrideMap.get(feature.id);
      const isIncluded = plan.includedFeatures.includes(feature.code) ||
                        feature.isCore ||
                        (override && override.isEnabled);

      return {
        organizationId,
        featureId: feature.id,
        isEnabled: isIncluded,
        enabledAt: isIncluded ? new Date() : null,
        customLimit: override?.limit,
        customLimitType: override?.limitType
      };
    });

    await prisma.organizationFeature.createMany({
      data: orgFeatures
    });

    // Clear feature cache
    await CacheService.delPattern(`features:org:${organizationId}:*`);
  }

  // ==========================================
  // PAYMENT REQUEST WORKFLOW
  // ==========================================

  /**
   * Create payment request (Developer -> Super Admin)
   */
  static async createPaymentRequest(subscriptionId, requestData, requestedBy) {
    const subscription = await prisma.organizationSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, organization: true }
    });

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Calculate amount based on request type
    let amount = requestData.amount;
    if (!amount) {
      if (requestData.requestType === 'RENEWAL') {
        amount = requestData.billingCycle === 'YEARLY'
          ? subscription.plan.priceYearly
          : subscription.plan.priceMonthly;
      } else if (requestData.requestType === 'UPGRADE' && requestData.requestedPlanId) {
        const newPlan = await this.getPlan(requestData.requestedPlanId);
        amount = requestData.billingCycle === 'YEARLY'
          ? newPlan.priceYearly
          : newPlan.priceMonthly;
      }
    }

    // Set expiry (default 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (requestData.expiryDays || 7));

    const paymentRequest = await prisma.subscriptionPaymentRequest.create({
      data: {
        subscriptionId,
        requestType: requestData.requestType,
        requestedPlanId: requestData.requestedPlanId,
        requestedAddOns: requestData.requestedAddOns || [],
        amount,
        currency: requestData.currency || 'INR',
        billingCycle: requestData.billingCycle || subscription.billingCycle,
        requestedBy,
        requestNote: requestData.note,
        expiresAt
      },
      include: {
        subscription: {
          include: {
            organization: true,
            plan: true
          }
        }
      }
    });

    // TODO: Send notification to Super Admin
    // await NotificationService.notifySuperAdmin(...)

    return paymentRequest;
  }

  /**
   * Get pending payment requests for organization
   */
  static async getPendingPaymentRequests(organizationId) {
    const subscription = await prisma.organizationSubscription.findUnique({
      where: { organizationId }
    });

    if (!subscription) {
      return [];
    }

    return await prisma.subscriptionPaymentRequest.findMany({
      where: {
        subscriptionId: subscription.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Approve payment request (Super Admin)
   */
  static async approvePaymentRequest(requestId, respondedBy, responseNote) {
    const request = await prisma.subscriptionPaymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        respondedBy,
        respondedAt: new Date(),
        responseNote
      },
      include: {
        subscription: {
          include: { organization: true }
        }
      }
    });

    // TODO: Redirect to payment gateway or generate payment link

    return request;
  }

  /**
   * Mark payment request as paid
   */
  static async markPaymentRequestPaid(requestId, paymentDetails, paidBy) {
    const request = await prisma.subscriptionPaymentRequest.findUnique({
      where: { id: requestId },
      include: {
        subscription: {
          include: { organization: true, plan: true }
        }
      }
    });

    if (!request) {
      throw new Error('Payment request not found');
    }

    // Update request
    await prisma.subscriptionPaymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'PAID',
        paymentTransactionId: paymentDetails.transactionId,
        paidAmount: paymentDetails.amount,
        paidAt: new Date(),
        invoiceUrl: paymentDetails.invoiceUrl
      }
    });

    // Process based on request type
    const organizationId = request.subscription.organizationId;

    switch (request.requestType) {
      case 'RENEWAL':
        await this.activateSubscription(organizationId, paymentDetails, paidBy);
        break;
      case 'UPGRADE':
        if (request.requestedPlanId) {
          await this.changePlan(organizationId, request.requestedPlanId, paidBy, 'SUPER_ADMIN');
        }
        await this.activateSubscription(organizationId, paymentDetails, paidBy);
        break;
      // Handle other types...
    }

    return request;
  }

  /**
   * Reject payment request
   */
  static async rejectPaymentRequest(requestId, respondedBy, responseNote) {
    return await prisma.subscriptionPaymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        respondedBy,
        respondedAt: new Date(),
        responseNote
      }
    });
  }

  // ==========================================
  // AUDIT LOGGING
  // ==========================================

  /**
   * Log subscription audit event
   */
  static async logAudit(organizationId, eventType, eventDetails, performedBy, performedByRole) {
    try {
      await prisma.subscriptionAuditLog.create({
        data: {
          organizationId: organizationId || 'SYSTEM',
          eventType,
          eventDetails,
          previousStatus: eventDetails.previousStatus,
          newStatus: eventDetails.newStatus,
          previousPlanId: eventDetails.previousPlanId,
          newPlanId: eventDetails.newPlanId,
          performedBy,
          performedByRole
        }
      });
    } catch (error) {
      console.error('Failed to log subscription audit:', error);
    }
  }

  // ==========================================
  // USAGE TRACKING
  // ==========================================

  /**
   * Record usage metrics for organization
   */
  static async recordUsage(organizationId, metrics) {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription) return;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Upsert usage record
    await prisma.organizationUsage.upsert({
      where: {
        subscriptionId_periodStart_periodType: {
          subscriptionId: subscription.id,
          periodStart,
          periodType: 'monthly'
        }
      },
      create: {
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        periodType: 'monthly',
        ...metrics
      },
      update: metrics
    });
  }

  /**
   * Get usage for organization
   */
  static async getUsage(organizationId, periodType = 'monthly') {
    const subscription = await this.getOrganizationSubscription(organizationId);
    if (!subscription) return null;

    const now = new Date();
    let periodStart;

    switch (periodType) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        periodStart = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return await prisma.organizationUsage.findFirst({
      where: {
        subscriptionId: subscription.id,
        periodStart,
        periodType
      }
    });
  }
}

module.exports = SubscriptionService;
