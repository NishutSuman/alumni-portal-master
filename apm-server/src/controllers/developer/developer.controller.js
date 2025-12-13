// src/controllers/developer/developer.controller.js
// Developer Portal Controller - For managing multi-tenant organizations

const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');
const crypto = require('crypto');
const SubscriptionService = require('../../services/subscription/SubscriptionService');
const FeatureService = require('../../services/subscription/FeatureService');
const { cloudflareR2Service } = require('../../services/cloudflare-r2.service');

// ==========================================
// ORGANIZATION/TENANT MANAGEMENT
// ==========================================

/**
 * Get all organizations (tenants)
 * GET /api/developer/organizations
 * Access: DEVELOPER only
 */
const getAllOrganizations = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const { skip } = getPaginationParams(req.query, 20);

    const whereClause = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
        { tenantCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      whereClause.subscriptionStatus = status;
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          shortName: true,
          tenantCode: true,
          isActive: true,
          subscriptionStatus: true,
          subscriptionStartAt: true,
          subscriptionEndsAt: true,
          isMaintenanceMode: true,
          maintenanceMessage: true,
          maxUsers: true,
          storageQuotaMB: true,
          logoUrl: true,
          officialEmail: true,
          officialContactNumber: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true,
              events: true,
              posts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.organization.count({ where: whereClause }),
    ]);

    const pagination = calculatePagination(total, page, limit);

    // Add proxy URL for logos since R2 URLs are not publicly accessible
    const orgsWithProxyUrls = organizations.map(org => ({
      ...org,
      logoProxyUrl: org.logoUrl ? `/api/organizations/${org.id}/files/logo` : null
    }));

    return paginatedResponse(res, orgsWithProxyUrls, pagination, 'Organizations retrieved successfully');
  } catch (error) {
    console.error('Get all organizations error:', error);
    return errorResponse(res, 'Failed to retrieve organizations', 500);
  }
};

/**
 * Get single organization details
 * GET /api/developer/organizations/:orgId
 * Access: DEVELOPER only
 */
const getOrganizationById = async (req, res) => {
  try {
    const { orgId } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            users: true,
            events: true,
            posts: true,
            albums: true,
            photos: true,
            transactions: true,
            notifications: true,
            groups: true,
            sponsors: true,
            polls: true,
            tickets: true,
          },
        },
      },
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    return successResponse(res, { organization }, 'Organization retrieved successfully');
  } catch (error) {
    console.error('Get organization by ID error:', error);
    return errorResponse(res, 'Failed to retrieve organization', 500);
  }
};

/**
 * Create new organization (tenant)
 * POST /api/developer/organizations
 * Access: DEVELOPER only
 */
const createOrganization = async (req, res) => {
  try {
    const {
      name,
      shortName,
      tenantCode,
      officialEmail,
      officialContactNumber,
      officeAddress,
      foundationYear,
      description,
      mission,
      vision,
      subscriptionStatus = 'TRIAL',
      subscriptionDays = 30,
      maxUsers = 500,
      storageQuotaMB = 5120,
    } = req.body;

    // Validate required fields
    if (!name || !shortName || !tenantCode || !officialEmail || !foundationYear) {
      return errorResponse(res, 'Name, short name, tenant code, official email, and foundation year are required', 400);
    }

    // Validate tenant code format (alphanumeric, hyphens allowed)
    const tenantCodeRegex = /^[A-Z0-9-]+$/;
    if (!tenantCodeRegex.test(tenantCode.toUpperCase())) {
      return errorResponse(res, 'Tenant code must be alphanumeric with optional hyphens', 400);
    }

    // Check if tenant code already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { tenantCode: tenantCode.toUpperCase() },
    });

    if (existingOrg) {
      return errorResponse(res, 'Tenant code already exists', 409);
    }

    // Calculate subscription dates
    const subscriptionStartAt = new Date();
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + parseInt(subscriptionDays));

    const organization = await prisma.organization.create({
      data: {
        name,
        shortName,
        tenantCode: tenantCode.toUpperCase(),
        officialEmail,
        officialContactNumber: officialContactNumber || null,
        officeAddress: officeAddress || null,
        foundationYear: parseInt(foundationYear),
        description: description || null,
        mission: mission || null,
        vision: vision || null,
        isActive: true,
        subscriptionStatus,
        subscriptionStartAt,
        subscriptionEndsAt,
        maxUsers: parseInt(maxUsers),
        storageQuotaMB: parseInt(storageQuotaMB),
      },
    });

    // No activity logging for developer operations - bypassed for simplicity

    return successResponse(res, { organization }, 'Organization created successfully', 201);
  } catch (error) {
    console.error('Create organization error:', error);
    return errorResponse(res, 'Failed to create organization', 500);
  }
};

/**
 * Update organization details
 * PUT /api/developer/organizations/:orgId
 * Access: DEVELOPER only
 */
const updateOrganization = async (req, res) => {
  try {
    const { orgId } = req.params;
    const updates = req.body;

    // Check if organization exists
    const existingOrg = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!existingOrg) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // If updating tenant code, check for uniqueness
    if (updates.tenantCode && updates.tenantCode !== existingOrg.tenantCode) {
      const codeExists = await prisma.organization.findFirst({
        where: {
          tenantCode: updates.tenantCode.toUpperCase(),
          NOT: { id: orgId },
        },
      });

      if (codeExists) {
        return errorResponse(res, 'Tenant code already exists', 409);
      }

      updates.tenantCode = updates.tenantCode.toUpperCase();
    }

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: updates,
    });

    // No activity logging for developer operations - bypassed for simplicity

    return successResponse(res, { organization }, 'Organization updated successfully');
  } catch (error) {
    console.error('Update organization error:', error);
    return errorResponse(res, 'Failed to update organization', 500);
  }
};

/**
 * Toggle maintenance mode for organization
 * POST /api/developer/organizations/:orgId/maintenance
 * Access: DEVELOPER only
 */
const toggleMaintenanceMode = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { isMaintenanceMode, maintenanceMessage } = req.body;

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: {
        isMaintenanceMode: Boolean(isMaintenanceMode),
        maintenanceMessage: maintenanceMessage || null,
      },
    });

    // No activity logging for developer operations - bypassed for simplicity

    return successResponse(
      res,
      { organization },
      `Maintenance mode ${isMaintenanceMode ? 'enabled' : 'disabled'} successfully`
    );
  } catch (error) {
    console.error('Toggle maintenance mode error:', error);
    return errorResponse(res, 'Failed to toggle maintenance mode', 500);
  }
};

