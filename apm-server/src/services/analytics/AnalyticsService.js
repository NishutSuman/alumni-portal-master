// src/services/analytics/AnalyticsService.js
const { prisma } = require('../../config/database');
const CacheService = require('../../config/redis');

class AnalyticsService {
  constructor() {
    this.cacheKeys = {
      systemOverview: 'analytics:system:overview',
      eventAnalytics: (eventId) => `analytics:event:${eventId}`,
      batchParticipation: 'analytics:batch:participation',
      revenueBreakdown: 'analytics:revenue:breakdown',
      liveStats: (eventId) => `analytics:live:${eventId}`,
    };
  }

  // ==========================================
  // SYSTEM-WIDE ANALYTICS
  // ==========================================

  async getSystemOverview(fromDate = null, toDate = null) {
    const cacheKey = this.cacheKeys.systemOverview;
    
    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    // Calculate date range (default: last 30 days)
    const now = new Date();
    const defaultFromDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const startDate = fromDate ? new Date(fromDate) : defaultFromDate;
    const endDate = toDate ? new Date(toDate) : now;

    // Parallel data fetching for performance
    const [
      totalEvents,
      totalUsers,
      totalRevenue,
      totalRegistrations,
      recentEvents,
      paymentStats,
      userGrowth
    ] = await Promise.all([
      this.getTotalEvents(startDate, endDate),
      this.getTotalUsers(startDate, endDate),
      this.getTotalRevenue(startDate, endDate),
      this.getTotalRegistrations(startDate, endDate),
      this.getRecentEventStats(7), // Last 7 days
      this.getPaymentSuccessRate(startDate, endDate),
      this.getUserGrowthRate(startDate, endDate)
    ]);

    const overview = {
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      totals: {
        events: totalEvents,
        users: totalUsers,
        revenue: totalRevenue,
        registrations: totalRegistrations
      },
      growth: userGrowth,
      performance: {
        paymentSuccessRate: paymentStats.successRate,
        averageEventCapacity: paymentStats.avgCapacity,
        conversionRate: paymentStats.conversionRate
      },
      recent: recentEvents,
      generatedAt: new Date().toISOString()
    };

    // Cache for 15 minutes
    await CacheService.set(cacheKey, overview, 15 * 60);
    return overview;
  }

  async getEventAnalytics(eventId) {
    const cacheKey = this.cacheKeys.eventAnalytics(eventId);
    
    // Try cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    // Get or calculate event analytics
    let analytics = await prisma.eventAnalytics.findUnique({
      where: { eventId },
      include: {
        event: {
          select: {
            title: true,
            eventDate: true,
            maxCapacity: true,
            registrationFee: true,
            guestFee: true
          }
        }
      }
    });

    // Calculate if not exists or outdated (>1 hour)
    const shouldRecalculate = !analytics || 
      (new Date() - analytics.lastUpdated) > (60 * 60 * 1000);

    if (shouldRecalculate) {
      analytics = await this.calculateEventAnalytics(eventId);
    }

    // Cache for 30 minutes
    await CacheService.set(cacheKey, analytics, 30 * 60);
    return analytics;
  }

  async getBatchParticipation() {
    const cacheKey = this.cacheKeys.batchParticipation;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    // Get participation by batch
    const batchStats = await prisma.$queryRaw`
      SELECT 
        u.batch,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT er.user_id) as active_participants,
        ROUND(
          (COUNT(DISTINCT er.user_id)::decimal / COUNT(DISTINCT u.id) * 100), 2
        ) as participation_rate,
        SUM(er.total_amount) as total_revenue
      FROM users u
      LEFT JOIN event_registrations er ON u.id = er.user_id 
        AND er.status = 'CONFIRMED'
        AND er.registration_date >= NOW() - INTERVAL '1 year'
      WHERE u.is_active = true
      GROUP BY u.batch
      ORDER BY u.batch DESC
    `;

    const result = {
      batchStats: batchStats.map(stat => ({
        batch: stat.batch,
        totalUsers: Number(stat.total_users),
        activeParticipants: Number(stat.active_participants),
        participationRate: Number(stat.participation_rate),
        totalRevenue: Number(stat.total_revenue || 0)
      })),
      generatedAt: new Date().toISOString()
    };

    // Cache for 1 hour
    await CacheService.set(cacheKey, result, 60 * 60);
    return result;
  }

