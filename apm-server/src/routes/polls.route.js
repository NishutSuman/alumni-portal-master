// src/routes/polls.route.js
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

// Poll-specific middleware
const {
  validateCreatePoll,
  validateUpdatePoll,
  validateVotePoll,
  validatePollIdParam,
  validatePollListQuery,
  validatePollAccess,
  validatePollAvailable,
  validateUserVoteEligibility,
  validatePollOptions,
  validatePollModifyPermission,
  validatePollHasNoVotes
} = require('../middleware/validation/poll.validation.middleware');

const {
  cachePollsList,
  cachePollDetails,
  cachePollResults,
  cachePollStats,
  cacheUserVotes,
  cacheActivePolls,
  autoInvalidatePollCaches,
  autoInvalidatePollVoteCaches
} = require('../middleware/cache/poll.cache.middleware');

// ============================================
// CONTROLLER IMPORTS
// ============================================
const pollController = require('../controllers/poll/poll.controller');

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Get all polls (public view with optional auth)
 * GET /api/polls
 * Access: Public (enhanced with auth)
 */
router.get('/',
  [
    optionalAuth,
    validatePollListQuery,
    cachePollsList
  ],
  asyncHandler(pollController.getPolls)
);

/**
 * Get active polls only
 * GET /api/polls/active
 * Access: Public
 */
router.get('/active',
  [
    optionalAuth,
    cacheActivePolls
  ],
  asyncHandler(pollController.getActivePolls)
);

/**
 * Get single poll details with results
 * GET /api/polls/:pollId
 * Access: Public (enhanced with auth)
 */
router.get('/:pollId',
  [
    optionalAuth,
    validatePollIdParam,
    validatePollAccess,
    cachePollDetails
  ],
  asyncHandler(pollController.getPoll)
);

/**
 * Get poll results only
 * GET /api/polls/:pollId/results
 * Access: Public
 */
router.get('/:pollId/results',
  [
    validatePollIdParam,
    validatePollAccess,
    cachePollResults
  ],
  asyncHandler(pollController.getPollResults)
);

// ============================================
// AUTHENTICATED USER ROUTES
// ============================================

/**
 * Get user's vote history
 * GET /api/polls/my-votes
 * Access: Authenticated users
 */
router.get('/my/votes',
  [
    authenticateToken,
    requireAlumniVerification,
    cacheUserVotes
  ],
  asyncHandler(pollController.getUserVotes)
);

/**
 * Vote in a poll
 * POST /api/polls/:pollId/vote
 * Access: Authenticated users
 */
router.post('/:pollId/vote',
  [
    authenticateToken,
    requireAlumniVerification,
    validatePollIdParam,
    validatePollAccess,
    validatePollAvailable,
    validateVotePoll,
    validatePollOptions,
    // Note: Not checking validateUserVoteEligibility here because users can change votes
    autoInvalidatePollVoteCaches
  ],
  asyncHandler(pollController.votePoll)
);

// ============================================
// ADMIN ROUTES (SUPER_ADMIN ONLY)
// All management routes require SUPER_ADMIN access
// ============================================

/**
 * Get poll statistics (admin only)
 * GET /api/polls/statistics
 * Access: SUPER_ADMIN
 */
router.get('/admin/statistics',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    cachePollStats
  ],
  asyncHandler(pollController.getPollStatistics)
);

/**
 * Create new poll
 * POST /api/polls
 * Access: SUPER_ADMIN
 */
router.post('/',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validateCreatePoll,
    autoInvalidatePollCaches
  ],
  asyncHandler(pollController.createPoll)
);

/**
 * Update poll
 * PUT /api/polls/:pollId
 * Access: SUPER_ADMIN or poll creator
 */
router.put('/:pollId',
  [
    authenticateToken,
    requireAlumniVerification,
    validatePollIdParam,
    validatePollAccess,
    validatePollModifyPermission,
    validateUpdatePoll,
    autoInvalidatePollCaches
  ],
  asyncHandler(pollController.updatePoll)
);

/**
 * Delete poll (only if no votes)
 * DELETE /api/polls/:pollId
 * Access: SUPER_ADMIN or poll creator
 */
router.delete('/:pollId',
  [
    authenticateToken,
    requireAlumniVerification,
    validatePollIdParam,
    validatePollAccess,
    validatePollModifyPermission,
    validatePollHasNoVotes,
    autoInvalidatePollCaches
  ],
  asyncHandler(pollController.deletePoll)
);

// ============================================
// ADMIN FORCE DELETE (WITH VOTES)
// Special route for admin to delete polls even with votes
// ============================================

/**
 * Force delete poll (admin override)
 * DELETE /api/polls/:pollId/force
 * Access: SUPER_ADMIN only
 */
router.delete('/:pollId/force',
  [
    authenticateToken,
    requireRole('SUPER_ADMIN'),
    validatePollIdParam,
    validatePollAccess,
    autoInvalidatePollCaches
  ],
  asyncHandler(pollController.deletePoll)
);

// ============================================
// ERROR HANDLING
// ============================================

// Handle undefined poll routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Poll route not found: ${req.method} ${req.baseUrl}${req.path}`,
    availableRoutes: {
      polls: 'GET /api/polls',
      activePPols: 'GET /api/polls/active',
      pollDetails: 'GET /api/polls/:pollId',
      pollResults: 'GET /api/polls/:pollId/results',
      vote: 'POST /api/polls/:pollId/vote',
      myVotes: 'GET /api/polls/my/votes',
      createPoll: 'POST /api/polls',
      statistics: 'GET /api/polls/admin/statistics'
    }
  });
});

module.exports = router;