/**
 * Update subscription status
 * POST /api/developer/organizations/:orgId/subscription
 * Access: DEVELOPER only
 */
const updateSubscription = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { subscriptionStatus, subscriptionDays, maxUsers, storageQuotaMB } = req.body;

    const updateData = {};

    if (subscriptionStatus) {
      updateData.subscriptionStatus = subscriptionStatus;
    }

    if (subscriptionDays) {
      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + parseInt(subscriptionDays));
      updateData.subscriptionEndsAt = subscriptionEndsAt;

      // If status is not active, set start date too
      if (subscriptionStatus === 'ACTIVE') {
        updateData.subscriptionStartAt = new Date();
      }
    }

    if (maxUsers) {
      updateData.maxUsers = parseInt(maxUsers);
    }

    if (storageQuotaMB) {
      updateData.storageQuotaMB = parseInt(storageQuotaMB);
    }

    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
    });

    // No activity logging for developer operations - bypassed for simplicity

    return successResponse(res, { organization }, 'Subscription updated successfully');
  } catch (error) {
    console.error('Update subscription error:', error);
    return errorResponse(res, 'Failed to update subscription', 500);
  }
};

// ==========================================
// ORGANIZATION STATISTICS
// ==========================================

/**
 * Get organization statistics
 * GET /api/developer/organizations/:orgId/stats
 * Access: DEVELOPER only
 */
const getOrganizationStats = async (req, res) => {
  try {
    const { orgId } = req.params;

    const [
      userStats,
      contentStats,
      activityStats,
    ] = await Promise.all([
      // User statistics
      prisma.user.groupBy({
        by: ['role'],
        where: { organizationId: orgId },
        _count: true,
      }),

      // Content statistics
      Promise.all([
        prisma.post.count({ where: { organizationId: orgId } }),
        prisma.event.count({ where: { organizationId: orgId } }),
        prisma.album.count({ where: { organizationId: orgId } }),
        prisma.photo.count({ where: { organizationId: orgId } }),
        prisma.poll.count({ where: { organizationId: orgId } }),
      ]),

      // Recent activity
      prisma.activityLog.findMany({
        where: {
          user: { organizationId: orgId },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          action: true,
          details: true,
          createdAt: true,
          user: {
            select: {
              fullName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const stats = {
      users: {
        byRole: userStats,
        total: userStats.reduce((sum, r) => sum + r._count, 0),
      },
      content: {
        posts: contentStats[0],
        events: contentStats[1],
        albums: contentStats[2],
        photos: contentStats[3],
        polls: contentStats[4],
      },
      recentActivity: activityStats,
    };

    return successResponse(res, { stats }, 'Organization statistics retrieved successfully');
  } catch (error) {
    console.error('Get organization stats error:', error);
    return errorResponse(res, 'Failed to retrieve organization statistics', 500);
  }
};

// ==========================================
// DEVELOPER DASHBOARD
// ==========================================

/**
 * Get developer dashboard overview
 * GET /api/developer/dashboard
 * Access: DEVELOPER only
 */
const getDeveloperDashboard = async (req, res) => {
  try {
    const [
      orgStats,
      subscriptionBreakdown,
      recentOrgs,
      systemHealth,
    ] = await Promise.all([
      // Organization statistics
      Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { isActive: true } }),
        prisma.organization.count({ where: { isMaintenanceMode: true } }),
      ]),

      // Subscription breakdown
      prisma.organization.groupBy({
        by: ['subscriptionStatus'],
        _count: true,
      }),

      // Recent organizations
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          shortName: true,
          tenantCode: true,
          subscriptionStatus: true,
          createdAt: true,
          _count: {
            select: { users: true },
          },
        },
      }),

      // System health check
      Promise.all([
        prisma.user.count(),
        prisma.post.count(),
        prisma.event.count(),
      ]),
    ]);

    const dashboard = {
      organizations: {
        total: orgStats[0],
        active: orgStats[1],
        inMaintenance: orgStats[2],
      },
      subscriptions: subscriptionBreakdown.reduce((acc, s) => {
        acc[s.subscriptionStatus] = s._count;
        return acc;
      }, {}),
      recentOrganizations: recentOrgs,
      systemTotals: {
        users: systemHealth[0],
        posts: systemHealth[1],
        events: systemHealth[2],
      },
    };

    return successResponse(res, { dashboard }, 'Developer dashboard retrieved successfully');
  } catch (error) {
    console.error('Get developer dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve developer dashboard', 500);
  }
};

// ==========================================
// SWITCH TENANT CONTEXT (DEV WORK MODE)
// ==========================================

/**
 * Switch to organization context for development
 * POST /api/developer/switch-tenant
 * Access: DEVELOPER only
 */
const switchTenantContext = async (req, res) => {
  try {
    const { tenantCode } = req.body;

    if (!tenantCode) {
      return errorResponse(res, 'Tenant code is required', 400);
    }

    const organization = await prisma.organization.findFirst({
      where: { tenantCode: tenantCode.toUpperCase() },
      select: {
        id: true,
        name: true,
        shortName: true,
        tenantCode: true,
        subscriptionStatus: true,
        isActive: true,
      },
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // No activity logging for developer operations - bypassed for simplicity

    return successResponse(
      res,
      { organization },
      `Switched to ${organization.name} context successfully`
    );
  } catch (error) {
    console.error('Switch tenant context error:', error);
    return errorResponse(res, 'Failed to switch tenant context', 500);
  }
};

// ==========================================
// SUBSCRIPTION PLAN MANAGEMENT
// ==========================================

/**
 * Get all subscription plans
 * GET /api/developer/plans
 * Access: DEVELOPER only
 */
const getAllPlans = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const plans = await SubscriptionService.getAllPlans(includeInactive === 'true');

    return successResponse(res, { plans }, 'Subscription plans retrieved successfully');
  } catch (error) {
    console.error('Get all plans error:', error);
    return errorResponse(res, 'Failed to retrieve subscription plans', 500);
  }
};

/**
 * Get single plan details
 * GET /api/developer/plans/:planId
 * Access: DEVELOPER only
 */
const getPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await SubscriptionService.getPlan(planId);

    if (!plan) {
      return errorResponse(res, 'Subscription plan not found', 404);
    }

    return successResponse(res, { plan }, 'Subscription plan retrieved successfully');
  } catch (error) {
    console.error('Get plan by ID error:', error);
    return errorResponse(res, 'Failed to retrieve subscription plan', 500);
  }
};

/**
 * Create new subscription plan
 * POST /api/developer/plans
 * Access: DEVELOPER only
 */
