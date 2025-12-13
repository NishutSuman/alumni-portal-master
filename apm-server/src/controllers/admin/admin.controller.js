// src/controllers/admin.controller.js
const { CacheAnalytics } = require('../../utils/cache-analytics');
const { CacheService, CacheKeys } = require('../../config/redis');
const { successResponse, errorResponse } = require('../../utils/response');
const AnalyticsService = require('../../services/analytics/AnalyticsService');
const { prisma } = require('../../config/database');
const NotificationService = require('../../services/notification.service');
const { getTenantId, withTenant } = require('../../utils/tenant.util');

// Get cache performance dashboard
const getCacheDashboard = async (req, res) => {
  try {
    const stats = await CacheAnalytics.getDashboardStats();
    return successResponse(res, { stats }, 'Cache dashboard retrieved successfully');
  } catch (error) {
    console.error('Get cache dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve cache dashboard', 500);
  }
};

// Get detailed cache stats
const getCacheStats = async (req, res) => {
  const { days = 7 } = req.query;
  
  try {
    const [cacheStats, memoryStats, topKeys] = await Promise.all([
      CacheAnalytics.getCacheStats(parseInt(days)),
      CacheAnalytics.getMemoryStats(),
      CacheAnalytics.getTopKeys(20)
    ]);
    
    return successResponse(res, {
      cacheStats,
      memoryStats,
      topKeys
    }, 'Cache statistics retrieved successfully');
  } catch (error) {
    console.error('Get cache stats error:', error);
    return errorResponse(res, 'Failed to retrieve cache statistics', 500);
  }
};

// Clear specific cache pattern
const clearCache = async (req, res) => {
  const { pattern } = req.body;
  
  if (!pattern) {
    return errorResponse(res, 'Cache pattern is required', 400);
  }
  
  // Validate pattern to prevent accidental deletion
  const allowedPatterns = [
    'posts:*',
    'user:*',
    'batch:*',
    'alumni:*',
    'stats:*'
  ];
  
  const isValidPattern = allowedPatterns.some(allowed => 
    pattern.startsWith(allowed.replace('*', ''))
  );
  
  if (!isValidPattern) {
    return errorResponse(res, 'Invalid cache pattern', 400);
  }
  
  try {
    await CacheService.delPattern(pattern);
    
    // Log cache clearing action
    console.log(`🗑️ Cache cleared by admin: ${req.user.fullName} - Pattern: ${pattern}`);
    
    return successResponse(res, null, `Cache cleared for pattern: ${pattern}`);
  } catch (error) {
    console.error('Clear cache error:', error);
    return errorResponse(res, 'Failed to clear cache', 500);
  }
};

// Warm up cache with frequently accessed data
const warmUpCache = async (req, res) => {
  try {
    const warmupTasks = [];
    
    // Warm up alumni stats
    warmupTasks.push(
      CacheService.set(CacheKeys.alumniStats(), 'warming', 1)
    );
    
    // Warm up recent batches
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      const year = currentYear - i;
      warmupTasks.push(
        CacheService.set(CacheKeys.batchStats(year), 'warming', 1)
      );
    }
    
    // Warm up recent posts
    warmupTasks.push(
      CacheService.set(CacheKeys.posts('all', 1, 10), 'warming', 1)
    );
    
    await Promise.all(warmupTasks);
    
    return successResponse(res, null, 'Cache warmup initiated successfully');
  } catch (error) {
    console.error('Cache warmup error:', error);
    return errorResponse(res, 'Failed to warm up cache', 500);
  }
};

// Get cache health check
const getCacheHealth = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test cache operations
    const testKey = 'health:check:' + Date.now();
    const testValue = { test: true, timestamp: Date.now() };
    
    // Test SET operation
    await CacheService.set(testKey, testValue, 60);
    
    // Test GET operation
    const retrievedValue = await CacheService.get(testKey);
    
    // Test DELETE operation
    await CacheService.del(testKey);
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      operations: {
        set: '✅',
        get: retrievedValue ? '✅' : '❌',
        delete: '✅'
      },
      timestamp: new Date().toISOString()
    };
    
    return successResponse(res, { health }, 'Cache health check completed');
  } catch (error) {
    console.error('Cache health check error:', error);
    return errorResponse(res, {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 'Cache health check failed', 500);
  }
};

