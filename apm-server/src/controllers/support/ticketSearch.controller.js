const TicketSearchService = require('../../services/ticket/ticketSearch.service');
const TicketService = require('../../services/ticket/ticket.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * Perform advanced search
 * POST /api/tickets/search
 */
const performAdvancedSearch = async (req, res) => {
  try {
    const searchCriteria = req.body;
    const userId = req.user.id;
    
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isAdmin = user.role === 'SUPER_ADMIN';
    
    const results = await TicketSearchService.performAdvancedSearch(
      userId,
      searchCriteria,
      isAdmin
    );
    
    return successResponse(
      res,
      results,
      'Search completed successfully'
    );
  } catch (error) {
    console.error('Advanced search error:', error);
    return errorResponse(res, error.message || 'Search failed', 500);
  }
};

/**
 * Get search suggestions
 * GET /api/tickets/search/suggestions
 */
const getSearchSuggestions = async (req, res) => {
  try {
    const { q } = req.query; // Partial search query
    const userId = req.user.id;
    
    if (!q || q.length < 2) {
      return successResponse(res, [], 'No suggestions for short queries');
    }
    
    const suggestions = await TicketSearchService.getSearchSuggestions(userId, q);
    
    return successResponse(
      res,
      suggestions,
      'Search suggestions retrieved successfully'
    );
  } catch (error) {
    console.error('Get search suggestions error:', error);
    return errorResponse(res, 'Failed to get search suggestions', 500);
  }
};

/**
 * Get popular searches (for admin analytics)
 * GET /api/tickets/admin/search/popular
 */
const getPopularSearches = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const popularSearches = await TicketSearchService.getPopularSearches(parseInt(limit));
    
    return successResponse(
      res,
      popularSearches,
      'Popular searches retrieved successfully'
    );
  } catch (error) {
    console.error('Get popular searches error:', error);
    return errorResponse(res, 'Failed to retrieve popular searches', 500);
  }
};

/**
 * Save search filter
 * POST /api/tickets/filters
 */
const saveFilter = async (req, res) => {
  try {
    const filterData = req.body;
    const userId = req.user.id;
    
    const savedFilter = await TicketSearchService.saveFilter(userId, filterData);
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'ticket_filter_saved',
        details: {
          filterId: savedFilter.id,
          filterName: savedFilter.name,
          isDefault: savedFilter.isDefault
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      savedFilter,
      'Filter saved successfully',
      201
    );
  } catch (error) {
    console.error('Save filter error:', error);
    return errorResponse(res, error.message || 'Failed to save filter', 500);
  }
};

/**
 * Get user's saved filters
 * GET /api/tickets/filters
 */
const getUserFilters = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const filters = await TicketSearchService.getUserFilters(userId);
    
    return successResponse(
      res,
      filters,
      'Saved filters retrieved successfully'
    );
  } catch (error) {
    console.error('Get user filters error:', error);
    return errorResponse(res, 'Failed to retrieve saved filters', 500);
  }
};

/**
 * Use saved filter
 * POST /api/tickets/filters/:filterId/apply
 */
const applyFilter = async (req, res) => {
  try {
    const { filterId } = req.params;
    const userId = req.user.id;
    
    const filter = await TicketSearchService.useFilter(filterId, userId);
    
    // Apply the filter to get results
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isAdmin = user.role === 'SUPER_ADMIN';
    const searchResults = await TicketSearchService.performAdvancedSearch(
      userId,
      filter.filterConfig,
      isAdmin
    );
    
    return successResponse(
      res,
      {
        filter,
        results: searchResults
      },
      'Filter applied successfully'
    );
  } catch (error) {
    console.error('Apply filter error:', error);
    return errorResponse(res, error.message || 'Failed to apply filter', 500);
  }
};

/**
 * Delete saved filter
 * DELETE /api/tickets/filters/:filterId
 */
const deleteFilter = async (req, res) => {
  try {
    const { filterId } = req.params;
    const userId = req.user.id;
    
    // Check ownership
    const filter = await prisma.ticketSavedFilter.findUnique({
      where: { id: filterId },
      select: { userId: true, name: true }
    });
    
    if (!filter) {
      return errorResponse(res, 'Filter not found', 404);
    }
    
    if (filter.userId !== userId) {
      return errorResponse(res, 'Permission denied', 403);
    }
    
    await prisma.ticketSavedFilter.delete({
      where: { id: filterId }
    });
    
    return successResponse(
      res,
      null,
      'Filter deleted successfully'
    );
  } catch (error) {
    console.error('Delete filter error:', error);
    return errorResponse(res, error.message || 'Failed to delete filter', 500);
  }
};

module.exports = {
  performAdvancedSearch,
  getSearchSuggestions,
  getPopularSearches,
  saveFilter,
  getUserFilters,
  applyFilter,
  deleteFilter
};
