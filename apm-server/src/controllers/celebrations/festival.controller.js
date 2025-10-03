// src/controllers/celebrations/festival.controller.js
const FestivalService = require('../../services/festival/FestivalService');
const FestivalSyncService = require('../../services/festival/FestivalSyncService');
const BirthdayService = require('../../services/birthday/BirthdayService');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Get today's festivals
 * GET /api/celebrations/festivals/today
 * Access: Public (with optional auth)
 */
const getTodaysFestivals = async (req, res) => {
  try {
    const festivals = await FestivalService.getTodaysFestivals();
    
    return successResponse(
      res,
      {
        festivals,
        count: festivals.length,
        date: new Date().toISOString().split('T')[0]
      },
      festivals.length > 0 
        ? `Found ${festivals.length} festival(s) today`
        : 'No festivals today'
    );
  } catch (error) {
    console.error('Get today\'s festivals error:', error);
    return errorResponse(res, 'Failed to fetch today\'s festivals', 500);
  }
};

/**
 * Get upcoming festivals
 * GET /api/celebrations/festivals/upcoming
 * Access: Public (with optional auth)
 */
const getUpcomingFestivals = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const upcomingFestivals = await FestivalService.getUpcomingFestivals(parseInt(days));
    
    return successResponse(
      res,
      {
        upcomingFestivals,
        lookAheadDays: parseInt(days)
      },
      `Found festivals in next ${days} days`
    );
  } catch (error) {
    console.error('Get upcoming festivals error:', error);
    return errorResponse(res, 'Failed to fetch upcoming festivals', 500);
  }
};

/**
 * Get combined today's celebrations (birthdays + festivals)
 * GET /api/celebrations/today
 * Access: Authenticated users
 */
const getTodaysCelebrations = async (req, res) => {
  try {
    const celebrations = await FestivalService.getTodaysCelebrations();
    
    return successResponse(res, celebrations, 'Today\'s celebrations retrieved successfully');
  } catch (error) {
    console.error('Get today\'s celebrations error:', error);
    return errorResponse(res, 'Failed to fetch today\'s celebrations', 500);
  }
};

/**
 * Search festivals
 * GET /api/celebrations/festivals/search
 * Access: Authenticated users
 */
const searchFestivals = async (req, res) => {
  try {
    const { q: query, festivalType, religion, priority, year, limit } = req.query;
    
    const festivals = await FestivalService.searchFestivals(query, {
      festivalType,
      religion,
      priority,
      year: year ? parseInt(year) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });
    
    return successResponse(
      res,
      {
        festivals,
        query,
        filters: { festivalType, religion, priority, year },
        count: festivals.length
      },
      `Found ${festivals.length} festivals`
    );
  } catch (error) {
    console.error('Search festivals error:', error);
    return errorResponse(res, 'Failed to search festivals', 500);
  }
};

/**
 * Get festival calendar for year
 * GET /api/celebrations/festivals/calendar
 * Access: Authenticated users
 */
const getFestivalCalendar = async (req, res) => {
  try {
    const { year } = req.query;
    const calendar = await FestivalService.getFestivalCalendar(
      year ? parseInt(year) : undefined
    );
    
    // Return calendar with updated structure
    return successResponse(res, calendar, 'Festival calendar retrieved successfully');
  } catch (error) {
    console.error('Get festival calendar error:', error);
    return errorResponse(res, 'Failed to fetch festival calendar', 500);
  }
};

// ============================================
// ADMIN CONTROLLERS
// ============================================

/**
 * Get festival statistics (Admin)
 * GET /api/celebrations/admin/festivals/stats
 * Access: SUPER_ADMIN
 */
const getFestivalStats = async (req, res) => {
  try {
    const stats = await FestivalService.getFestivalStats();
    
    return successResponse(res, stats, 'Festival statistics retrieved successfully');
  } catch (error) {
    console.error('Get festival stats error:', error);
    return errorResponse(res, 'Failed to fetch festival statistics', 500);
  }
};

/**
 * Get celebration summary (Admin dashboard)
 * GET /api/celebrations/admin/summary
 * Access: SUPER_ADMIN
 */
