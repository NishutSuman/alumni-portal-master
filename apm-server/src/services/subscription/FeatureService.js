// ==========================================
// FEATURE FLAG SERVICE
// File: apm-server/src/services/subscription/FeatureService.js
// Handles feature availability and access control
// ==========================================

const { PrismaClient } = require('@prisma/client');
const { CacheService } = require('../../config/redis');

const prisma = new PrismaClient();

// Default feature definitions (will be seeded to database)
const DEFAULT_FEATURES = [
  // Core Features (always available)
  { code: 'DASHBOARD', name: 'Dashboard', category: 'CORE', isCore: true },
  { code: 'PROFILE', name: 'User Profile', category: 'CORE', isCore: true },
  { code: 'DIRECTORY', name: 'Alumni Directory', category: 'CORE', isCore: true },

  // Communication Features
  { code: 'POSTS', name: 'Social Posts', category: 'COMMUNICATION', isCore: false },
  { code: 'NOTIFICATIONS', name: 'Push Notifications', category: 'COMMUNICATION', isCore: false },
  { code: 'EMAIL_CAMPAIGNS', name: 'Email Campaigns', category: 'COMMUNICATION', isPremium: true },

  // Engagement Features
  { code: 'EVENTS', name: 'Event Management', category: 'ENGAGEMENT', isCore: false },
  { code: 'POLLS', name: 'Polls & Surveys', category: 'ENGAGEMENT', isCore: false },
  { code: 'GROUPS', name: 'Groups & Communities', category: 'ENGAGEMENT', isCore: false },
  { code: 'GALLERY', name: 'Photo Gallery', category: 'ENGAGEMENT', isCore: false },

  // Admin Features
  { code: 'USER_MANAGEMENT', name: 'User Management', category: 'ADMIN', isCore: false },
  { code: 'BATCH_MANAGEMENT', name: 'Batch Management', category: 'ADMIN', isCore: false },
  { code: 'ANALYTICS', name: 'Analytics Dashboard', category: 'ADMIN', isCore: false },
  { code: 'REPORTS', name: 'Reports & Exports', category: 'ADMIN', isPremium: true },

  // Premium Features
  { code: 'TREASURY', name: 'Treasury Management', category: 'PREMIUM', isPremium: true },
  { code: 'MEMBERSHIP', name: 'Membership System', category: 'PREMIUM', isPremium: true },
  { code: 'LIFELINK', name: 'LifeLink Blood Donor', category: 'PREMIUM', isPremium: true },
  { code: 'MERCHANDISE', name: 'Merchandise Store', category: 'PREMIUM', isPremium: true },
  { code: 'SUPPORT_TICKETS', name: 'Support Tickets', category: 'PREMIUM', isPremium: true },
  { code: 'CUSTOM_DOMAIN_EMAIL', name: 'Custom Domain Email', category: 'PREMIUM', isPremium: true, isAddOn: true },
  { code: 'CUSTOM_PUSH', name: 'Custom Push Notifications', category: 'PREMIUM', isPremium: true, isAddOn: true },
  { code: 'WHITE_LABEL', name: 'White Label Branding', category: 'PREMIUM', isPremium: true, isAddOn: true },
  { code: 'API_ACCESS', name: 'API Access', category: 'PREMIUM', isPremium: true, isAddOn: true }
];

class FeatureService {

  // ==========================================
  // FEATURE CATALOG MANAGEMENT (Developer)
  // ==========================================

  /**
   * Get all features
   */
  static async getAllFeatures(includeInactive = false) {
    const cacheKey = `features:all:${includeInactive}`;
    let features = await CacheService.get(cacheKey);

    if (!features) {
      features = await prisma.feature.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      });