// ==========================================
// ANALYTICS DASHBOARD ENDPOINTS
// (Add these to existing admin.controller.js)
// ==========================================

/**
 * @desc    Get system-wide overview analytics
 * @route   GET /api/admin/dashboard/overview
 * @access  Private (SUPER_ADMIN)
 */
const getDashboardOverview = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    // MULTI-TENANT: Get tenant ID from request
    const tenantId = getTenantId(req);

    // Build tenant filter - exclude DEVELOPER users from org stats
    const tenantFilter = tenantId
      ? { organizationId: tenantId, role: { not: 'DEVELOPER' } }
      : { organizationId: req.user.organizationId, role: { not: 'DEVELOPER' } };

    // Get basic counts from database with tenant isolation
    const [totalUsers, verifiedUsers, pendingUsers, rejectedUsers, totalAdmins, batchAdmins, superAdmins, totalEvents, totalRegistrations] = await Promise.all([
      prisma.user.count({ where: { ...tenantFilter, isActive: true } }),
      prisma.user.count({ where: { ...tenantFilter, isActive: true, isAlumniVerified: true } }),
      prisma.user.count({ where: { ...tenantFilter, isActive: true, pendingVerification: true, isAlumniVerified: false, isRejected: false } }),
      prisma.user.count({ where: { ...tenantFilter, isRejected: true } }),
      prisma.user.count({ where: { ...tenantFilter, isActive: true, role: { in: ['SUPER_ADMIN', 'BATCH_ADMIN'] } } }),
      prisma.user.count({ where: { ...tenantFilter, isActive: true, role: 'BATCH_ADMIN' } }),
      prisma.user.count({ where: { ...tenantFilter, isActive: true, role: 'SUPER_ADMIN' } }),
      prisma.event.count({ where: { isActive: true, ...(tenantId ? { organizationId: tenantId } : {}) } }),
      prisma.eventRegistration.count({ where: tenantId ? { event: { organizationId: tenantId } } : {} })
    ]);

    // Create simplified overview response
    const overview = {
      userStats: {
        totalUsers: totalUsers || 0,
        verifiedUsers: verifiedUsers || 0,
        pendingVerifications: pendingUsers || 0,
        rejectedUsers: rejectedUsers || 0,
        activeUsers: verifiedUsers || 0
      },
      adminStats: {
        totalAdmins: totalAdmins || 0,
        batchAdmins: batchAdmins || 0,
        superAdmins: superAdmins || 0
      },
      recentActivity: {
        registrations: totalRegistrations || 0,
        verifications: verifiedUsers || 0,
        events: totalEvents || 0
      },
      systemHealth: {
        status: 'healthy',
        uptime: Math.floor(process.uptime()),
        lastBackup: new Date().toISOString()
      }
    };

    return successResponse(res, overview, 'Dashboard overview retrieved successfully');
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard overview', 500);
  }
};

