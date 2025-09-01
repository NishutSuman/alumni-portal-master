const { prisma } = require('../../config/database');
const CacheService = require('../../config/redis');

class TicketSearchService {
  
  // ==========================================
  // ADVANCED SEARCH
  // ==========================================
  
  static async performAdvancedSearch(userId, searchCriteria, isAdmin = false) {
    const {
      query,           // Text search
      status,
      categoryId,
      priority,
      assignedToId,
      createdByBatch,
      dateFrom,
      dateTo,
      hasAttachments,
      tags,
      page = 1,
      limit = 20
    } = searchCriteria;
    
    const skip = (page - 1) * limit;
    
    // Build complex where clause
    const where = {
      // Admin can see all, users only their own
      ...(isAdmin ? {} : { userId }),
      
      // Status filter
      ...(status && { status }),
      
      // Category filter
      ...(categoryId && { categoryId }),
      
      // Priority filter
      ...(priority && { priority }),
      
      // Assignment filter
      ...(assignedToId && { assignedToId }),
      
      // Date range filter
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { createdAt: { ...where.createdAt, lte: new Date(dateTo) } }),
      
      // Attachment filter
      ...(hasAttachments && {
        OR: [
          { attachments: { some: {} } },
          { messages: { some: { attachments: { some: {} } } } }
        ]
      }),
      
      // Batch filter
      ...(createdByBatch && { user: { batch: parseInt(createdByBatch) } }),
      
      // Tags filter (if tags are implemented)
      ...(tags && tags.length > 0 && {
        tags: { hasEvery: tags }
      }),
      
      // Text search (full-text search)
      ...(query && {
        OR: [
          // Search in ticket content
          { subject: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { ticketNumber: { contains: query, mode: 'insensitive' } },
          
          // Search in user details
          { user: { fullName: { contains: query, mode: 'insensitive' } } },
          { user: { email: { contains: query, mode: 'insensitive' } } },
          
          // Search in messages (admin only for performance)
          ...(isAdmin ? [{
            messages: {
              some: {
                message: { contains: query, mode: 'insensitive' }
              }
            }
          }] : [])
        ]
      })
    };
    
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, batch: true }
          },
          category: {
            select: { id: true, name: true, icon: true }
          },
          assignedTo: {
            select: { id: true, fullName: true }
          },
          _count: {
            select: {
              messages: true,
              attachments: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { lastActivity: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.ticket.count({ where })
    ]);
    
    // Log search for history and analytics
    if (query) {
      await this.logSearch(userId, query, searchCriteria, total);
    }
    
    return {
      tickets,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        hasNext: skip + limit < total,
        hasPrevious: page > 1
      },
      searchCriteria
    };
  }
  
  // ==========================================
  // SAVED FILTERS
  // ==========================================
  
  static async saveFilter(userId, filterData) {
    const { name, description, filterConfig, isDefault } = filterData;
    
    // If setting as default, remove default from other filters
    if (isDefault) {
      await prisma.ticketSavedFilter.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }
    
    const savedFilter = await prisma.ticketSavedFilter.create({
      data: {
        userId,
        name: name.trim(),
        description: description?.trim(),
        filterConfig,
        isDefault: isDefault || false,
        usageCount: 0
      }
    });
    
    // Invalidate user's filter cache
    await CacheService.delPattern(`filters:user:${userId}:*`);
    
    return savedFilter;
  }
  
  static async getUserFilters(userId) {
    const cacheKey = `filters:user:${userId}:all`;
    const cached = await CacheService.get(cacheKey);
    
    if (cached) return cached;
    
    const filters = await prisma.ticketSavedFilter.findMany({
      where: { 
        OR: [
          { userId },
          { isShared: true }
        ]
      },
      orderBy: [
        { isDefault: 'desc' },
        { usageCount: 'desc' },
        { name: 'asc' }
      ]
    });
    
    await CacheService.set(cacheKey, filters, 1800); // 30 minutes
    return filters;
  }
  
  static async useFilter(filterId, userId) {
    const filter = await prisma.ticketSavedFilter.findUnique({
      where: { id: filterId }
    });
    
    if (!filter) {
      throw new Error('Filter not found');
    }
    
    // Permission check
    if (filter.userId !== userId && !filter.isShared) {
      throw new Error('Access denied to this filter');
    }
    
    // Update usage statistics
    await prisma.ticketSavedFilter.update({
      where: { id: filterId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });
    
    return filter;
  }
  
  // ==========================================
  // SEARCH UTILITIES
  // ==========================================
  
  static async logSearch(userId, searchQuery, searchCriteria, resultsCount) {
    try {
      await prisma.ticketSearchHistory.create({
        data: {
          userId,
          searchQuery,
          searchType: Object.keys(searchCriteria).length > 1 ? 'ADVANCED' : 'BASIC',
          filterConfig: searchCriteria,
          resultsCount
        }
      });
    } catch (error) {
      console.error('Error logging search:', error);
      // Don't throw - search logging failures shouldn't break search
    }
  }
  
  static async getSearchSuggestions(userId, partial) {
    // Get recent searches for suggestions
    const recentSearches = await prisma.ticketSearchHistory.findMany({
      where: {
        userId,
        searchQuery: {
          contains: partial,
          mode: 'insensitive'
        }
      },
      select: { searchQuery: true },
      distinct: ['searchQuery'],
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    return recentSearches.map(s => s.searchQuery);
  }
  
  static async getPopularSearches(limit = 10) {
    const popularSearches = await prisma.ticketSearchHistory.groupBy({
      by: ['searchQuery'],
      _count: { searchQuery: true },
      orderBy: { _count: { searchQuery: 'desc' } },
      take: limit,
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });
    
    return popularSearches;
  }
}

module.exports = TicketSearchService;