const createPlan = async (req, res) => {
  try {
    const planData = req.body;

    // Validate required fields
    if (!planData.name || !planData.code || !planData.priceMonthly || !planData.priceYearly) {
      return errorResponse(res, 'Name, code, monthly price, and yearly price are required', 400);
    }

    const plan = await SubscriptionService.createPlan(planData, req.user.id);

    return successResponse(res, { plan }, 'Subscription plan created successfully', 201);
  } catch (error) {
    console.error('Create plan error:', error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'Plan name or code already exists', 409);
    }
    return errorResponse(res, 'Failed to create subscription plan', 500);
  }
};

/**
 * Update subscription plan
 * PUT /api/developer/plans/:planId
 * Access: DEVELOPER only
 */
const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const planData = req.body;

    const plan = await SubscriptionService.updatePlan(planId, planData, req.user.id);

    return successResponse(res, { plan }, 'Subscription plan updated successfully');
  } catch (error) {
    console.error('Update plan error:', error);
    return errorResponse(res, 'Failed to update subscription plan', 500);
  }
};

/**
 * Set features for a plan
 * POST /api/developer/plans/:planId/features
 * Access: DEVELOPER only
 */
const setPlanFeatures = async (req, res) => {
  try {
    const { planId } = req.params;
    const { featureOverrides } = req.body;

    const plan = await SubscriptionService.setPlanFeatures(planId, featureOverrides, req.user.id);

    return successResponse(res, { plan }, 'Plan features updated successfully');
  } catch (error) {
    console.error('Set plan features error:', error);
    return errorResponse(res, 'Failed to update plan features', 500);
  }
};

// ==========================================
// FEATURE CATALOG MANAGEMENT
// ==========================================

/**
 * Get all features
 * GET /api/developer/features
 * Access: DEVELOPER only
 */
const getAllFeatures = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const features = await FeatureService.getAllFeatures(includeInactive === 'true');

    return successResponse(res, { features }, 'Features retrieved successfully');
  } catch (error) {
    console.error('Get all features error:', error);
    return errorResponse(res, 'Failed to retrieve features', 500);
  }
};

/**
 * Create new feature
 * POST /api/developer/features
 * Access: DEVELOPER only
 */
const createFeature = async (req, res) => {
  try {
    const featureData = req.body;

    if (!featureData.code || !featureData.name || !featureData.category) {
      return errorResponse(res, 'Code, name, and category are required', 400);
    }

    const feature = await FeatureService.createFeature(featureData);

    return successResponse(res, { feature }, 'Feature created successfully', 201);
  } catch (error) {
    console.error('Create feature error:', error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'Feature code already exists', 409);
    }
    return errorResponse(res, 'Failed to create feature', 500);
  }
};

/**
 * Update feature
 * PUT /api/developer/features/:featureId
 * Access: DEVELOPER only
 */
const updateFeature = async (req, res) => {
  try {
    const { featureId } = req.params;
    const featureData = req.body;

    const feature = await FeatureService.updateFeature(featureId, featureData);

    return successResponse(res, { feature }, 'Feature updated successfully');
  } catch (error) {
    console.error('Update feature error:', error);
    return errorResponse(res, 'Failed to update feature', 500);
  }
};

/**
 * Seed default features
 * POST /api/developer/features/seed
 * Access: DEVELOPER only
 */
const seedFeatures = async (req, res) => {
  try {
    const result = await FeatureService.seedDefaultFeatures();

    return successResponse(res, { result }, `Features seeded: ${result.created} created, ${result.existing} already existed`);
  } catch (error) {
    console.error('Seed features error:', error);
    return errorResponse(res, 'Failed to seed features', 500);
  }
};

/**
 * Get feature matrix (features x plans)
 * GET /api/developer/features/matrix
 * Access: DEVELOPER only
 */
const getFeatureMatrix = async (req, res) => {
  try {
    const matrix = await FeatureService.getFeatureMatrix();

    return successResponse(res, { matrix }, 'Feature matrix retrieved successfully');
  } catch (error) {
    console.error('Get feature matrix error:', error);
    return errorResponse(res, 'Failed to retrieve feature matrix', 500);
  }
};

// ==========================================
// ORGANIZATION SUBSCRIPTION MANAGEMENT
// ==========================================

/**
 * Get organization subscription details
 * GET /api/developer/organizations/:orgId/subscription-details
 * Access: DEVELOPER only
 */
const getOrganizationSubscriptionDetails = async (req, res) => {
  try {
    const { orgId } = req.params;

    const subscription = await SubscriptionService.getOrganizationSubscription(orgId);
    const features = await FeatureService.getOrganizationFeatures(orgId);

    return successResponse(res, {
      subscription,
      features
    }, 'Subscription details retrieved successfully');
  } catch (error) {
    console.error('Get organization subscription details error:', error);
    return errorResponse(res, 'Failed to retrieve subscription details', 500);
  }
};

/**
 * Create subscription for organization
 * POST /api/developer/organizations/:orgId/subscription
 * Access: DEVELOPER only
 */
const createOrganizationSubscription = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { planId, billingCycle, customMaxUsers, customMaxStorageMB } = req.body;

    if (!planId) {
      return errorResponse(res, 'Plan ID is required', 400);
    }

    const subscription = await SubscriptionService.createSubscription(orgId, planId, {
      billingCycle,
      customMaxUsers,
      customMaxStorageMB,
      createdBy: req.user.id,
      createdByRole: 'DEVELOPER'
    });

    return successResponse(res, { subscription }, 'Subscription created successfully', 201);
  } catch (error) {
    console.error('Create organization subscription error:', error);
    return errorResponse(res, error.message || 'Failed to create subscription', 500);
  }
};

/**
 * Change organization's subscription plan
 * POST /api/developer/organizations/:orgId/change-plan
 * Access: DEVELOPER only
 */
const changeOrganizationPlan = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { newPlanId } = req.body;

    if (!newPlanId) {
      return errorResponse(res, 'New plan ID is required', 400);
    }

    const subscription = await SubscriptionService.changePlan(
      orgId,
      newPlanId,
      req.user.id,
      'DEVELOPER'
    );

    return successResponse(res, { subscription }, 'Plan changed successfully');
  } catch (error) {
    console.error('Change organization plan error:', error);
    return errorResponse(res, error.message || 'Failed to change plan', 500);
  }
};

/**
 * Suspend organization subscription
 * POST /api/developer/organizations/:orgId/suspend
 * Access: DEVELOPER only
 */
