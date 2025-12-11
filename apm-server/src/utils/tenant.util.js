// src/utils/tenant.util.js
// Multi-tenant query utilities for Prisma

/**
 * Get tenant ID from request
 * @param {Object} req - Express request object
 * @returns {String|null} - Organization ID or null
 */
const getTenantId = (req) => {
  return req.tenant?.id || null;
};

/**
 * Get tenant filter object for Prisma queries
 * Returns empty object for backward compatibility if no tenant
 * @param {Object} req - Express request object
 * @returns {Object} - Filter object with organizationId
 */
const getTenantFilter = (req) => {
  const tenantId = getTenantId(req);
  return tenantId ? { organizationId: tenantId } : {};
};

/**
 * Get tenant filter for where clause (same as getTenantFilter but clearer naming)
 * @param {Object} req - Express request object
 * @returns {Object} - Where clause filter
 */
const getTenantWhere = (req) => {
  return getTenantFilter(req);
};

/**
 * Merge tenant filter with existing where clause
 * @param {Object} req - Express request object
 * @param {Object} existingWhere - Existing where conditions
 * @returns {Object} - Merged where clause
 */
const withTenant = (req, existingWhere = {}) => {
  const tenantFilter = getTenantFilter(req);
  return { ...existingWhere, ...tenantFilter };
};

/**
 * Get tenant data object for creating new records
 * Falls back to user's organizationId if tenant middleware didn't run
 * @param {Object} req - Express request object
 * @param {Boolean} required - If true, throws error when no tenant (default: false for backward compatibility)
 * @returns {Object} - Object with organizationId for record creation
 */
const getTenantData = (req, required = false) => {
  // Priority: req.tenant?.id > req.user?.organizationId > null
  const tenantId = req.tenant?.id || req.user?.organizationId || null;

  if (required && !tenantId) {
    const error = new Error('Organization context is required. Please select an organization.');
    error.code = 'TENANT_REQUIRED';
    error.status = 400;
    throw error;
  }

  return tenantId ? { organizationId: tenantId } : {};
};

/**
 * Get required tenant ID (throws error if missing)
 * @param {Object} req - Express request object
 * @returns {String} - Organization ID
 * @throws {Error} - If no tenant context
 */
const getRequiredTenantId = (req) => {
  const tenantId = req.tenant?.id || req.user?.organizationId || null;

  if (!tenantId) {
    const error = new Error('Organization context is required. Please select an organization.');
    error.code = 'TENANT_REQUIRED';
    error.status = 400;
    throw error;
  }

  return tenantId;
};

/**
 * Get tenant connect object for Prisma relations
 * @param {Object} req - Express request object
 * @returns {Object|undefined} - Connect object or undefined
 */
const getTenantConnect = (req) => {
  const tenantId = getTenantId(req);
  return tenantId ? { organization: { connect: { id: tenantId } } } : undefined;
};

/**
 * Check if user belongs to tenant
 * @param {Object} req - Express request object
 * @param {Object} user - User object with organizationId
 * @returns {Boolean} - True if user belongs to tenant
 */
const userBelongsToTenant = (req, user) => {
  if (!req.tenant) return true; // No tenant context, allow access
  if (!user.organizationId) return true; // User not assigned to org, allow access
  return user.organizationId === req.tenant.id;
};

/**
 * Check if current user can access resource
 * DEVELOPER role can access any tenant
 * @param {Object} req - Express request object
 * @returns {Boolean} - True if access is allowed
 */
const canAccessResource = (req) => {
  if (!req.tenant) return true; // No tenant context
  if (req.user?.role === 'DEVELOPER') return true; // Developer access
  if (!req.user?.organizationId) return true; // User not assigned
  return req.user.organizationId === req.tenant.id;
};

/**
 * Get organization ID for the current request
 * Priority: req.tenant > req.user.organizationId > null
 * @param {Object} req - Express request object
 * @returns {String|null} - Organization ID
 */
const getOrganizationId = (req) => {
  return req.tenant?.id || req.user?.organizationId || null;
};

/**
 * Build tenant-aware Prisma query options
 * @param {Object} req - Express request object
 * @param {Object} options - Existing Prisma query options
 * @returns {Object} - Enhanced query options with tenant filter
 */
const buildTenantQuery = (req, options = {}) => {
  const tenantFilter = getTenantFilter(req);

  if (Object.keys(tenantFilter).length === 0) {
    return options;
  }

  return {
    ...options,
    where: {
      ...(options.where || {}),
      ...tenantFilter,
    },
  };
};

/**
 * Validate tenant access and throw error if denied
 * @param {Object} req - Express request object
 * @param {Object} resource - Resource with organizationId
 * @throws {Error} - If access denied
 */
const validateTenantAccess = (req, resource) => {
  if (!req.tenant) return; // No tenant context
  if (req.user?.role === 'DEVELOPER') return; // Developer access

  if (resource.organizationId && resource.organizationId !== req.tenant.id) {
    const error = new Error('Access denied. Resource belongs to different organization.');
    error.code = 'TENANT_ACCESS_DENIED';
    error.status = 403;
    throw error;
  }
};

/**
 * Check if in multi-tenant mode
 * @param {Object} req - Express request object
 * @returns {Boolean} - True if in multi-tenant mode
 */
const isMultiTenant = (req) => {
  return !!req.tenant;
};

/**
 * Get tenant info for logging/debugging
 * @param {Object} req - Express request object
 * @returns {Object} - Tenant info
 */
const getTenantInfo = (req) => {
  if (!req.tenant) {
    return { mode: 'single-tenant', tenantId: null };
  }

  return {
    mode: 'multi-tenant',
    tenantId: req.tenant.id,
    tenantCode: req.tenant.tenantCode,
    tenantName: req.tenant.name,
  };
};

/**
 * Get tenant code from request for email services
 * @param {Object} req - Express request object
 * @returns {String|null} - Tenant code or null
 */
const getTenantCode = (req) => {
  return req.tenant?.tenantCode || null;
};

/**
 * Get organization name from request
 * @param {Object} req - Express request object
 * @returns {String} - Organization name or default
 */
const getOrganizationName = (req) => {
  return req.tenant?.name || 'Alumni Portal';
};

/**
 * Get organization filter for querying the Organization model itself
 * NOTE: The Organization model uses 'id', not 'organizationId'
 * Use this when querying prisma.organization directly
 * @param {Object} req - Express request object
 * @returns {Object} - Filter object with id for Organization model
 */
const getOrganizationFilter = (req) => {
  const tenantId = getTenantId(req);
  return tenantId ? { id: tenantId } : {};
};

module.exports = {
  getTenantId,
  getTenantFilter,
  getTenantWhere,
  withTenant,
  getTenantData,
  getTenantConnect,
  userBelongsToTenant,
  canAccessResource,
  getOrganizationId,
  buildTenantQuery,
  validateTenantAccess,
  isMultiTenant,
  getTenantInfo,
  getOrganizationFilter,
  getTenantCode,
  getOrganizationName,
};