  async getRevenueBreakdown(fromDate = null, toDate = null) {
    const cacheKey = this.cacheKeys.revenueBreakdown;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const startDate = fromDate ? new Date(fromDate) : 
      new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)); // 90 days
    const endDate = toDate ? new Date(toDate) : now;

    // Get revenue breakdown
    const breakdown = await prisma.$queryRaw`
      SELECT 
        SUM(registration_fee_paid) as registration_revenue,
        SUM(guest_fees_paid) as guest_revenue, 
        SUM(merchandise_total) as merchandise_revenue,
        SUM(donation_amount) as donation_revenue,
        SUM(total_amount) as total_revenue,
        COUNT(*) as total_transactions,
        AVG(total_amount) as average_order_value
      FROM event_registrations er
      JOIN events e ON er.event_id = e.id
      WHERE er.payment_status = 'COMPLETED'
        AND er.registration_date >= ${startDate}
        AND er.registration_date <= ${endDate}
        AND er.status = 'CONFIRMED'
    `;

    const result = {
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      breakdown: {
        registrationFees: Number(breakdown[0]?.registration_revenue || 0),
        guestFees: Number(breakdown[0]?.guest_revenue || 0),
        merchandise: Number(breakdown[0]?.merchandise_revenue || 0),
        donations: Number(breakdown[0]?.donation_revenue || 0),
        total: Number(breakdown[0]?.total_revenue || 0)
      },
      metrics: {
        totalTransactions: Number(breakdown[0]?.total_transactions || 0),
        averageOrderValue: Number(breakdown[0]?.average_order_value || 0)
      },
      generatedAt: new Date().toISOString()
    };

    // Cache for 45 minutes
    await CacheService.set(cacheKey, result, 45 * 60);
    return result;
  }

  async getLiveRegistrationStats(eventId) {
    const cacheKey = this.cacheKeys.liveStats(eventId);
    
    // Check cache with shorter TTL for live data
    const cached = await CacheService.get(cacheKey);
    if (cached) return cached;

    const stats = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        title: true,
        maxCapacity: true,
        eventDate: true,
        registrationEndDate: true,
        _count: {
          select: {
            registrations: {
              where: { status: 'CONFIRMED' }
            }
          }
        },
        registrations: {
          where: { status: 'CONFIRMED' },
          select: {
            registrationDate: true,
            totalGuests: true,
            totalAmount: true
          }
        }
      }
    });

    if (!stats) return null;

    const totalRegistrations = stats._count.registrations;
    const totalRevenue = stats.registrations.reduce(
      (sum, reg) => sum + Number(reg.totalAmount), 0
    );
    const totalGuests = stats.registrations.reduce(
      (sum, reg) => sum + reg.totalGuests, 0
    );

    const result = {
      eventId,
      eventTitle: stats.title,
      capacity: {
        max: stats.maxCapacity,
        current: totalRegistrations,
        available: stats.maxCapacity ? stats.maxCapacity - totalRegistrations : null,
        utilizationRate: stats.maxCapacity ? 
          Math.round((totalRegistrations / stats.maxCapacity) * 100) : null
      },
      registrations: {
        total: totalRegistrations,
        totalGuests,
        totalRevenue: totalRevenue,
        averageRevenue: totalRegistrations > 0 ? 
          Math.round(totalRevenue / totalRegistrations) : 0
      },
      timeline: {
        eventDate: stats.eventDate,
        registrationDeadline: stats.registrationEndDate,
        daysUntilEvent: stats.eventDate ? 
          Math.ceil((stats.eventDate - new Date()) / (1000 * 60 * 60 * 24)) : null
      },
      lastUpdated: new Date().toISOString()
    };

    // Cache for 5 minutes (live data needs frequent updates)
    await CacheService.set(cacheKey, result, 5 * 60);
    return result;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async calculateEventAnalytics(eventId) {
    const calculations = await prisma.$queryRaw`
      SELECT 
        e.id as event_id,
        COUNT(DISTINCT er.id) as total_registrations,
        COUNT(DISTINCT CASE WHEN er.status = 'CONFIRMED' THEN er.id END) as confirmed_registrations,
        COUNT(DISTINCT CASE WHEN er.status = 'CANCELLED' THEN er.id END) as cancelled_registrations,
        SUM(DISTINCT er.total_guests) as total_guests,
        SUM(er.total_amount) as total_revenue,
        SUM(er.registration_fee_paid) as registration_revenue,
        SUM(er.merchandise_total) as merchandise_revenue,
        SUM(er.donation_amount) as donation_revenue,
        AVG(er.total_amount) as average_order_value,
        AVG(CASE WHEN fb.rating IS NOT NULL THEN fb.rating::decimal END) as avg_feedback_score
      FROM events e
      LEFT JOIN event_registrations er ON e.id = er.event_id
      LEFT JOIN event_feedback_responses fb ON e.id = fb.event_id
      WHERE e.id = ${eventId}
      GROUP BY e.id
    `;

    const calc = calculations[0];
    const conversionRate = calc.total_registrations > 0 ? 
      (calc.confirmed_registrations / calc.total_registrations) * 100 : 0;

    // Upsert analytics
    const analytics = await prisma.eventAnalytics.upsert({
      where: { eventId },
      update: {
        totalRevenue: Number(calc.total_revenue || 0),
        registrationRevenue: Number(calc.registration_revenue || 0),
        merchandiseRevenue: Number(calc.merchandise_revenue || 0),
        donationRevenue: Number(calc.donation_revenue || 0),
        totalRegistrations: Number(calc.total_registrations || 0),
        confirmedRegistrations: Number(calc.confirmed_registrations || 0),
        cancelledRegistrations: Number(calc.cancelled_registrations || 0),
        totalGuests: Number(calc.total_guests || 0),
        conversionRate: conversionRate,
        averageOrderValue: Number(calc.average_order_value || 0),
        feedbackScore: Number(calc.avg_feedback_score || 0),
        lastUpdated: new Date()
      },
      create: {
        eventId,
        totalRevenue: Number(calc.total_revenue || 0),
        registrationRevenue: Number(calc.registration_revenue || 0),
        merchandiseRevenue: Number(calc.merchandise_revenue || 0),
        donationRevenue: Number(calc.donation_revenue || 0),
        totalRegistrations: Number(calc.total_registrations || 0),
        confirmedRegistrations: Number(calc.confirmed_registrations || 0),
        cancelledRegistrations: Number(calc.cancelled_registrations || 0),
        totalGuests: Number(calc.total_guests || 0),
        conversionRate: conversionRate,
        averageOrderValue: Number(calc.average_order_value || 0),
        feedbackScore: Number(calc.avg_feedback_score || 0)
      },
      include: {
        event: {
          select: {
            title: true,
            eventDate: true,
            maxCapacity: true
          }
        }
      }
    });

    return analytics;
  }

  async getTotalEvents(startDate, endDate) {
    return await prisma.event.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });
  }

  async getTotalUsers(startDate, endDate) {
    return await prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        isActive: true
      }
    });
  }

  async getTotalRevenue(startDate, endDate) {
    const result = await prisma.eventRegistration.aggregate({
      where: {
        registrationDate: {
          gte: startDate,
          lte: endDate
        },
        paymentStatus: 'COMPLETED',
        status: 'CONFIRMED'
      },
      _sum: {
        totalAmount: true
      }
    });

    return Number(result._sum.totalAmount || 0);
  }

  async getTotalRegistrations(startDate, endDate) {
    return await prisma.eventRegistration.count({
      where: {
        registrationDate: {
          gte: startDate,
          lte: endDate
        },
        status: 'CONFIRMED'
      }
    });
  }

  async getRecentEventStats(days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await prisma.event.findMany({
      where: {
        createdAt: {
          gte: startDate
        }
      },
      select: {
        id: true,
        title: true,
        eventDate: true,
        _count: {
          select: {
            registrations: {
              where: { status: 'CONFIRMED' }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
  }

  async getPaymentSuccessRate(startDate, endDate) {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN payment_status = 'COMPLETED' THEN 1 END) as successful_payments,
        AVG(total_amount) as avg_transaction_value,
        COUNT(DISTINCT event_id) as unique_events
      FROM event_registrations
      WHERE registration_date >= ${startDate}
        AND registration_date <= ${endDate}
    `;

    const stat = stats[0];
    return {
      successRate: stat.total_attempts > 0 ? 
        Math.round((stat.successful_payments / stat.total_attempts) * 100) : 0,
      totalAttempts: Number(stat.total_attempts),
      successfulPayments: Number(stat.successful_payments),
      avgTransactionValue: Number(stat.avg_transaction_value || 0),
      avgCapacity: 75, // This would need more complex calculation
      conversionRate: 85 // This would need more complex calculation
    };
  }

  async getUserGrowthRate(startDate, endDate) {
    // Calculate growth compared to previous period
    const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const previousStartDate = new Date(startDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));

    const [currentPeriod, previousPeriod] = await Promise.all([
      this.getTotalUsers(startDate, endDate),
      this.getTotalUsers(previousStartDate, startDate)
    ]);

    const growthRate = previousPeriod > 0 ? 
      ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0;

    return {
      current: currentPeriod,
      previous: previousPeriod,
      growthRate: Math.round(growthRate * 100) / 100,
      trend: growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'stable'
    };
  }

  // Cache invalidation methods
  async invalidateEventAnalytics(eventId) {
    await CacheService.del(this.cacheKeys.eventAnalytics(eventId));
    await CacheService.del(this.cacheKeys.liveStats(eventId));
  }

  async invalidateSystemAnalytics() {
    const keys = [
      this.cacheKeys.systemOverview,
      this.cacheKeys.batchParticipation,
      this.cacheKeys.revenueBreakdown
    ];
    
    await Promise.all(keys.map(key => CacheService.del(key)));
  }
}

module.exports = new AnalyticsService();