const suspendOrganization = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { reason } = req.body;

    const subscription = await SubscriptionService.suspendSubscription(
      orgId,
      reason || 'Suspended by developer',
      req.user.id
    );

    return successResponse(res, { subscription }, 'Organization suspended successfully');
  } catch (error) {
    console.error('Suspend organization error:', error);
    return errorResponse(res, error.message || 'Failed to suspend organization', 500);
  }
};

/**
 * Reactivate suspended organization
 * POST /api/developer/organizations/:orgId/reactivate
 * Access: DEVELOPER only
 */
const reactivateOrganization = async (req, res) => {
  try {
    const { orgId } = req.params;

    const subscription = await SubscriptionService.reactivateSubscription(
      orgId,
      req.user.id,
      'DEVELOPER'
    );

    return successResponse(res, { subscription }, 'Organization reactivated successfully');
  } catch (error) {
    console.error('Reactivate organization error:', error);
    return errorResponse(res, error.message || 'Failed to reactivate organization', 500);
  }
};

// ==========================================
// ORGANIZATION FEATURE MANAGEMENT
// ==========================================

/**
 * Get organization features
 * GET /api/developer/organizations/:orgId/features
 * Access: DEVELOPER only
 */
const getOrganizationFeatures = async (req, res) => {
  try {
    const { orgId } = req.params;

    const features = await FeatureService.getOrganizationFeatures(orgId);

    return successResponse(res, { features }, 'Organization features retrieved successfully');
  } catch (error) {
    console.error('Get organization features error:', error);
    return errorResponse(res, 'Failed to retrieve organization features', 500);
  }
};

/**
 * Toggle feature for organization
 * POST /api/developer/organizations/:orgId/features/:featureCode/toggle
 * Access: DEVELOPER only
 */
const toggleOrganizationFeature = async (req, res) => {
  try {
    const { orgId, featureCode } = req.params;
    const { isEnabled } = req.body;

    const result = await FeatureService.toggleFeature(
      orgId,
      featureCode,
      isEnabled,
      req.user.id
    );

    return successResponse(res, { feature: result }, `Feature ${isEnabled ? 'enabled' : 'disabled'} successfully`);
  } catch (error) {
    console.error('Toggle organization feature error:', error);
    return errorResponse(res, error.message || 'Failed to toggle feature', 500);
  }
};

/**
 * Set feature limit for organization
 * POST /api/developer/organizations/:orgId/features/:featureCode/limit
 * Access: DEVELOPER only
 */
const setOrganizationFeatureLimit = async (req, res) => {
  try {
    const { orgId, featureCode } = req.params;
    const { limit, limitType } = req.body;

    const result = await FeatureService.setFeatureLimit(
      orgId,
      featureCode,
      limit,
      limitType,
      req.user.id
    );

    return successResponse(res, { feature: result }, 'Feature limit set successfully');
  } catch (error) {
    console.error('Set organization feature limit error:', error);
    return errorResponse(res, error.message || 'Failed to set feature limit', 500);
  }
};

// ==========================================
// PAYMENT REQUEST MANAGEMENT
// ==========================================

/**
 * Create payment request for organization (Developer -> Super Admin)
 * POST /api/developer/organizations/:orgId/payment-request
 * Access: DEVELOPER only
 */
const createPaymentRequest = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { requestType, requestedPlanId, requestedAddOns, amount, billingCycle, note, expiryDays } = req.body;

    if (!requestType) {
      return errorResponse(res, 'Request type is required', 400);
    }

    // Get subscription
    const subscription = await SubscriptionService.getOrganizationSubscription(orgId);
    if (!subscription) {
      return errorResponse(res, 'Organization subscription not found', 404);
    }

    const paymentRequest = await SubscriptionService.createPaymentRequest(
      subscription.id,
      {
        requestType,
        requestedPlanId,
        requestedAddOns,
        amount,
        billingCycle,
        note,
        expiryDays
      },
      req.user.id
    );

    return successResponse(res, { paymentRequest }, 'Payment request created successfully', 201);
  } catch (error) {
    console.error('Create payment request error:', error);
    return errorResponse(res, error.message || 'Failed to create payment request', 500);
  }
};

/**
 * Get pending payment requests
 * GET /api/developer/payment-requests
 * Access: DEVELOPER only
 */
const getPendingPaymentRequests = async (req, res) => {
  try {
    const requests = await prisma.subscriptionPaymentRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      include: {
        subscription: {
          include: {
            organization: {
              select: { id: true, name: true, tenantCode: true }
            },
            plan: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(res, { requests }, 'Payment requests retrieved successfully');
  } catch (error) {
    console.error('Get pending payment requests error:', error);
    return errorResponse(res, 'Failed to retrieve payment requests', 500);
  }
};

// ==========================================
// SUBSCRIPTION CRON JOBS
// ==========================================

/**
 * Check and process expired subscriptions
 * POST /api/developer/subscriptions/check-expirations
 * Access: DEVELOPER only (usually called by cron)
 */
const checkExpirations = async (req, res) => {
  try {
    const expiredResult = await SubscriptionService.checkExpiredSubscriptions();
    const gracePeriodResult = await SubscriptionService.checkGracePeriodExpirations();

    return successResponse(res, {
      expired: expiredResult,
      gracePeriod: gracePeriodResult
    }, 'Expiration check completed');
  } catch (error) {
    console.error('Check expirations error:', error);
    return errorResponse(res, 'Failed to check expirations', 500);
  }
};

/**
 * Get subscription audit logs
 * GET /api/developer/organizations/:orgId/subscription-audit
 * Access: DEVELOPER only
 */
const getSubscriptionAuditLogs = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      prisma.subscriptionAuditLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.subscriptionAuditLog.count({ where: { organizationId: orgId } })
    ]);

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(res, logs, pagination, 'Audit logs retrieved successfully');
  } catch (error) {
    console.error('Get subscription audit logs error:', error);
    return errorResponse(res, 'Failed to retrieve audit logs', 500);
  }
};

// ==========================================
// ORGANIZATION FILE UPLOAD (Developer Portal)
// ==========================================

/**
 * Upload organization files (logo, bylaw, certificate) for a specific organization
 * POST /api/developer/organizations/:orgId/upload
 * Access: DEVELOPER only
 */