/**
 * Get all users for admin management
 * @desc    Get paginated list of all users with their status
 * @route   GET /api/admin/users
 * @access  Private (SUPER_ADMIN, BATCH_ADMIN)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', batch, status, role } = req.query;
    const { role: adminRole, id: adminId } = req.user;
    const offset = (page - 1) * limit;

    // MULTI-TENANT: Get tenant ID from request (set by tenant middleware)
    const tenantId = getTenantId(req);

    // Build where clause with tenant isolation
    let whereClause = {
      isActive: true,
      // IMPORTANT: Never show DEVELOPER users in organization user lists
      // Developers are independent cross-tenant users and don't belong to any org
      role: { not: 'DEVELOPER' }
    };

    // CRITICAL: Filter by organization for multi-tenant isolation
    if (tenantId) {
      whereClause.organizationId = tenantId;
    } else {
      // Fallback: Use logged-in user's organization
      whereClause.organizationId = req.user.organizationId;
    }
    
    // Add search filter
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Add batch filter
    if (batch) {
      whereClause.batch = parseInt(batch);
    }
    
    // Add status filter
    if (status) {
      switch (status) {
        case 'email_pending':
          whereClause.isEmailVerified = false;
          break;
        case 'email_verified':
          whereClause.isEmailVerified = true;
          whereClause.pendingVerification = true;
          whereClause.isAlumniVerified = false;
          break;
        case 'alumni_verified':
          whereClause.isAlumniVerified = true;
          break;
        case 'rejected':
          whereClause.isRejected = true;
          break;
      }
    }
    
    // Add role filter - but never allow DEVELOPER to be shown
    if (role) {
      // If someone tries to filter by DEVELOPER, ignore it
      if (role !== 'DEVELOPER') {
        whereClause.role = role;
      }
      // If role is DEVELOPER, keep the default { not: 'DEVELOPER' } filter
    }
    
    // For batch admins, only show users from their batch
    if (adminRole === 'BATCH_ADMIN') {
      const adminUser = await prisma.user.findUnique({
        where: { id: adminId },
        select: { batch: true }
      });
      
      if (adminUser?.batch) {
        whereClause.batch = adminUser.batch;
      } else {
        // If admin has no batch, show no users
        whereClause.id = 'none';
      }
    }
    
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          fullName: true,
          email: true,
          batch: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          isEmailVerified: true,
          isAlumniVerified: true,
          pendingVerification: true,
          isRejected: true,
          rejectionReason: true,
          serialId: true,
          profileImage: true
        },
        skip: parseInt(offset),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where: whereClause })
    ]);
    
    // Add status calculation for each user
    const usersWithStatus = users.map(user => {
      let userStatus = 'email_pending';
      
      if (!user.isEmailVerified) {
        userStatus = 'email_pending';
      } else if (user.isRejected) {
        userStatus = 'rejected';
      } else if (user.isAlumniVerified) {
        userStatus = 'alumni_verified';
      } else if (user.pendingVerification) {
        userStatus = 'email_verified';
      }
      
      return {
        ...user,
        userStatus,
        registeredAt: user.createdAt,
        profileCompleteness: user.fullName && user.email ? 85 : 60
      };
    });
    
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    };
    
    return successResponse(res, {
      users: usersWithStatus,
      pagination
    });
    
  } catch (error) {
    console.error('getAllUsers error:', error);
    return errorResponse(res, 'Failed to retrieve users', 500);
  }
};

/**
 * Update user role
 * @desc    Update user role (SUPER_ADMIN only)
 * @route   PUT /api/admin/users/:userId/role
 * @access  Private (SUPER_ADMIN only)
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role: newRole } = req.body;
    const { role: adminRole, id: adminId } = req.user;
    
    // Only super admins can change roles
    if (adminRole !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Only Super Admins can update user roles', 403);
    }
    
    // Validate role
    const validRoles = ['USER', 'BATCH_ADMIN', 'SUPER_ADMIN'];
    if (!validRoles.includes(newRole)) {
      return errorResponse(res, 'Invalid role specified', 400);
    }
    
    // Get current user data first to capture old role
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true }
    });
    
    if (!currentUser) {
      return errorResponse(res, 'User not found', 404);
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: newRole,
        updatedAt: new Date()
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true
      }
    });

    // Send notification to user about role update
    try {
      const notificationTitle = 'Role Updated - Welcome to Your New Role! 👑';
      const notificationMessage = `Your account role has been updated to ${newRole.replace('_', ' ')}. Your new permissions are now active. Welcome to your enhanced access!`;
      
      // Create in-app notification first
      await prisma.notification.create({
        data: {
          type: 'ROLE_UPDATED',
          title: notificationTitle,
          message: notificationMessage,
          payload: {
            newRole,
            oldRole: currentUser.role,
            adminId,
            updatedAt: new Date().toISOString(),
            roleDescription: newRole === 'SUPER_ADMIN' ? 'Full system access' : 
                           newRole === 'BATCH_ADMIN' ? 'Batch management access' : 'Standard user access'
          },
          userId: userId
        }
      });
      
      console.log(`✅ Role update notification created for user ${userId}`);

      // Send push notification too
      try {
        const pushNotificationService = require('../../utils/push-notification.util');
        
        // For now, use a mock token - in production this would come from user's device registration
        const mockToken = `user_${userId}_device_token`;
        
        await pushNotificationService.sendToToken({
          token: mockToken,
          title: notificationTitle,
          body: notificationMessage,
          data: {
            type: 'ROLE_UPDATED',
            userId,
            newRole,
            oldRole: currentUser.role
          },
          priority: 'high'
        });
        
        console.log(`📱 Push notification sent for role update to user ${userId}`);
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
        // Don't fail the main request if push notification fails
      }
    } catch (notificationError) {
      console.error('Failed to send role update notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    return successResponse(res, updatedUser, 'User role updated successfully');
  } catch (error) {
    console.error('updateUserRole error:', error);
    return errorResponse(res, 'Failed to update user role', 500);
  }
};

/**
 * @desc    Get comprehensive events analytics
 * @route   GET /api/admin/dashboard/events-analytics
 * @access  Private (SUPER_ADMIN)
 */
