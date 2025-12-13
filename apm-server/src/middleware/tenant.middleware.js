// src/middleware/tenant.middleware.js
// Multi-tenant middleware for organization isolation

const { prisma } = require('../config/database');

/**
 * Tenant Middleware
 *
 * Extracts tenant context from X-Tenant-Code header and attaches to request.
 * Provides backward compatibility for single-tenant deployments.
 *
 * Usage:
 * - Multi-tenant: Client sends X-Tenant-Code header with organization code
 * - Single-tenant: If only one organization exists, auto-selects it
 * - Developer mode: DEVELOPER role users can access any tenant
 */

/**
 * Extract and validate tenant from request
 * Attaches req.tenant with organization data
 */
const tenantMiddleware = async (req, res, next) => {
  try {
    const tenantCode = req.headers['x-tenant-code'];

    // If tenant code is provided in header
    if (tenantCode) {
      const organization = await prisma.organization.findFirst({
        where: {
          tenantCode: { equals: tenantCode, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          shortName: true,
          tenantCode: true,
          isActive: true,
          isMaintenanceMode: true,
          maintenanceMessage: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          maxUsers: true,
          storageQuotaMB: true,
        },
      });

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found. Please check your organization code.',
          code: 'TENANT_NOT_FOUND',
        });
      }

      // Check if organization is active
      if (!organization.isActive) {
        return res.status(403).json({
          success: false,
          message: 'This organization is currently inactive. Please contact support.',
          code: 'TENANT_INACTIVE',
        });
      }

      // Check subscription status
      if (organization.subscriptionStatus === 'EXPIRED') {
        return res.status(403).json({
          success: false,
          message: 'Organization subscription has expired. Please contact administrator.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
      }

      if (organization.subscriptionStatus === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: 'Organization subscription is suspended. Please contact support.',
          code: 'SUBSCRIPTION_SUSPENDED',
        });
      }

      // Check maintenance mode (will be bypassed for admins later in auth middleware)
      req.tenantMaintenanceMode = organization.isMaintenanceMode;
      req.tenantMaintenanceMessage = organization.maintenanceMessage;

      // Attach tenant to request
      req.tenant = organization;
      return next();
    }

    // No tenant code provided - check for single-tenant mode (backward compatibility)
    const organizationCount = await prisma.organization.count();

    if (organizationCount === 1) {
      // Single-tenant mode: auto-select the only organization
      const organization = await prisma.organization.findFirst({
        select: {
          id: true,
          name: true,
          shortName: true,
          tenantCode: true,
          isActive: true,
          isMaintenanceMode: true,
          maintenanceMessage: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          maxUsers: true,
          storageQuotaMB: true,
        },
      });

      req.tenant = organization;
      req.tenantMaintenanceMode = organization?.isMaintenanceMode || false;
      req.tenantMaintenanceMessage = organization?.maintenanceMessage;
      return next();
    }

    if (organizationCount === 0) {
      // No organizations exist yet - allow request to proceed (for initial setup)
      req.tenant = null;
      return next();
    }

    // Multiple organizations exist but no tenant code provided
    return res.status(400).json({
      success: false,
      message: 'X-Tenant-Code header is required for multi-tenant access.',
      code: 'TENANT_CODE_REQUIRED',
    });

  } catch (error) {
    console.error('Tenant middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process tenant information.',
      code: 'TENANT_ERROR',
    });
  }
};

/**
 * Optional tenant middleware - doesn't fail if no tenant
 * Used for public endpoints that may or may not need tenant context
 */
const optionalTenantMiddleware = async (req, res, next) => {
  try {
    // Case-insensitive header lookup (Express lowercases all headers)
    const tenantCode = req.headers['x-tenant-code'] || req.get('X-Tenant-Code');

    console.log('🏢 Tenant middleware - Header check:', {
      tenantCode,
      allHeaders: Object.keys(req.headers).filter(h => h.includes('tenant')),
      path: req.path
    });

    if (tenantCode) {
      const organization = await prisma.organization.findFirst({
        where: {
          tenantCode: { equals: tenantCode, mode: 'insensitive' },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          shortName: true,
          tenantCode: true,
          isActive: true,
          isMaintenanceMode: true,
          subscriptionStatus: true,
        },
      });

      console.log('🏢 Tenant middleware - Organization lookup:', {
        tenantCode,
        found: !!organization,
        orgName: organization?.name,
        orgTenantCode: organization?.tenantCode
      });

      if (organization) {
        req.tenant = organization;
      }
    } else {
      // Try single-tenant fallback
      const organizationCount = await prisma.organization.count();
      console.log('🏢 Tenant middleware - Single-tenant fallback:', {
        orgCount: organizationCount
      });

      if (organizationCount === 1) {
        const organization = await prisma.organization.findFirst({
          select: {
            id: true,
            name: true,
            shortName: true,
            tenantCode: true,
            isActive: true,
            isMaintenanceMode: true,
            subscriptionStatus: true,
          },
        });
        console.log('🏢 Tenant middleware - Found organization:', {
          id: organization?.id,
          name: organization?.name
        });
        req.tenant = organization;
      } else if (organizationCount > 1) {
        console.log('⚠️  Multiple organizations found but no tenant code provided');
      } else {
        console.log('⚠️  No organizations found in database');
      }
    }

    next();
  } catch (error) {
    console.error('Optional tenant middleware error:', error);
    // Don't fail, just proceed without tenant
    next();
  }
};

/**
 * Maintenance mode check middleware
 * Should be used after auth middleware to allow admin bypass
 */
const checkMaintenanceMode = (req, res, next) => {
  // Skip if no tenant or not in maintenance mode
  if (!req.tenant || !req.tenantMaintenanceMode) {
    return next();
  }

  // Allow SUPER_ADMIN and DEVELOPER to bypass maintenance mode
  if (req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'DEVELOPER')) {
    return next();
  }

  return res.status(503).json({
    success: false,
    message: req.tenantMaintenanceMessage || 'System is under maintenance. Please try again later.',
    code: 'MAINTENANCE_MODE',
  });
};

/**
 * Developer-only middleware
 * Allows cross-tenant access for platform developers
 */
const requireDeveloper = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
  }

  if (req.user.role !== 'DEVELOPER') {
    return res.status(403).json({
      success: false,
      message: 'Developer access required',
      code: 'DEVELOPER_REQUIRED',
    });
  }

  next();
};

/**
 * Get tenant ID helper
 * Returns organization ID from request, with null fallback
 */
const getTenantId = (req) => {
  return req.tenant?.id || null;
};

/**
 * Build tenant filter for Prisma queries
 * Returns { organizationId: id } or empty object for backward compatibility
 */
const getTenantFilter = (req) => {
  if (req.tenant?.id) {
    return { organizationId: req.tenant.id };
  }
  return {};
};

/**
 * Auto-selecting tenant middleware based on environment
 * Uses enforcing middleware in production, optional in development
 */
const autoTenantMiddleware = async (req, res, next) => {
  // Use enforcing middleware if ENFORCE_TENANT is set to 'true'
  // or in production with multi-tenant mode
  const enforceMultiTenant = process.env.ENFORCE_TENANT === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.MULTI_TENANT_MODE === 'true');

  if (enforceMultiTenant) {
    return tenantMiddleware(req, res, next);
  }
  return optionalTenantMiddleware(req, res, next);
};

module.exports = {
  tenantMiddleware,
  optionalTenantMiddleware,
  autoTenantMiddleware,
  checkMaintenanceMode,
  requireDeveloper,
  getTenantId,
  getTenantFilter,
};