const uploadOrganizationFiles = async (req, res) => {
  try {
    const { orgId } = req.params;
    const files = req.files;

    if (!files || Object.keys(files).length === 0) {
      return errorResponse(res, 'No files provided for upload', 400);
    }

    // Check if Cloudflare R2 is configured
    if (!cloudflareR2Service.isConfigured()) {
      return errorResponse(res, 'File storage (Cloudflare R2) is not configured', 500);
    }

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    const uploadResults = {};
    const updateData = {};

    // Upload logo file
    if (files.logoFile && files.logoFile[0]) {
      const logoFile = files.logoFile[0];
      const validation = cloudflareR2Service.validateOrganizationFile(logoFile, 'logo');

      if (!validation.isValid) {
        return errorResponse(res, `Logo validation failed: ${validation.errors.join(', ')}`, 400);
      }

      // Delete old logo if exists
      if (organization.logoUrl) {
        await cloudflareR2Service.deleteFileByUrl(organization.logoUrl).catch(console.error);
      }

      const logoResult = await cloudflareR2Service.uploadOrganizationLogo(logoFile, organization.tenantCode);
      uploadResults.logo = logoResult;
      updateData.logoUrl = logoResult.url;
    }

    // Upload bylaw file
    if (files.bylawFile && files.bylawFile[0]) {
      const bylawFile = files.bylawFile[0];
      const validation = cloudflareR2Service.validateOrganizationFile(bylawFile, 'bylaw');

      if (!validation.isValid) {
        return errorResponse(res, `Bylaw validation failed: ${validation.errors.join(', ')}`, 400);
      }

      // Delete old bylaw if exists
      if (organization.bylawDocumentUrl) {
        await cloudflareR2Service.deleteFileByUrl(organization.bylawDocumentUrl).catch(console.error);
      }

      const bylawResult = await cloudflareR2Service.uploadOrganizationBylaw(bylawFile, organization.tenantCode);
      uploadResults.bylaw = bylawResult;
      updateData.bylawDocumentUrl = bylawResult.url;
    }

    // Upload certificate file
    if (files.certFile && files.certFile[0]) {
      const certFile = files.certFile[0];
      const validation = cloudflareR2Service.validateOrganizationFile(certFile, 'certificate');

      if (!validation.isValid) {
        return errorResponse(res, `Certificate validation failed: ${validation.errors.join(', ')}`, 400);
      }

      // Delete old certificate if exists
      if (organization.registrationCertUrl) {
        await cloudflareR2Service.deleteFileByUrl(organization.registrationCertUrl).catch(console.error);
      }

      const certResult = await cloudflareR2Service.uploadOrganizationCertificate(certFile, organization.tenantCode);
      uploadResults.certificate = certResult;
      updateData.registrationCertUrl = certResult.url;
    }

    // Update organization with new file URLs
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: updateData
    });

    return successResponse(res, {
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        logoUrl: updatedOrg.logoUrl,
        bylawDocumentUrl: updatedOrg.bylawDocumentUrl,
        registrationCertUrl: updatedOrg.registrationCertUrl
      },
      uploadedFiles: uploadResults
    }, 'Files uploaded successfully');

  } catch (error) {
    console.error('Upload organization files error:', error);
    return errorResponse(res, 'Failed to upload files', 500);
  }
};

/**
 * Delete organization file (logo, bylaw, certificate)
 * DELETE /api/developer/organizations/:orgId/files/:fileType
 * Access: DEVELOPER only
 */
const deleteOrganizationFile = async (req, res) => {
  try {
    const { orgId, fileType } = req.params;

    if (!['logo', 'bylaw', 'certificate'].includes(fileType)) {
      return errorResponse(res, 'Invalid file type. Must be logo, bylaw, or certificate', 400);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    const urlFieldMap = {
      logo: 'logoUrl',
      bylaw: 'bylawDocumentUrl',
      certificate: 'registrationCertUrl'
    };

    const urlField = urlFieldMap[fileType];
    const fileUrl = organization[urlField];

    if (!fileUrl) {
      return errorResponse(res, `No ${fileType} file found to delete`, 404);
    }

    // Delete from R2
    await cloudflareR2Service.deleteFileByUrl(fileUrl).catch(console.error);

    // Update organization
    await prisma.organization.update({
      where: { id: orgId },
      data: { [urlField]: null }
    });

    return successResponse(res, null, `${fileType} file deleted successfully`);

  } catch (error) {
    console.error('Delete organization file error:', error);
    return errorResponse(res, 'Failed to delete file', 500);
  }
};

// ==========================================
// USER MANAGEMENT FOR DEVELOPER PORTAL
// ==========================================

/**
 * Get all users for an organization with pagination and filters
 * GET /api/developer/organizations/:orgId/users
 */
const getOrganizationUsers = async (req, res) => {
  try {
    const { orgId } = req.params;
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const whereClause = {
      organizationId: orgId,
    };

    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (status === 'active') {
      whereClause.isActive = true;
    } else if (status === 'inactive') {
      whereClause.isActive = false;
    } else if (status === 'verified') {
      whereClause.isAlumniVerified = true;
    } else if (status === 'unverified') {
      whereClause.isAlumniVerified = false;
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          batch: true,
          admissionYear: true,
          passoutYear: true,
          serialId: true,
          isActive: true,
          isAlumniVerified: true,
          isEmailVerified: true,
          profileImage: true,
          teacherSubject: true,
          teacherJoinYear: true,
          teacherRetireYear: true,
          createdAt: true,
          lastLoginAt: true,
        },
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    // Get summary stats
    const stats = await prisma.user.groupBy({
      by: ['role'],
      where: { organizationId: orgId },
      _count: true,
    });

    const roleStats = stats.reduce((acc, item) => {
      acc[item.role] = item._count;
      return acc;
    }, {});

    return successResponse(res, {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      stats: {
        total,
        byRole: roleStats,
      },
    });
  } catch (error) {
    console.error('Get organization users error:', error);
    return errorResponse(res, 'Failed to retrieve users', 500);
  }
};

/**
 * Get single user details
 * GET /api/developer/organizations/:orgId/users/:userId
 */
const getOrganizationUser = async (req, res) => {
  try {
    const { orgId, userId } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: orgId,
      },
      include: {
        _count: {
          select: {
            posts: true,
            eventRegistrations: true,
            tickets: true,
          },
        },
      },
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Remove sensitive fields
    const { passwordHash, passwordResetToken, emailVerifyToken, ...safeUser } = user;

    return successResponse(res, { user: safeUser });
  } catch (error) {
    console.error('Get organization user error:', error);
    return errorResponse(res, 'Failed to retrieve user', 500);
  }
};

/**
 * Create new user for organization
 * POST /api/developer/organizations/:orgId/users
 */