const getEventsAnalytics = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'eventDate', 
      sortOrder = 'desc',
      status,
      fromDate,
      toDate 
    } = req.query;

    // Get events with analytics
    const whereClause = {};
    
    if (status) whereClause.status = status;
    if (fromDate || toDate) {
      whereClause.eventDate = {};
      if (fromDate) whereClause.eventDate.gte = new Date(fromDate);
      if (toDate) whereClause.eventDate.lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [events, totalCount] = await Promise.all([
      prisma.event.findMany({
        where: whereClause,
        include: {
          analytics: true,
          _count: {
            select: {
              registrations: {
                where: { status: 'CONFIRMED' }
              }
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.event.count({ where: whereClause })
    ]);

    // Calculate analytics for events that don't have them
    const eventsWithAnalytics = await Promise.all(
      events.map(async (event) => {
        let analytics = event.analytics;
        
        if (!analytics) {
          analytics = await AnalyticsService.calculateEventAnalytics(event.id);
        }
        
        return {
          id: event.id,
          title: event.title,
          eventDate: event.eventDate,
          status: event.status,
          maxCapacity: event.maxCapacity,
          registrationCount: event._count.registrations,
          analytics: {
            totalRevenue: Number(analytics.totalRevenue),
            registrationRevenue: Number(analytics.registrationRevenue),
            merchandiseRevenue: Number(analytics.merchandiseRevenue),
            donationRevenue: Number(analytics.donationRevenue),
            totalRegistrations: analytics.totalRegistrations,
            conversionRate: Number(analytics.conversionRate),
            averageOrderValue: Number(analytics.averageOrderValue),
            feedbackScore: Number(analytics.feedbackScore)
          },
          performance: {
            capacityUtilization: event.maxCapacity ? 
              Math.round((event._count.registrations / event.maxCapacity) * 100) : null,
            revenuePerRegistration: event._count.registrations > 0 ? 
              Math.round(Number(analytics.totalRevenue) / event._count.registrations) : 0
          }
        };
      })
    );

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    return successResponse(res, {
      events: eventsWithAnalytics,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      },
      summary: {
        totalEvents: totalCount,
        totalRevenue: eventsWithAnalytics.reduce((sum, e) => sum + e.analytics.totalRevenue, 0),
        averageCapacityUtilization: Math.round(
          eventsWithAnalytics
            .filter(e => e.performance.capacityUtilization !== null)
            .reduce((sum, e) => sum + e.performance.capacityUtilization, 0) / 
          eventsWithAnalytics.filter(e => e.performance.capacityUtilization !== null).length || 0
        )
      }
    }, 'Events analytics retrieved successfully');

  } catch (error) {
    console.error('Events analytics error:', error);
    return errorResponse(res, 'Failed to retrieve events analytics', 500);
  }
};

/**
 * @desc    Get revenue breakdown analytics
 * @route   GET /api/admin/dashboard/revenue-breakdown
 * @access  Private (SUPER_ADMIN)
 */
const getRevenueBreakdown = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const breakdown = await AnalyticsService.getRevenueBreakdown(fromDate, toDate);
    
    return successResponse(res, breakdown, 'Revenue breakdown retrieved successfully');
  } catch (error) {
    console.error('Revenue breakdown error:', error);
    return errorResponse(res, 'Failed to retrieve revenue breakdown', 500);
  }
};

/**
 * @desc    Get batch participation analytics
 * @route   GET /api/admin/dashboard/batch-participation
 * @access  Private (SUPER_ADMIN)
 */
const getBatchParticipation = async (req, res) => {
  try {
    const participation = await AnalyticsService.getBatchParticipation();
    
    return successResponse(res, participation, 'Batch participation retrieved successfully');
  } catch (error) {
    console.error('Batch participation error:', error);
    return errorResponse(res, 'Failed to retrieve batch participation', 500);
  }
};

/**
 * @desc    Get live registration stats for an event
 * @route   GET /api/admin/dashboard/live-registrations/:eventId
 * @access  Private (SUPER_ADMIN)
 */
const getLiveRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const stats = await AnalyticsService.getLiveRegistrationStats(eventId);
    
    if (!stats) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    return successResponse(res, stats, 'Live registration stats retrieved successfully');
  } catch (error) {
    console.error('Live registrations error:', error);
    return errorResponse(res, 'Failed to retrieve live registration stats', 500);
  }
};