const getCelebrationSummary = async (req, res) => {
  try {
    const summary = await FestivalService.getCelebrationSummary();
    
    return successResponse(res, summary, 'Celebration summary retrieved successfully');
  } catch (error) {
    console.error('Get celebration summary error:', error);
    return errorResponse(res, 'Failed to fetch celebration summary', 500);
  }
};

/**
 * Toggle festival notifications (Admin)
 * PUT /api/celebrations/admin/festivals/:festivalId/notifications
 * Access: SUPER_ADMIN
 */
const toggleFestivalNotifications = async (req, res) => {
  try {
    const { festivalId } = req.params;
    const { enabled } = req.body;
    
    const result = await FestivalService.toggleFestivalNotifications(festivalId, enabled);
    
    return successResponse(res, result, `Festival notifications ${enabled ? 'enabled' : 'disabled'} successfully`);
  } catch (error) {
    console.error('Toggle festival notifications error:', error);
    return errorResponse(res, 'Failed to toggle festival notifications', 500);
  }
};

/**
 * Manually trigger festival sync (Admin)
 * POST /api/celebrations/admin/festivals/sync
 * Access: SUPER_ADMIN
 */
const triggerFestivalSync = async (req, res) => {
  try {
    const result = await FestivalSyncService.runManualSync();
    
    return successResponse(res, result, 'Festival sync triggered successfully');
  } catch (error) {
    console.error('Trigger festival sync error:', error);
    return errorResponse(res, 'Failed to trigger festival sync', 500);
  }
};

/**
 * Get festival sync history (Admin)
 * GET /api/celebrations/admin/festivals/sync-history
 * Access: SUPER_ADMIN
 */
const getFestivalSyncHistory = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const history = await FestivalSyncService.getSyncHistory(parseInt(limit));
    
    return successResponse(res, history, 'Festival sync history retrieved successfully');
  } catch (error) {
    console.error('Get festival sync history error:', error);
    return errorResponse(res, 'Failed to fetch festival sync history', 500);
  }
};

/**
 * Get API usage statistics (Admin)
 * GET /api/celebrations/admin/api-usage
 * Access: SUPER_ADMIN
 */
const getAPIUsageStats = async (req, res) => {
  try {
    const stats = await FestivalSyncService.getAPIUsageStats();
    
    return successResponse(res, stats, 'API usage statistics retrieved successfully');
  } catch (error) {
    console.error('Get API usage stats error:', error);
    return errorResponse(res, 'Failed to fetch API usage statistics', 500);
  }
};

/**
 * Get festival notification history (Admin)
 * GET /api/celebrations/admin/festivals/notifications
 * Access: SUPER_ADMIN
 */
const getFestivalNotificationHistory = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await FestivalService.getFestivalNotificationHistory(parseInt(limit));
    
    return successResponse(res, history, 'Festival notification history retrieved successfully');
  } catch (error) {
    console.error('Get festival notification history error:', error);
    return errorResponse(res, 'Failed to fetch festival notification history', 500);
  }
};

/**
 * Get birthday notification history (Admin)  
 * GET /api/celebrations/admin/birthdays/notifications
 * Access: SUPER_ADMIN
 */
const getBirthdayNotificationHistory = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await BirthdayService.getBirthdayNotificationHistory(parseInt(limit));
    
    return successResponse(res, history, 'Birthday notification history retrieved successfully');
  } catch (error) {
    console.error('Get birthday notification history error:', error);
    return errorResponse(res, 'Failed to fetch birthday notification history', 500);
  }
};

module.exports = {
  // Public/User endpoints
  getTodaysFestivals,
  getUpcomingFestivals,
  getTodaysCelebrations,
  searchFestivals,
  getFestivalCalendar,
  
  // Admin endpoints
  getFestivalStats,
  getCelebrationSummary,
  toggleFestivalNotifications,
  triggerFestivalSync,
  getFestivalSyncHistory,
  getAPIUsageStats,
  getFestivalNotificationHistory,
  getBirthdayNotificationHistory
};