const createOrganizationUser = async (req, res) => {
  try {
    const { orgId } = req.params;
    const {
      email,
      password,
      fullName,
      role = 'USER',
      batch,
      admissionYear,
      passoutYear,
      isActive = true,
      isAlumniVerified = false,
      // Teacher-specific fields
      teacherSubject,
      teacherJoinYear,
      isRetired = false,
      teacherLeavingYear, // Replaces teacherRetireYear - can be leaving or retirement
    } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return errorResponse(res, 'Email, password, and full name are required', 400);
    }

    // Validate batch, admission year, passout year - required for serial ID generation
    if (!batch || !admissionYear || !passoutYear) {
      return errorResponse(res, 'Batch, admission year, and passout year are required for serial ID generation', 400);
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, shortName: true, maxUsers: true, _count: { select: { users: true } } },
    });

    if (!organization) {
      return errorResponse(res, 'Organization not found', 404);
    }

    // Check user limit
    if (organization._count.users >= organization.maxUsers) {
      return errorResponse(res, 'Organization has reached maximum user limit', 400);
    }

    // Check if email already exists in THIS organization
    // Multi-tenant: Same email can exist in different organizations (per user_email_org_unique constraint)
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        organizationId: orgId
      }
    });
    if (existingUser) {
      return errorResponse(res, 'Email already exists in this organization', 409);
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    // Use provided values directly
    const finalBatch = parseInt(batch);
    const finalAdmissionYear = parseInt(admissionYear);
    const finalPassoutYear = parseInt(passoutYear);

    // Ensure batch exists in batches table (auto-create if needed)
    const existingBatch = await prisma.batch.findUnique({
      where: { year: finalBatch }
    });

    if (!existingBatch) {
      // Create the batch record
      await prisma.batch.create({
        data: {
          year: finalBatch,
          name: `Batch ${finalAdmissionYear}-${String(finalPassoutYear).slice(-2)}`,
          admissionYear: finalAdmissionYear,
          passoutYear: finalPassoutYear,
          batchDisplayName: `${finalAdmissionYear}-${String(finalPassoutYear).slice(-2)} Batch`,
          lastSerialCounter: 0,
        }
      });
      console.log(`Created new batch: ${finalBatch} (${finalAdmissionYear}-${finalPassoutYear})`);
    }

    // Generate Serial ID for ALL roles (mandatory)
    let serialId = null;
    let serialCounter = null;

    try {
      const SerialIdService = require('../../services/serialID.service');
      const result = await SerialIdService.generateUniqueSerialId(
        fullName,
        finalAdmissionYear,
        finalPassoutYear,
        orgId
      );
      serialId = result.serialId;
      serialCounter = result.counter;
    } catch (serialError) {
      console.error('Serial ID generation error:', serialError);
      return errorResponse(res, 'Failed to generate serial ID', 500);
    }

    // Create user with all fields
    const userData = {
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role,
      batch: finalBatch,
      admissionYear: finalAdmissionYear,
      passoutYear: finalPassoutYear,
      serialId,
      serialCounter,
      isActive,
      // Admin roles created by developer are auto-verified, USER role can optionally be verified
      isAlumniVerified: (role === 'SUPER_ADMIN' || role === 'BATCH_ADMIN' || role === 'TEACHER') ? true : isAlumniVerified,
      isEmailVerified: true, // Developer-created users are verified
      pendingVerification: false, // Skip verification for developer-created users
      organizationId: orgId,
    };

    // Add teacher-specific fields
    if (role === 'TEACHER') {
      userData.teacherSubject = teacherSubject || null;
      userData.teacherJoinYear = teacherJoinYear ? parseInt(teacherJoinYear) : null;
      // Store leaving year in teacherRetireYear field (schema uses this name)
      // Also store isRetired status - if teacher left, store the year
      userData.teacherRetireYear = isRetired && teacherLeavingYear ? parseInt(teacherLeavingYear) : null;
    }

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        batch: true,
        admissionYear: true,
        passoutYear: true,
        serialId: true,
        isActive: true,
        isAlumniVerified: true,
        teacherSubject: true,
        teacherJoinYear: true,
        teacherRetireYear: true,
        createdAt: true,
      },
    });

    // Add isServing field for response (calculated from teacherRetireYear)
    if (role === 'TEACHER') {
      user.isServing = !user.teacherRetireYear;
    }

    return successResponse(res, { user }, 'User created successfully', 201);
  } catch (error) {
    console.error('Create organization user error:', error);
    return errorResponse(res, 'Failed to create user', 500);
  }
};

/**
 * Update user details
 * PUT /api/developer/organizations/:orgId/users/:userId
 */
const updateOrganizationUser = async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const {
      fullName,
      email,
      role,
      batch,
      isActive,
      isAlumniVerified,
    } = req.body;

    // Check user exists and belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existingUser) {
      return errorResponse(res, 'User not found', 404);
    }

    // If email changed, check uniqueness
    if (email && email.toLowerCase() !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), id: { not: userId } },
      });
      if (emailExists) {
        return errorResponse(res, 'Email already in use', 409);
      }
    }

    // Build update data
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (role !== undefined) updateData.role = role;
    if (batch !== undefined) updateData.batch = batch;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isAlumniVerified !== undefined) updateData.isAlumniVerified = isAlumniVerified;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        batch: true,
        isActive: true,
        isAlumniVerified: true,
        updatedAt: true,
      },
    });

    return successResponse(res, { user }, 'User updated successfully');
  } catch (error) {
    console.error('Update organization user error:', error);
    return errorResponse(res, 'Failed to update user', 500);
  }
};

/**
 * Reset user password
 * POST /api/developer/organizations/:orgId/users/:userId/reset-password
 */
const resetUserPassword = async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters', 400);
    }

    // Check user exists and belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existingUser) {
      return errorResponse(res, 'User not found', 404);
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return successResponse(res, null, 'Password reset successfully');
  } catch (error) {
    console.error('Reset user password error:', error);
    return errorResponse(res, 'Failed to reset password', 500);
  }
};

/**
 * Toggle user active status (block/unblock)
 * POST /api/developer/organizations/:orgId/users/:userId/toggle-status
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { orgId, userId } = req.params;

    // Check user exists and belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existingUser) {
      return errorResponse(res, 'User not found', 404);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: !existingUser.isActive,
        deactivatedAt: existingUser.isActive ? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
      },
    });

    return successResponse(res, { user }, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`);
  } catch (error) {
    console.error('Toggle user status error:', error);
    return errorResponse(res, 'Failed to toggle user status', 500);
  }
};

/**
 * Delete user (soft delete)
 * DELETE /api/developer/organizations/:orgId/users/:userId
 */