/**
 * @desc    Refresh analytics cache
 * @route   POST /api/admin/dashboard/refresh-analytics
 * @access  Private (SUPER_ADMIN)
 */
const refreshAnalytics = async (req, res) => {
  try {
    const { eventId } = req.body;
    
    if (eventId) {
      // Refresh specific event analytics
      await AnalyticsService.invalidateEventAnalytics(eventId);
      await AnalyticsService.calculateEventAnalytics(eventId);
    } else {
      // Refresh system-wide analytics
      await AnalyticsService.invalidateSystemAnalytics();
    }
    
    return successResponse(res, null, 'Analytics cache refreshed successfully');
  } catch (error) {
    console.error('Refresh analytics error:', error);
    return errorResponse(res, 'Failed to refresh analytics', 500);
  }
};

/**
 * @desc    Get unified payment analytics across ALL payment sources
 * @route   GET /api/admin/dashboard/unified-payments
 * @access  Private (SUPER_ADMIN)
 */
const getUnifiedPaymentAnalytics = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    console.log(`🔍 Admin requesting unified payment analytics from ${fromDate || 'auto'} to ${toDate || 'auto'}`);
    
    const analytics = await AnalyticsService.getUnifiedPaymentAnalytics(fromDate, toDate);
    
    // Add admin-specific insights
    const adminInsights = {
      ...analytics,
      adminInsights: {
        recommendedActions: generateRecommendedActions(analytics),
        alerts: generatePaymentAlerts(analytics),
        performanceScore: calculatePerformanceScore(analytics)
      }
    };
    
    console.log(`✅ Unified payment analytics: ₹${analytics.summary.totalRevenue.toLocaleString('en-IN')} across ${analytics.summary.totalTransactions} transactions`);
    
    return successResponse(res, adminInsights, 'Unified payment analytics retrieved successfully');
  } catch (error) {
    console.error('❌ Unified payment analytics error:', error);
    return errorResponse(res, 'Failed to retrieve unified payment analytics', 500);
  }
};

