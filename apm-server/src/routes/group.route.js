// src/routes/groups.route.js
const express = require('express');
const router = express.Router();

// ============================================
// MIDDLEWARE IMPORTS
// ============================================
const { 
  authenticateToken, 
  requireRole,
  optionalAuth
} = require('../middleware/auth/auth.middleware');
const { requireAlumniVerification } = require('../middleware/auth/alumniVerification.middleware');

const { asyncHandler } = require('../utils/response');

// Group-specific middleware
const {
  validateCreateGroup,
  validateUpdateGroup,
  validateAddMember,
  validateUpdateMember,
  validateBulkMembers,
  validateReorderGroups,
  validateGroupIdParam,
  validateUserIdParam,
  validateGroupUserIdParams,
  validateGroupNameUnique,
  validateGroupAccess,
  validateMemberRole,
  validateRoleLimits,
  validateMemberExists
} = require('../middleware/validation/group.validation.middleware');

const {
  cacheGroupsList,
  cacheGroupDetails,
  cacheGroupMembers,
  cacheGroupStats,
  cachePublicGroups,
  autoInvalidateGroupCaches,
  autoInvalidateGroupMemberCaches
} = require('../middleware/cache/group.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const groupController = require('../controllers/group/group.controller');

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Get public groups (for website display)
 * GET /api/groups/public
 * Access: Public
 */
router.get('/public',
  [
    optionalAuth,
    cachePublicGroups
  ],
  asyncHandler(groupController.getPublicGroups)
);

// ============================================
// PROTECTED ROUTES - ALL AUTHENTICATED USERS
// ============================================
router.use(authenticateToken);

// ============================================
// GROUP MANAGEMENT ROUTES
// ============================================

/**
 * Get all groups with filtering and pagination
 * GET /api/groups
 * Access: USER, BATCH_ADMIN, SUPER_ADMIN
 */
router.get('/',
  [
    requireRole(['USER', 'BATCH_ADMIN', 'SUPER_ADMIN']),
    cacheGroupsList
  ],
  asyncHandler(groupController.getGroups)
);

/**
 * Get group statistics
 * GET /api/groups/statistics
 * Access: BATCH_ADMIN, SUPER_ADMIN
 */
router.get('/statistics',
  [
    requireRole(['BATCH_ADMIN', 'SUPER_ADMIN']),
    cacheGroupStats
  ],
  asyncHandler(groupController.getGroupStatistics)
);

/**
 * Create new group
 * POST /api/groups
 * Access: SUPER_ADMIN
 */
router.post('/',
  [
    requireRole('SUPER_ADMIN'),
    validateCreateGroup,
    validateGroupNameUnique,
    autoInvalidateGroupCaches
  ],
  asyncHandler(groupController.createGroup)
);

/**
 * Reorder groups
 * POST /api/groups/reorder
 * Access: SUPER_ADMIN
 */
router.post('/reorder',
  [
    requireRole('SUPER_ADMIN'),
    validateReorderGroups,
    autoInvalidateGroupCaches
  ],
  asyncHandler(groupController.reorderGroups)
);

/**
 * Get single group with details and members
 * GET /api/groups/:groupId
 * Access: USER, BATCH_ADMIN, SUPER_ADMIN
 */
router.get('/:groupId',
  [
    requireRole(['USER', 'BATCH_ADMIN', 'SUPER_ADMIN']),
    validateGroupIdParam,
    validateGroupAccess,
    cacheGroupDetails
  ],
  asyncHandler(groupController.getGroup)
);

/**
 * Update group details
 * PUT /api/groups/:groupId
 * Access: SUPER_ADMIN
 */
router.put('/:groupId',
  [
    requireRole('SUPER_ADMIN'),
    validateGroupIdParam,
    validateGroupAccess,
    validateUpdateGroup,
    validateGroupNameUnique,
    autoInvalidateGroupCaches
  ],
  asyncHandler(groupController.updateGroup)
);

/**
 * Delete group
 * DELETE /api/groups/:groupId
 * Access: SUPER_ADMIN
 */
router.delete('/:groupId',
  [
    requireRole('SUPER_ADMIN'),
    validateGroupIdParam,
    validateGroupAccess,
    autoInvalidateGroupCaches
  ],
  asyncHandler(groupController.deleteGroup)
);

// ============================================
// GROUP MEMBER MANAGEMENT ROUTES
// ============================================

/**
 * Get group members with filtering
 * GET /api/groups/:groupId/members
 * Access: USER, BATCH_ADMIN, SUPER_ADMIN
 */
router.get('/:groupId/members',
  [
    requireRole(['USER', 'BATCH_ADMIN', 'SUPER_ADMIN']),
    validateGroupIdParam,
    validateGroupAccess,
    cacheGroupMembers
  ],
  asyncHandler(groupController.getGroupMembers)
);

/**
 * Add member to group
 * POST /api/groups/:groupId/members
 * Access: SUPER_ADMIN
 */
router.post('/:groupId/members',
  [
    requireRole('SUPER_ADMIN'),
    validateGroupIdParam,
    validateGroupAccess,
    validateAddMember,
    validateMemberRole,
    validateRoleLimits,
    autoInvalidateGroupMemberCaches
  ],
  asyncHandler(groupController.addGroupMember)
);

/**
 * Bulk member operations (add, remove, update multiple members)
 * POST /api/groups/:groupId/members/bulk
 * Access: SUPER_ADMIN
 */
router.post('/:groupId/members/bulk',
  [
    requireRole('SUPER_ADMIN'),
    validateGroupIdParam,
    validateGroupAccess,
    validateBulkMembers,
    autoInvalidateGroupMemberCaches
  ],
  asyncHandler(groupController.bulkMemberOperations)
);

/**
 * Update group member (role, status)
 * PUT /api/groups/:groupId/members/:userId
 * Access: SUPER_ADMIN
 */
router.put('/:groupId/members/:userId',
  [
    requireRole('SUPER_ADMIN'),
    validateGroupUserIdParams,
    validateGroupAccess,
    validateMemberExists,
    validateUpdateMember,
    validateMemberRole,
    autoInvalidateGroupMemberCaches
  ],
  asyncHandler(groupController.updateGroupMember)
);

/**
 * Remove member from group (update member status to inactive)
 * PUT /api/groups/:groupId/members/:userId/remove
 * Access: SUPER_ADMIN
 */
router.put('/:groupId/members/:userId/remove',
  [
    requireRole('SUPER_ADMIN'),
    validateGroupUserIdParams,
    validateGroupAccess,
    validateMemberExists,
    autoInvalidateGroupMemberCaches
  ],
  asyncHandler(groupController.removeGroupMember)
);

// ============================================
// ERROR HANDLING
// ============================================

// Handle undefined group routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Group route not found: ${req.method} ${req.baseUrl}${req.path}`,
    availableRoutes: {
      groups: 'GET /api/groups',
      publicGroups: 'GET /api/groups/public',
      groupDetails: 'GET /api/groups/:groupId',
      createGroup: 'POST /api/groups',
      members: 'GET /api/groups/:groupId/members',
      addMember: 'POST /api/groups/:groupId/members',
      statistics: 'GET /api/groups/statistics'
    }
  });
});

module.exports = router;