const deleteOrganizationUser = async (req, res) => {
  try {
    const { orgId, userId } = req.params;

    // Check user exists and belongs to organization
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
    });

    if (!existingUser) {
      return errorResponse(res, 'User not found', 404);
    }

    // Prevent deleting SUPER_ADMIN
    if (existingUser.role === 'SUPER_ADMIN') {
      return errorResponse(res, 'Cannot delete Super Admin user', 403);
    }

    // Soft delete - deactivate the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        email: `deleted_${Date.now()}_${existingUser.email}`, // Prevent email conflicts
      },
    });

    return successResponse(res, null, 'User deleted successfully');
  } catch (error) {
    console.error('Delete organization user error:', error);
    return errorResponse(res, 'Failed to delete user', 500);
  }
};

/**
 * Get organization activity logs
 * GET /api/developer/organizations/:orgId/activity-logs
 */
const getOrganizationActivityLogs = async (req, res) => {
  try {
    const { orgId } = req.params;
    const {
      page = 1,
      limit = 50,
      action = '',
      userId = '',
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause for activity logs
    const whereClause = {
      user: {
        organizationId: orgId,
      },
    };

    if (action) {
      whereClause.action = { contains: action, mode: 'insensitive' };
    }

    if (userId) {
      whereClause.userId = userId;
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImage: true,
              role: true,
            },
          },
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count({ where: whereClause }),
    ]);

    return successResponse(res, {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get organization activity logs error:', error);
    return errorResponse(res, 'Failed to retrieve activity logs', 500);
  }
};

// ==========================================
// ORGANIZATION EMAIL CONFIGURATION
// ==========================================

const TenantEmailManager = require('../../services/email/TenantEmailManager');

/**
 * Get organization email configuration
 * GET /api/developer/organizations/:orgId/email-config
 * Access: DEVELOPER only
 */
const getOrganizationEmailConfig = async (req, res) => {
  try {
    const { orgId } = req.params;

    const config = await TenantEmailManager.getEmailConfig(orgId);

    if (!config) {
      return successResponse(res, {
        config: null,
        message: 'No email configuration found. Configure email to enable custom domain emails.'
      }, 'Email configuration retrieved');
    }

    // Generate DNS records if we have a fromEmail domain
    let dnsRecords = null;
    if (config.fromEmail && config.verificationToken) {
      const domain = config.fromEmail.split('@')[1];
      dnsRecords = TenantEmailManager.generateDnsRecords(domain, config.verificationToken);
    }

    return successResponse(res, {
      config,
      dnsRecords
    }, 'Email configuration retrieved successfully');
  } catch (error) {
    console.error('Get email config error:', error);
    return errorResponse(res, 'Failed to retrieve email configuration', 500);
  }
};

/**
 * Save/Update organization email configuration
 * POST /api/developer/organizations/:orgId/email-config
 * Access: DEVELOPER only
 */
const saveOrganizationEmailConfig = async (req, res) => {
  try {
    const { orgId } = req.params;
    const {
      provider,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      sendgridApiKey,
      resendApiKey,
      mailgunApiKey,
      mailgunDomain,
      mailersendApiKey,
      fromEmail,
      fromName,
      replyTo,
      primaryColor,
      logoUrl,
      dailyEmailLimit,
      monthlyEmailLimit,
    } = req.body;

    // Validate required fields
    if (!provider || !fromEmail || !fromName) {
      return errorResponse(res, 'Provider, fromEmail, and fromName are required', 400);
    }

    // Check if there's an existing config (to allow updates without re-entering API keys)
    const existingConfig = await prisma.organizationEmailConfig.findUnique({
      where: { organizationId: orgId }
    });

    // Validate provider-specific fields
    // For updates, API keys are only required if not already saved
    if (provider === 'SMTP' && (!smtpHost || !smtpUser)) {
      return errorResponse(res, 'SMTP host and user are required for SMTP provider', 400);
    }
    if (provider === 'SENDGRID' && !sendgridApiKey && !existingConfig?.sendgridApiKey) {
      return errorResponse(res, 'SendGrid API key is required', 400);
    }
    if (provider === 'RESEND' && !resendApiKey && !existingConfig?.resendApiKey) {
      return errorResponse(res, 'Resend API key is required', 400);
    }
    if (provider === 'MAILGUN' && ((!mailgunApiKey && !existingConfig?.mailgunApiKey) || !mailgunDomain)) {
      return errorResponse(res, 'Mailgun API key and domain are required', 400);
    }
    if (provider === 'MAILERSEND' && !mailersendApiKey && !existingConfig?.mailersendApiKey) {
      return errorResponse(res, 'MailerSend API key is required', 400);
    }

    const result = await TenantEmailManager.saveEmailConfig(orgId, {
      provider,
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpSecure: smtpSecure || false,
      smtpUser,
      smtpPassword,
      sendgridApiKey,
      resendApiKey,
      mailgunApiKey,
      mailgunDomain,
      mailersendApiKey,
      fromEmail,
      fromName,
      replyTo,
      primaryColor,
      logoUrl,
      dailyEmailLimit: dailyEmailLimit || 1000,
      monthlyEmailLimit: monthlyEmailLimit || 25000,
    }, req.user.id);

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to save email configuration', 500);
    }

    // Generate DNS records for the new configuration
    const domain = fromEmail.split('@')[1];
    const dnsRecords = TenantEmailManager.generateDnsRecords(domain, result.verificationToken);

    return successResponse(res, {
      config: result.config,
      dnsRecords,
      message: 'Email configuration saved. Please verify connection before activating.'
    }, 'Email configuration saved successfully');
  } catch (error) {
    console.error('Save email config error:', error);
    return errorResponse(res, 'Failed to save email configuration', 500);
  }
};

/**
 * Test organization email configuration
 * POST /api/developer/organizations/:orgId/email-config/test
 * Access: DEVELOPER only
 */