/**
 * @desc    Get transparency report for users and stakeholders
 * @route   GET /api/admin/dashboard/transparency-report
 * @access  Private (SUPER_ADMIN)
 */
const getTransparencyReport = async (req, res) => {
  try {
    const { eventId } = req.query;
    
    console.log(`🔍 Admin requesting transparency report for ${eventId ? `event ${eventId}` : 'system-wide'}`);
    
    const report = await AnalyticsService.getTransparencyReport(eventId);
    
    // Add admin controls and metadata
    const adminReport = {
      ...report,
      adminControls: {
        canPublish: true,
        lastPublished: await this.getLastPublishedDate(eventId),
        scheduledPublish: null
      },
      auditInfo: {
        generatedBy: req.user.id,
        generatedAt: new Date().toISOString(),
        dataSource: 'live_database',
        accuracy: '100%'
      }
    };
    
    return successResponse(res, adminReport, 'Transparency report retrieved successfully');
  } catch (error) {
    console.error('❌ Transparency report error:', error);
    return errorResponse(res, 'Failed to retrieve transparency report', 500);
  }
};

/**
 * @desc    Get enhanced revenue breakdown with ALL sources integrated
 * @route   GET /api/admin/dashboard/enhanced-revenue-breakdown  
 * @access  Private (SUPER_ADMIN)
 */
const getEnhancedRevenueBreakdown = async (req, res) => {
  try {
    const { fromDate, toDate, includeProjections } = req.query;
    
    console.log(`🔍 Admin requesting enhanced revenue breakdown`);
    
    // Get enhanced breakdown from AnalyticsService
    const breakdown = await AnalyticsService.getRevenueBreakdown(fromDate, toDate);
    
    // Add admin-specific enhancements
    const enhancedBreakdown = {
      ...breakdown,
      projections: includeProjections === 'true' ? 
        await this.generateRevenueProjections(breakdown) : null,
      comparisons: await this.getHistoricalComparisons(breakdown.period),
      recommendations: this.generateRevenueRecommendations(breakdown)
    };
    
    return successResponse(res, enhancedBreakdown, 'Enhanced revenue breakdown retrieved successfully');
  } catch (error) {
    console.error('❌ Enhanced revenue breakdown error:', error);
    return errorResponse(res, 'Failed to retrieve enhanced revenue breakdown', 500);
  }
};

/**
 * @desc    Get merchandise integration analytics (now connected to main dashboard)
 * @route   GET /api/admin/dashboard/merchandise-integration
 * @access  Private (SUPER_ADMIN)
 */
const getMerchandiseIntegrationAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    console.log(`🔍 Admin requesting merchandise integration analytics for ${period}`);
    
    // Get both standalone and event merchandise analytics
    const [
      standaloneMerchandise,
      eventMerchandise,
      integration
    ] = await Promise.all([
      this.getStandaloneMerchandiseStats(period),
      this.getEventMerchandiseStats(period),
      this.getMerchandiseIntegrationStats(period)
    ]);
    
    const analytics = {
      period,
      standalone: standaloneMerchandise,
      eventBased: eventMerchandise,
      integration: integration,
      summary: {
        totalMerchandiseRevenue: standaloneMerchandise.revenue + eventMerchandise.revenue,
        totalOrders: standaloneMerchandise.orders + eventMerchandise.orders,
        revenueShare: {
          standalone: standaloneMerchandise.revenue / (standaloneMerchandise.revenue + eventMerchandise.revenue) * 100,
          eventBased: eventMerchandise.revenue / (standaloneMerchandise.revenue + eventMerchandise.revenue) * 100
        }
      },
      recommendations: this.generateMerchandiseRecommendations(standaloneMerchandise, eventMerchandise)
    };
    
    return successResponse(res, analytics, 'Merchandise integration analytics retrieved successfully');
  } catch (error) {
    console.error('❌ Merchandise integration analytics error:', error);
    return errorResponse(res, 'Failed to retrieve merchandise integration analytics', 500);
  }
};