      await CacheService.set(cacheKey, features, 3600);
    }

    return features;
  }

  /**
   * Get feature by code
   */
  static async getFeatureByCode(code) {
    const cacheKey = `features:code:${code}`;
    let feature = await CacheService.get(cacheKey);

    if (!feature) {
      feature = await prisma.feature.findUnique({
        where: { code }
      });

      if (feature) {
        await CacheService.set(cacheKey, feature, 3600);
      }
    }

    return feature;
  }

  /**
   * Create new feature (Developer only)
   */
  static async createFeature(featureData) {
    const feature = await prisma.feature.create({
      data: {
        code: featureData.code.toUpperCase(),
        name: featureData.name,
        description: featureData.description || '',
        category: featureData.category,
        isCore: featureData.isCore || false,
        isPremium: featureData.isPremium || false,
        isAddOn: featureData.isAddOn || false,
        addOnPriceMonthly: featureData.addOnPriceMonthly,
        addOnPriceYearly: featureData.addOnPriceYearly,
        isBeta: featureData.isBeta || false
      }
    });

    await CacheService.delPattern('features:*');

    return feature;
  }

  /**
   * Update feature
   */
  static async updateFeature(featureId, featureData) {
    const feature = await prisma.feature.update({
      where: { id: featureId },
      data: featureData
    });

    await CacheService.delPattern('features:*');

    return feature;
  }

  /**
   * Seed default features
   */
  static async seedDefaultFeatures() {
    const results = {
      created: 0,
      existing: 0,
      errors: []
    };

    for (const featureData of DEFAULT_FEATURES) {
      try {
        const existing = await prisma.feature.findUnique({
          where: { code: featureData.code }
        });

        if (!existing) {
          await prisma.feature.create({
            data: {
              ...featureData,
              description: `${featureData.name} feature`
            }
          });
          results.created++;
        } else {
          results.existing++;
        }
      } catch (error) {
        results.errors.push({ code: featureData.code, error: error.message });
      }
    }

    await CacheService.delPattern('features:*');

    return results;
  }

  // ==========================================
  // ORGANIZATION FEATURE ACCESS
  // ==========================================

  /**
   * Check if organization has access to a feature
   */
  static async hasFeatureAccess(organizationId, featureCode) {
    const cacheKey = `features:org:${organizationId}:${featureCode}`;
    let hasAccess = await CacheService.get(cacheKey);

    if (hasAccess === null || hasAccess === undefined) {
      // Get feature
      const feature = await this.getFeatureByCode(featureCode);
      if (!feature) {
        return false;
      }

      // Core features always available
      if (feature.isCore) {
        hasAccess = true;
      } else {
        // Check organization feature
        const orgFeature = await prisma.organizationFeature.findUnique({
          where: {
            organizationId_featureId: {
              organizationId,
              featureId: feature.id
            }
          }
        });

        hasAccess = orgFeature?.isEnabled || false;

        // Check if add-on has expired
        if (hasAccess && orgFeature?.isPurchasedAddOn && orgFeature?.addOnExpiresAt) {
          if (new Date(orgFeature.addOnExpiresAt) < new Date()) {
            hasAccess = false;
          }
        }
      }

      await CacheService.set(cacheKey, hasAccess, 300); // 5 min cache
    }

    return hasAccess;
  }

  /**
   * Get all enabled features for organization
   */
  static async getOrganizationFeatures(organizationId) {
    const cacheKey = `features:org:${organizationId}:all`;
    let features = await CacheService.get(cacheKey);

    if (!features) {
      // Get all features
      const allFeatures = await this.getAllFeatures();

      // Get organization's feature settings
      const orgFeatures = await prisma.organizationFeature.findMany({
        where: { organizationId },
        include: { feature: true }
      });

      const orgFeatureMap = new Map(
        orgFeatures.map(of => [of.featureId, of])
      );

      // Build feature status list
      features = allFeatures.map(feature => {
        const orgFeature = orgFeatureMap.get(feature.id);
        let isEnabled = feature.isCore; // Core features always enabled

        if (!feature.isCore && orgFeature) {
          isEnabled = orgFeature.isEnabled;

          // Check add-on expiry
          if (isEnabled && orgFeature.isPurchasedAddOn && orgFeature.addOnExpiresAt) {
            if (new Date(orgFeature.addOnExpiresAt) < new Date()) {
              isEnabled = false;
            }
          }
        }

        return {
          code: feature.code,
          name: feature.name,
          category: feature.category,
          isCore: feature.isCore,
          isPremium: feature.isPremium,
          isAddOn: feature.isAddOn,
          isEnabled,
          customLimit: orgFeature?.customLimit,
          isPurchasedAddOn: orgFeature?.isPurchasedAddOn || false,
          addOnExpiresAt: orgFeature?.addOnExpiresAt
        };
      });

      await CacheService.set(cacheKey, features, 300);
    }

    return features;
  }

  /**
   * Get feature status with limit info
   */
  static async getFeatureStatus(organizationId, featureCode) {
    const feature = await this.getFeatureByCode(featureCode);
    if (!feature) {
      return { exists: false, isEnabled: false };
    }

    if (feature.isCore) {
      return {
        exists: true,
        isEnabled: true,
        isCore: true,
        code: featureCode,
        name: feature.name
      };
    }

    const orgFeature = await prisma.organizationFeature.findUnique({
      where: {
        organizationId_featureId: {
          organizationId,
          featureId: feature.id
        }
      }
    });

    let isEnabled = orgFeature?.isEnabled || false;

    // Check add-on expiry
    if (isEnabled && orgFeature?.isPurchasedAddOn && orgFeature?.addOnExpiresAt) {
      if (new Date(orgFeature.addOnExpiresAt) < new Date()) {
        isEnabled = false;
      }
    }

    return {
      exists: true,
      isEnabled,
      isCore: false,
      isPremium: feature.isPremium,
      isAddOn: feature.isAddOn,
      code: featureCode,
      name: feature.name,
      customLimit: orgFeature?.customLimit,
      customLimitType: orgFeature?.customLimitType,
      isPurchasedAddOn: orgFeature?.isPurchasedAddOn || false,
      addOnExpiresAt: orgFeature?.addOnExpiresAt
    };
  }

  // ==========================================
  // ORGANIZATION FEATURE MANAGEMENT
  // ==========================================

  /**
   * Enable feature for organization
   */
  static async enableFeature(organizationId, featureCode, options = {}) {
    const feature = await this.getFeatureByCode(featureCode);
    if (!feature) {
      throw new Error(`Feature ${featureCode} not found`);
    }

    const orgFeature = await prisma.organizationFeature.upsert({
      where: {
        organizationId_featureId: {
          organizationId,
          featureId: feature.id
        }
      },
      create: {
        organizationId,
        featureId: feature.id,
        isEnabled: true,
        enabledAt: new Date(),
        customLimit: options.customLimit,
        customLimitType: options.customLimitType,
        isPurchasedAddOn: options.isPurchasedAddOn || false,
        addOnExpiresAt: options.addOnExpiresAt,
        addOnPaymentId: options.paymentId,
        lastModifiedBy: options.modifiedBy
      },
      update: {
        isEnabled: true,
        enabledAt: new Date(),
        disabledAt: null,
        disableReason: null,
        customLimit: options.customLimit,
        customLimitType: options.customLimitType,
        isPurchasedAddOn: options.isPurchasedAddOn || false,
        addOnExpiresAt: options.addOnExpiresAt,
        addOnPaymentId: options.paymentId,
        lastModifiedBy: options.modifiedBy,
        lastModifiedAt: new Date()
      }
    });

    // Clear cache
    await CacheService.delPattern(`features:org:${organizationId}:*`);

    return orgFeature;
  }

  /**
   * Disable feature for organization
   */
  static async disableFeature(organizationId, featureCode, reason, disabledBy) {
    const feature = await this.getFeatureByCode(featureCode);
    if (!feature) {
      throw new Error(`Feature ${featureCode} not found`);
    }

    if (feature.isCore) {
      throw new Error('Core features cannot be disabled');
    }

    const orgFeature = await prisma.organizationFeature.update({
      where: {
        organizationId_featureId: {
          organizationId,
          featureId: feature.id
        }
      },
      data: {
        isEnabled: false,
        disabledAt: new Date(),
        disableReason: reason,
        lastModifiedBy: disabledBy,
        lastModifiedAt: new Date()
      }
    });

    // Clear cache
    await CacheService.delPattern(`features:org:${organizationId}:*`);

    return orgFeature;
  }

  /**
   * Toggle feature for organization (Developer/Super Admin)
   */
  static async toggleFeature(organizationId, featureCode, isEnabled, modifiedBy) {
    if (isEnabled) {
      return await this.enableFeature(organizationId, featureCode, { modifiedBy });
    } else {
      return await this.disableFeature(organizationId, featureCode, 'Disabled by admin', modifiedBy);
    }
  }

  /**
   * Set custom limit for feature
   */
  static async setFeatureLimit(organizationId, featureCode, limit, limitType, modifiedBy) {
    const feature = await this.getFeatureByCode(featureCode);
    if (!feature) {
      throw new Error(`Feature ${featureCode} not found`);
    }

    const orgFeature = await prisma.organizationFeature.update({
      where: {
        organizationId_featureId: {
          organizationId,
          featureId: feature.id
        }
      },
      data: {
        customLimit: limit,
        customLimitType: limitType,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: new Date()
      }
    });

    await CacheService.delPattern(`features:org:${organizationId}:*`);

    return orgFeature;
  }

  // ==========================================
  // FEATURE MATRIX FOR PLANS
  // ==========================================

  /**
   * Get feature matrix for all plans
   */
  static async getFeatureMatrix() {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        featureOverrides: {
          include: { feature: true }
        }
      }
    });

    const features = await this.getAllFeatures();

    // Build matrix
    const matrix = {
      features: features.map(f => ({
        code: f.code,
        name: f.name,
        category: f.category,
        isCore: f.isCore,
        isPremium: f.isPremium,
        isAddOn: f.isAddOn
      })),
      plans: plans.map(plan => {
        const overrideMap = new Map(
          plan.featureOverrides.map(o => [o.feature.code, o])
        );

        return {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          features: features.reduce((acc, f) => {
            const override = overrideMap.get(f.code);
            acc[f.code] = {
              included: f.isCore || plan.includedFeatures.includes(f.code) || override?.isEnabled,
              limit: override?.limit,
              limitType: override?.limitType
            };
            return acc;
          }, {})
        };
      })
    };

    return matrix;
  }
}

module.exports = FeatureService;