const testOrganizationEmailConfig = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { testEmail } = req.body;

    // First test the connection
    const testResult = await TenantEmailManager.testTenantEmailConfig(orgId);

    if (!testResult.success) {
      return errorResponse(res, `Connection test failed: ${testResult.error}`, 400);
    }

    // If test email provided, send a test email using the provider directly
    // (not via sendEmail which requires isActive=true)
    if (testEmail) {
      try {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { tenantCode: true, name: true }
        });

        // Get the config and create provider directly (bypasses isActive check)
        const config = await prisma.organizationEmailConfig.findUnique({
          where: { organizationId: orgId }
        });

        if (!config) {
          return errorResponse(res, 'No email configuration found', 404);
        }

        // Create provider directly from config for testing
        const provider = await TenantEmailManager.createProviderFromConfig(config);

        console.log(`📧 Sending test email via ${config.provider} to ${testEmail}`);

        const testHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3b82f6;">Email Configuration Test</h2>
            <p>This is a test email to verify your email configuration is working correctly.</p>
            <p>If you received this email, your email configuration is set up correctly!</p>
            <p><strong>Provider:</strong> ${config.provider}</p>
            <p><strong>From:</strong> ${config.fromName} &lt;${config.fromEmail}&gt;</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              Sent from ${org?.name || 'Alumni Portal'}
            </p>
          </div>
        `;

        const sendResult = await provider.sendEmail(
          testEmail,
          `Test Email from ${org?.name || 'Alumni Portal'}`,
          testHtml
        );

        // Check if email actually sent successfully
        if (!sendResult.success) {
          console.error(`❌ Test email failed:`, sendResult.error);
          return errorResponse(res, `Failed to send test email: ${sendResult.error}`, 400);
        }

        console.log(`✅ Test email sent successfully via ${config.provider}`);
      } catch (sendError) {
        console.error('Test email send error:', sendError);
        return errorResponse(res, `Connection verified but failed to send test email: ${sendError.message}`, 400);
      }
    }

    return successResponse(res, {
      ...testResult,
      testEmailSent: !!testEmail
    }, testEmail ? 'Connection verified and test email sent!' : 'Connection verified successfully!');
  } catch (error) {
    console.error('Test email config error:', error);
    return errorResponse(res, 'Failed to test email configuration', 500);
  }
};

/**
 * Activate organization email configuration
 * POST /api/developer/organizations/:orgId/email-config/activate
 * Access: DEVELOPER only
 */
const activateOrganizationEmailConfig = async (req, res) => {
  try {
    const { orgId } = req.params;

    const result = await TenantEmailManager.activateEmailConfig(orgId);

    if (!result.success) {
      return errorResponse(res, result.error || 'Failed to activate email configuration', 400);
    }

    return successResponse(res, result, 'Email configuration activated successfully');
  } catch (error) {
    console.error('Activate email config error:', error);
    return errorResponse(res, 'Failed to activate email configuration', 500);
  }
};

/**
 * Deactivate organization email configuration (use default system emails)
 * POST /api/developer/organizations/:orgId/email-config/deactivate
 * Access: DEVELOPER only
 */
const deactivateOrganizationEmailConfig = async (req, res) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.organizationEmailConfig.findUnique({
      where: { organizationId: orgId }
    });

    if (!config) {
      return errorResponse(res, 'No email configuration found', 404);
    }

    await prisma.organizationEmailConfig.update({
      where: { id: config.id },
      data: { isActive: false }
    });

    // Clear cache
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { tenantCode: true }
    });
    if (org?.tenantCode) {
      TenantEmailManager.clearTenantCache(org.tenantCode);
    }

    return successResponse(res, {
      message: 'Email configuration deactivated. System will use default email service.'
    }, 'Email configuration deactivated successfully');
  } catch (error) {
    console.error('Deactivate email config error:', error);
    return errorResponse(res, 'Failed to deactivate email configuration', 500);
  }
};

/**
 * Delete organization email configuration
 * DELETE /api/developer/organizations/:orgId/email-config
 * Access: DEVELOPER only
 */
const deleteOrganizationEmailConfig = async (req, res) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.organizationEmailConfig.findUnique({
      where: { organizationId: orgId }
    });

    if (!config) {
      return errorResponse(res, 'No email configuration found', 404);
    }

    // Clear cache first
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { tenantCode: true }
    });
    if (org?.tenantCode) {
      TenantEmailManager.clearTenantCache(org.tenantCode);
    }

    await prisma.organizationEmailConfig.delete({
      where: { id: config.id }
    });

    return successResponse(res, {
      message: 'Email configuration deleted. System will use default email service.'
    }, 'Email configuration deleted successfully');
  } catch (error) {
    console.error('Delete email config error:', error);
    return errorResponse(res, 'Failed to delete email configuration', 500);
  }
};

/**
 * Get email statistics for organization
 * GET /api/developer/organizations/:orgId/email-config/stats
 * Access: DEVELOPER only
 */
const getOrganizationEmailStats = async (req, res) => {
  try {
    const { orgId } = req.params;

    const config = await prisma.organizationEmailConfig.findUnique({
      where: { organizationId: orgId },
      select: {
        dailyEmailsSent: true,
        monthlyEmailsSent: true,
        dailyEmailLimit: true,
        monthlyEmailLimit: true,
        lastDailyReset: true,
        lastMonthlyReset: true,
        lastTestedAt: true,
        lastTestResult: true,
        isActive: true,
        isVerified: true,
        provider: true,
      }
    });

    if (!config) {
      return successResponse(res, {
        stats: null,
        message: 'No email configuration found'
      }, 'Email stats retrieved');
    }

    return successResponse(res, {
      stats: {
        ...config,
        dailyUsagePercent: Math.round((config.dailyEmailsSent / config.dailyEmailLimit) * 100),
        monthlyUsagePercent: Math.round((config.monthlyEmailsSent / config.monthlyEmailLimit) * 100),
      }
    }, 'Email statistics retrieved successfully');
  } catch (error) {
    console.error('Get email stats error:', error);
    return errorResponse(res, 'Failed to retrieve email statistics', 500);
  }
};

module.exports = {
  // Organization management
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  toggleMaintenanceMode,
  updateSubscription,
  getOrganizationStats,
  uploadOrganizationFiles,
  deleteOrganizationFile,

  // Developer dashboard
  getDeveloperDashboard,
  switchTenantContext,

  // Subscription plans
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  setPlanFeatures,

  // Feature catalog
  getAllFeatures,
  createFeature,
  updateFeature,
  seedFeatures,
  getFeatureMatrix,

  // Organization subscription
  getOrganizationSubscriptionDetails,
  createOrganizationSubscription,
  changeOrganizationPlan,
  suspendOrganization,
  reactivateOrganization,

  // Organization features
  getOrganizationFeatures,
  toggleOrganizationFeature,
  setOrganizationFeatureLimit,

  // Payment requests
  createPaymentRequest,
  getPendingPaymentRequests,

  // Cron jobs
  checkExpirations,
  getSubscriptionAuditLogs,

  // User management
  getOrganizationUsers,
  getOrganizationUser,
  createOrganizationUser,
  updateOrganizationUser,
  resetUserPassword,
  toggleUserStatus,
  deleteOrganizationUser,

  // Activity logs
  getOrganizationActivityLogs,

  // Email configuration
  getOrganizationEmailConfig,
  saveOrganizationEmailConfig,
  testOrganizationEmailConfig,
  activateOrganizationEmailConfig,
  deactivateOrganizationEmailConfig,
  deleteOrganizationEmailConfig,
  getOrganizationEmailStats,
};