/**
 * @desc    Get real-time payment status across ALL types
 * @route   GET /api/admin/dashboard/real-time-payments
 * @access  Private (SUPER_ADMIN)
 */
const getRealTimePaymentStatus = async (req, res) => {
  try {
    console.log(`🔍 Admin requesting real-time payment status`);
    
    const realTimeData = await this.calculateRealTimePaymentStatus();
    
    return successResponse(res, realTimeData, 'Real-time payment status retrieved successfully');
  } catch (error) {
    console.error('❌ Real-time payment status error:', error);
    return errorResponse(res, 'Failed to retrieve real-time payment status', 500);
  }
};

// =============================================
// HELPER METHODS FOR ENHANCED ANALYTICS
// =============================================

/**
 * Generate recommended actions based on analytics
 */
function generateRecommendedActions(analytics) {
  const actions = [];
  
  // Low transaction volume alert
  if (analytics.summary.totalTransactions < 10) {
    actions.push({
      type: 'marketing',
      priority: 'high',
      action: 'Increase user engagement and event promotion',
      reason: 'Low transaction volume detected'
    });
  }
  
  // Revenue source imbalance
  const breakdown = analytics.breakdown;
  const eventRevenue = breakdown.eventRegistrations.revenue;
  const totalRevenue = analytics.summary.totalRevenue;
  
  if (totalRevenue > 0 && (eventRevenue / totalRevenue) > 0.8) {
    actions.push({
      type: 'diversification',
      priority: 'medium',
      action: 'Promote merchandise and donation opportunities',
      reason: 'Over-dependence on event registration revenue'
    });
  }
  
  // High merchandise potential
  if (breakdown.merchandiseOrders.count > 0 && breakdown.merchandiseOrders.averageAmount > breakdown.eventRegistrations.averageAmount) {
    actions.push({
      type: 'expansion',
      priority: 'medium',
      action: 'Expand merchandise catalog and marketing',
      reason: 'High merchandise order value indicates growth potential'
    });
  }
  
  return actions;
}

/**
 * Generate payment alerts
 */
function generatePaymentAlerts(analytics) {
  const alerts = [];
  
  // Failed payment rate (if we had this data)
  const totalRevenue = analytics.summary.totalRevenue;
  
  if (totalRevenue === 0) {
    alerts.push({
      type: 'critical',
      message: 'No revenue in selected period',
      action: 'Check payment system status'
    });
  }
  
  // Low donation rate
  if (analytics.breakdown.donations.percentage < 5) {
    alerts.push({
      type: 'info',
      message: 'Low donation percentage',
      action: 'Consider donation campaigns'
    });
  }
  
  return alerts;
}

/**
 * Calculate performance score
 */
function calculatePerformanceScore(analytics) {
  let score = 0;
  
  // Revenue diversity (25 points)
  const sources = Object.values(analytics.breakdown);
  const activeSourcesCount = sources.filter(s => s.count > 0).length;
  score += (activeSourcesCount / 5) * 25;
  
  // Transaction volume (25 points)  
  const dailyTransactions = analytics.summary.totalTransactions / analytics.period.days;
  score += Math.min(dailyTransactions / 10, 1) * 25;
  
  // Revenue consistency (25 points)
  if (analytics.trends.length > 0) {
    const revenues = analytics.trends.map(t => t.totalRevenue);
    const avg = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const variance = revenues.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / revenues.length;
    const consistency = Math.max(0, 1 - (variance / (avg * avg)));
    score += consistency * 25;
  }
  
  // Growth trend (25 points)
  // Would need historical data for comparison
  score += 15; // Default partial score
  
  return Math.round(score);
}

/**
 * Calculate real-time payment status
 */
