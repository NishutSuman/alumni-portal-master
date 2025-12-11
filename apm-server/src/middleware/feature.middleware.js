// ==========================================
// FEATURE ACCESS MIDDLEWARE
// File: apm-server/src/middleware/feature.middleware.js
// Middleware to check feature availability for organization
// ==========================================

const FeatureService = require('../services/subscription/FeatureService');
const { errorResponse } = require('../utils/response');

/**
 * Create feature check middleware
 * @param {string} featureCode - The feature code to check
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
const requireFeature = (featureCode, options = {}) => {
  return async (req, res, next) => {
    try {
      // Skip for developers (they have full access)
      if (req.user?.role === 'DEVELOPER') {
        return next();
      }

      // Get organization ID from request
      const organizationId = req.tenant?.id || req.user?.organizationId;

      if (!organizationId) {
        // No organization context - allow if feature is not strictly required
        if (options.optional) {
          return next();
        }
        return errorResponse(res, 'Organization context required', 400);
      }

      // Check feature access
      const hasAccess = await FeatureService.hasFeatureAccess(organizationId, featureCode);

      if (!hasAccess) {
        const featureStatus = await FeatureService.getFeatureStatus(organizationId, featureCode);

        // Feature doesn't exist
        if (!featureStatus.exists) {
          return errorResponse(res, `Feature ${featureCode} not found`, 404);
        }

        // Feature is premium/add-on and not enabled
        if (featureStatus.isPremium || featureStatus.isAddOn) {
          return errorResponse(res, {
            message: `This feature requires a higher subscription plan`,
            feature: featureCode,
            featureName: featureStatus.name,
            isPremium: featureStatus.isPremium,
            isAddOn: featureStatus.isAddOn,
            upgradeRequired: true
          }, 403);
        }

        // Feature is disabled for this organization
        return errorResponse(res, {
          message: `Feature ${featureStatus.name} is not enabled for your organization`,
          feature: featureCode,
          featureName: featureStatus.name,
          isDisabled: true
        }, 403);
      }

      // Add feature info to request for downstream use
      req.featureAccess = {
        code: featureCode,
        hasAccess: true
      };

      next();
    } catch (error) {
      console.error('Feature middleware error:', error);
      return errorResponse(res, 'Failed to verify feature access', 500);
    }
  };
};

/**
 * Create feature limit check middleware
 * @param {string} featureCode - The feature code to check
 * @param {Function} getCurrentUsage - Function to get current usage (receives req)
 * @returns {Function} Express middleware
 */
const checkFeatureLimit = (featureCode, getCurrentUsage) => {
  return async (req, res, next) => {
    try {
      // Skip for developers
      if (req.user?.role === 'DEVELOPER') {
        return next();
      }

      const organizationId = req.tenant?.id || req.user?.organizationId;

      if (!organizationId) {
        return next();
      }

      // Get feature status with limits
      const featureStatus = await FeatureService.getFeatureStatus(organizationId, featureCode);

      if (!featureStatus.isEnabled) {
        return errorResponse(res, `Feature ${featureCode} is not enabled`, 403);
      }

      // If no limit set, allow
      if (!featureStatus.customLimit) {
        return next();
      }

      // Get current usage
      const currentUsage = await getCurrentUsage(req);

      if (currentUsage >= featureStatus.customLimit) {
        return errorResponse(res, {
          message: `You have reached the limit for ${featureStatus.name}`,
          feature: featureCode,
          limit: featureStatus.customLimit,
          limitType: featureStatus.customLimitType,
          currentUsage,
          upgradeRequired: true
        }, 429); // Too Many Requests
      }

      // Add limit info to request
      req.featureLimit = {
        code: featureCode,
        limit: featureStatus.customLimit,
        currentUsage,
        remaining: featureStatus.customLimit - currentUsage
      };

      next();
    } catch (error) {
      console.error('Feature limit middleware error:', error);
      return errorResponse(res, 'Failed to verify feature limit', 500);
    }
  };
};

/**
 * Middleware to check subscription status
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    // Skip for developers
    if (req.user?.role === 'DEVELOPER') {
      return next();
    }

    const tenant = req.tenant;

    if (!tenant) {
      return errorResponse(res, 'Organization context required', 400);
    }

    // Check subscription status
    const allowedStatuses = ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'];

    if (!allowedStatuses.includes(tenant.subscriptionStatus)) {
      const messages = {
        'EXPIRED': 'Your subscription has expired. Please renew to continue.',
        'SUSPENDED': 'Your subscription has been suspended. Please contact support.',
        'CANCELLED': 'Your subscription has been cancelled.'
      };

      return errorResponse(res, {
        message: messages[tenant.subscriptionStatus] || 'Subscription inactive',
        subscriptionStatus: tenant.subscriptionStatus,
        renewalRequired: true
      }, 402); // Payment Required
    }

    next();
  } catch (error) {
    console.error('Subscription check middleware error:', error);
    return errorResponse(res, 'Failed to verify subscription status', 500);
  }
};

/**
 * Middleware to check if in trial period
 */
const checkTrialStatus = async (req, res, next) => {
  try {
    const tenant = req.tenant;

    if (tenant?.subscriptionStatus === 'TRIAL') {
      // Add trial info to request
      req.trialStatus = {
        isTrial: true,
        subscriptionEndsAt: tenant.subscriptionEndsAt
      };

      // Calculate days remaining
      if (tenant.subscriptionEndsAt) {
        const now = new Date();
        const end = new Date(tenant.subscriptionEndsAt);
        const daysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

        req.trialStatus.daysRemaining = Math.max(0, daysRemaining);

        // Add warning header if trial ending soon (< 3 days)
        if (daysRemaining <= 3 && daysRemaining > 0) {
          res.setHeader('X-Trial-Warning', `Trial expires in ${daysRemaining} day(s)`);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Trial status middleware error:', error);
    next(); // Don't block on error
  }
};

/**
 * Get organization's feature access summary
 */
const attachFeatureAccess = async (req, res, next) => {
  try {
    const organizationId = req.tenant?.id || req.user?.organizationId;

    if (organizationId) {
      const features = await FeatureService.getOrganizationFeatures(organizationId);

      // Create quick lookup map
      req.enabledFeatures = new Set(
        features.filter(f => f.isEnabled).map(f => f.code)
      );

      // Helper function
      req.hasFeature = (featureCode) => {
        return req.enabledFeatures.has(featureCode);
      };
    }

    next();
  } catch (error) {
    console.error('Feature access attachment error:', error);
    next(); // Don't block on error
  }
};

module.exports = {
  requireFeature,
  checkFeatureLimit,
  requireActiveSubscription,
  checkTrialStatus,
  attachFeatureAccess
};
