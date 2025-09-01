// src/controllers/support/ticketAnalytics.controller.js
const TicketAnalyticsService = require('../../services/ticket/ticketAnalytics.service');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Get dashboard overview analytics
 * GET /api/tickets/admin/analytics/overview
 */
const getDashboardOverview = async (req, res) => {
  try {
    const overview = await TicketAnalyticsService.getDashboardOverview();
    
    return successResponse(
      res,
      overview,
      'Dashboard overview retrieved successfully'
    );
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve dashboard overview', 500);
  }
};

/**
 * Get category analysis
 * GET /api/tickets/admin/analytics/categories  
 */
const getCategoryAnalysis = async (req, res) => {
  try {
    const categoryAnalysis = await TicketAnalyticsService.getCategoryAnalysis();
    
    return successResponse(
      res,
      categoryAnalysis,
      'Category analysis retrieved successfully'
    );
  } catch (error) {
    console.error('Category analysis error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve category analysis', 500);
  }
};

/**
 * Get weekly trends
 * GET /api/tickets/admin/analytics/trends
 */
const getWeeklyTrends = async (req, res) => {
  try {
    const trends = await TicketAnalyticsService.getWeeklyTrends();
    
    return successResponse(
      res,
      { trends },
      'Weekly trends retrieved successfully'
    );
  } catch (error) {
    console.error('Weekly trends error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve weekly trends', 500);
  }
};

/**
 * Get admin performance metrics
 * GET /api/tickets/admin/analytics/performance
 */
const getAdminPerformance = async (req, res) => {
  try {
    const performance = await TicketAnalyticsService.getAdminPerformance();
    
    return successResponse(
      res,
      { admins: performance },
      'Admin performance metrics retrieved successfully'
    );
  } catch (error) {
    console.error('Admin performance error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve admin performance', 500);
  }
};

/**
 * Get priority distribution
 * GET /api/tickets/admin/analytics/priority-distribution
 */
const getPriorityDistribution = async (req, res) => {
  try {
    const distribution = await TicketAnalyticsService.getPriorityDistribution();
    
    return successResponse(
      res,
      { priorities: distribution },
      'Priority distribution retrieved successfully'
    );
  } catch (error) {
    console.error('Priority distribution error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve priority distribution', 500);
  }
};

/**
 * Get complete analytics dashboard data
 * GET /api/tickets/admin/analytics/complete
 */
const getCompleteAnalytics = async (req, res) => {
  try {
    const [
      overview,
      categoryAnalysis,
      weeklyTrends,
      adminPerformance,
      priorityDistribution
    ] = await Promise.all([
      TicketAnalyticsService.getDashboardOverview(),
      TicketAnalyticsService.getCategoryAnalysis(),
      TicketAnalyticsService.getWeeklyTrends(),
      TicketAnalyticsService.getAdminPerformance(),
      TicketAnalyticsService.getPriorityDistribution()
    ]);

    const analyticsData = {
      overview,
      categoryAnalysis,
      trends: weeklyTrends,
      adminPerformance,
      priorityDistribution,
      generatedAt: new Date()
    };
    
    return successResponse(
      res,
      analyticsData,
      'Complete analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Complete analytics error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve complete analytics', 500);
  }
};

/**
 * Refresh analytics cache
 * POST /api/tickets/admin/analytics/refresh
 */
const refreshAnalyticsCache = async (req, res) => {
  try {
    await TicketAnalyticsService.invalidateAnalyticsCache();
    
    return successResponse(
      res,
      null,
      'Analytics cache refreshed successfully'
    );
  } catch (error) {
    console.error('Refresh analytics cache error:', error);
    return errorResponse(res, 'Failed to refresh analytics cache', 500);
  }
};

module.exports = {
  getDashboardOverview,
  getCategoryAnalysis,
  getWeeklyTrends,
  getAdminPerformance,
  getPriorityDistribution,
  getCompleteAnalytics,
  refreshAnalyticsCache
};