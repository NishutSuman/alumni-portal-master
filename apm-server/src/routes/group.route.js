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
} = require('../middleware/auth.middleware');
const { requireAlumniVerification } = require('../middleware/alumniVerification.middleware');

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
  validateGroupNameUnique,
  validateGroupAccess,
  validateMemberRole,
  validateUserForMembership,
  validateMemberExists
} = require('../middleware/group.validation.middleware');

const {
  cacheGroupsList,
  cacheGroupDetails,
  cacheGroupMembers,
  cacheGroupStats,
  cachePublicGroups,
  autoInvalidateGroupCaches,
  autoInvalidateGroupMemberCaches
} = require('../middleware/group.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const groupController = require('../controllers/group.controller');

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
// PROTECTED ROUTES (SUPER_ADMIN ONLY)
// All management routes require SUPER_ADMIN access
// ============================================
router.use(authenticateToken);
router.use(requireRole('SUPER_ADMIN'));

// ============================================
// GROUP MANAGEMENT ROUTES
// ============================================

/**
 * Get all groups with filtering and pagination
 * GET /api/groups
 * Access: SUPER_ADMIN
 */
router.get('/',
  [
    cacheGroupsList
  ],
  asyncHandler(groupController.getGroups)
);

/**
 * Get group statistics
 * GET /api/groups/statistics
 * Access: SUPER_ADMIN
 */
router.get('/statistics',
  [
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
    validateReorderGroups,
    autoInvalidateGroupCaches
  ],
  asyncHandler(groupController.reorderGroups)
);

/**
 * Get single group with details and members
 * GET /api/groups/:groupId
 * Access: SUPER_ADMIN
 */
router.get('/:groupId',
  [
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
 * Access: SUPER_ADMIN
 */
router.get('/:groupId/members',
  [
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
    validateGroupIdParam,
    validateGroupAccess,
    validateAddMember,
    validateMemberRole,
    validateUserForMembership,
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
    validateGroupIdParam,
    validateUserIdParam,
    validateGroupAccess,
    validateMemberExists,
    validateUpdateMember,
    validateMemberRole,
    autoInvalidateGroupMemberCaches
  ],
  asyncHandler(groupController.updateGroupMember)
);

/**
 * Remove member from group
 * DELETE /api/groups/:groupId/members/:userId
 * Access: SUPER_ADMIN
 */
router.delete('/:groupId/members/:userId',
  [
    validateGroupIdParam,
    validateUserIdParam,
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