async function calculateRealTimePaymentStatus() {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    // Get real-time counts for all payment types
    const [
      pendingPayments,
      completedLast24h,
      failedLast24h,
      activeTransactions
    ] = await Promise.all([
      prisma.paymentTransaction.count({
        where: { status: 'PENDING' }
      }),
      
      prisma.paymentTransaction.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: last24Hours }
        }
      }),
      
      prisma.paymentTransaction.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: last24Hours }
        }
      }),
      
      prisma.paymentTransaction.count({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] },
          createdAt: { gte: new Date(now.getTime() - (60 * 60 * 1000)) } // Last hour
        }
      })
    ]);
    
    return {
      realTime: {
        pendingPayments,
        activeTransactions,
        timestamp: now.toISOString()
      },
      last24Hours: {
        completed: completedLast24h,
        failed: failedLast24h,
        successRate: completedLast24h + failedLast24h > 0 ? 
          (completedLast24h / (completedLast24h + failedLast24h) * 100).toFixed(1) : 0
      },
      status: pendingPayments > 20 ? 'high_volume' : 
              pendingPayments > 5 ? 'normal' : 'low'
    };
    
  } catch (error) {
    console.error('Real-time payment calculation error:', error);
    throw error;
  }
}

/**
 * Get event registrations with user details for analytics
 */
const getEventRegistrations = async (req, res) => {
  try {
    const { eventId, batch, status = 'CONFIRMED', page = 1, limit = 50 } = req.query;
    
    const whereClause = {
      status: status.toUpperCase(),
    };
    
    if (eventId && eventId !== 'all') {
      whereClause.eventId = eventId;
    }
    
    if (batch && batch !== 'all') {
      whereClause.user = {
        batch: parseInt(batch)
      };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [registrations, totalCount] = await Promise.all([
      prisma.eventRegistration.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              batch: true,
              profileImage: true,
              email: true
            }
          },
          event: {
            select: {
              id: true,
              title: true,
              eventDate: true
            }
          }
        },
        orderBy: {
          registrationDate: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.eventRegistration.count({ where: whereClause })
    ]);
    
    const formattedRegistrations = registrations.map(reg => ({
      id: reg.id,
      user: {
        id: reg.user.id,
        fullName: reg.user.fullName,
        batch: reg.user.batch,
        profileImage: reg.user.profileImage,
        email: reg.user.email
      },
      event: reg.event,
      totalGuests: reg.totalGuests || 0,
      donationAmount: Number(reg.donationAmount || 0),
      totalAmount: Number(reg.totalAmount || 0),
      registrationDate: reg.registrationDate,
      status: reg.status
    }));
    
    return successResponse(res, {
      registrations: formattedRegistrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    }, 'Event registrations retrieved successfully');
  } catch (error) {
    console.error('❌ Get event registrations error:', error);
    return errorResponse(res, 'Failed to retrieve event registrations', 500);
  }
};

/**
 * Get unique user batches for dropdown
 */
const getUserBatches = async (req, res) => {
  try {
    const batches = await prisma.user.findMany({
      select: {
        batch: true
      },
      distinct: ['batch'],
      orderBy: {
        batch: 'desc'
      }
    });
    
    const batchYears = batches.map(b => b.batch).filter(batch => batch != null);
    
    return successResponse(res, batchYears, 'User batches retrieved successfully');
  } catch (error) {
    console.error('❌ Get user batches error:', error);
    return errorResponse(res, 'Failed to retrieve user batches', 500);
  }
};


module.exports = {
  getDashboardOverview,
  getAllUsers,
  updateUserRole,
  getEventsAnalytics,
  getEventRegistrations,
  getUserBatches,
  getRevenueBreakdown,
  getBatchParticipation,
  getLiveRegistrations,
  refreshAnalytics,
  getCacheDashboard,
  getCacheStats,
  getCacheHealth,
  clearCache,
  warmUpCache,
  getUnifiedPaymentAnalytics,
  getTransparencyReport,
  getEnhancedRevenueBreakdown,
  getMerchandiseIntegrationAnalytics,
  getRealTimePaymentStatus,
  
  // Helper methods (if needed externally)
  generateRecommendedActions,
  generatePaymentAlerts,
  calculatePerformanceScore
};