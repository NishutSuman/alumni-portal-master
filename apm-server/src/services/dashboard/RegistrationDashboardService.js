// src/services/dashboard/RegistrationDashboardService.js
const { prisma } = require('../../config/database');
const { CacheService } = require('../../config/redis');

class RegistrationDashboardService {
  constructor() {
    this.cacheKeys = {
      publicDashboard: (eventId) => `dashboard:public:${eventId}`,
      adminDashboard: (eventId) => `dashboard:admin:${eventId}`,
      batchStats: (eventId) => `dashboard:batch:${eventId}`,
      privacySettings: (eventId) => `privacy:${eventId}`,
    };
  }

  // ==========================================
  // PUBLIC REGISTRATION DASHBOARD
  // ==========================================

  async getPublicRegistrationDashboard(eventId) {
    try {
      const cacheKey = this.cacheKeys.publicDashboard(eventId);
      
      // Try cache first
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get event and privacy settings
      const eventData = await this.getEventWithPrivacySettings(eventId);
      
      if (!eventData.event) {
        throw new Error('Event not found');
      }

      if (!eventData.privacySettings.enablePublicDashboard) {
        throw new Error('Public dashboard is disabled for this event');
      }

      // Get registration data with privacy controls
      const registrations = await this.getPublicRegistrationData(eventId, eventData.privacySettings);
      
      // Get public statistics
      const statistics = await this.getPublicStatistics(eventId, eventData.privacySettings);

      const dashboard = {
        event: {
          id: eventData.event.id,
          title: eventData.event.title,
          eventDate: eventData.event.eventDate,
          venue: eventData.event.venue,
          eventMode: eventData.event.eventMode
        },
        dashboard: {
          title: eventData.privacySettings.dashboardTitle,
          message: eventData.privacySettings.dashboardMessage,
          isPublic: true
        },
        statistics,
        registrations,
        privacyInfo: {
          paymentAmountsVisible: eventData.privacySettings.showPaymentAmounts,
          emailsVisible: eventData.privacySettings.showUserEmails,
          phonesVisible: eventData.privacySettings.showUserPhones
        },
        generatedAt: new Date().toISOString()
      };

      // Cache for 15 minutes
      await CacheService.set(cacheKey, dashboard, 15 * 60);
      
      return dashboard;

    } catch (error) {
      console.error('Public registration dashboard error:', error);
      throw error;
    }
  }

  // ==========================================
  // ADMIN REGISTRATION DASHBOARD
  // ==========================================

  async getAdminRegistrationDashboard(eventId, options = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'registrationDate', sortOrder = 'desc', search, batch, status } = options;
      
      const cacheKey = `${this.cacheKeys.adminDashboard(eventId)}_${JSON.stringify(options)}`;
      
      // Try cache (shorter TTL for admin data)
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get complete event data
      const eventData = await this.getEventWithPrivacySettings(eventId);
      
      if (!eventData.event) {
        throw new Error('Event not found');
      }

      // Get comprehensive registration data
      const registrationData = await this.getAdminRegistrationData(eventId, options);
      
      // Get comprehensive statistics
      const statistics = await this.getAdminStatistics(eventId);

      // Get batch-wise breakdown
      const batchStats = await this.getBatchWiseStats(eventId);

      const dashboard = {
        event: {
          id: eventData.event.id,
          title: eventData.event.title,
          eventDate: eventData.event.eventDate,
          venue: eventData.event.venue,
          eventMode: eventData.event.eventMode,
          maxCapacity: eventData.event.maxCapacity,
          registrationFee: eventData.event.registrationFee,
          guestFee: eventData.event.guestFee
        },
        dashboard: {
          title: 'Admin Registration Dashboard',
          isPublic: false
        },
        statistics,
        batchStats,
        registrations: registrationData.registrations,
        pagination: registrationData.pagination,
        privacySettings: eventData.privacySettings,
        generatedAt: new Date().toISOString()
      };

      // Cache for 10 minutes (admin data needs to be more current)
      await CacheService.set(cacheKey, dashboard, 10 * 60);
      
      return dashboard;

    } catch (error) {
      console.error('Admin registration dashboard error:', error);
      throw error;
    }
  }

  // ==========================================
  // BATCH-WISE REGISTRATION VIEW
  // ==========================================

  async getBatchWiseRegistrations(eventId) {
    try {
      const cacheKey = this.cacheKeys.batchStats(eventId);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      const batchData = await prisma.$queryRaw`
        SELECT 
          u.batch,
          COUNT(DISTINCT er.id) as registration_count,
          COUNT(DISTINCT er.user_id) as unique_users,
          SUM(er.total_amount) as total_revenue,
          AVG(er.total_amount) as average_amount,
          SUM(er.total_guests) as total_guests,
          COUNT(DISTINCT CASE WHEN er.payment_status = 'COMPLETED' THEN er.id END) as paid_registrations,
          COUNT(DISTINCT ci.registration_id) as checked_in_count
        FROM event_registrations er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN event_check_ins ci ON er.id = ci.registration_id
        WHERE er.event_id = ${eventId}
          AND er.status = 'CONFIRMED'
        GROUP BY u.batch
        ORDER BY u.batch DESC
      `;

      // Get individual registrations per batch for detailed view
      const detailedBatchData = await Promise.all(
        batchData.map(async (batch) => {
          const registrations = await prisma.eventRegistration.findMany({
            where: {
              eventId,
              status: 'CONFIRMED',
              user: { batch: batch.batch }
            },
            include: {
              user: {
                select: {
                  fullName: true,
                  email: true,
                  profileImage: true
                }
              },
              checkIns: {
                select: {
                  checkedInAt: true
                }
              }
            },
            take: 10, // Limit to first 10 for preview
            orderBy: { registrationDate: 'desc' }
          });

          return {
            batch: batch.batch,
            statistics: {
              registrationCount: Number(batch.registration_count),
              uniqueUsers: Number(batch.unique_users),
              totalRevenue: Number(batch.total_revenue || 0),
              averageAmount: Number(batch.average_amount || 0),
              totalGuests: Number(batch.total_guests || 0),
              paidRegistrations: Number(batch.paid_registrations),
              checkedInCount: Number(batch.checked_in_count),
              paymentRate: batch.registration_count > 0 ? 
                Math.round((batch.paid_registrations / batch.registration_count) * 100) : 0,
              attendanceRate: batch.registration_count > 0 ? 
                Math.round((batch.checked_in_count / batch.registration_count) * 100) : 0
            },
            recentRegistrations: registrations
          };
        })
      );

      const result = {
        eventId,
        batchCount: batchData.length,
        totalRegistrations: batchData.reduce((sum, b) => sum + Number(b.registration_count), 0),
        batches: detailedBatchData,
        generatedAt: new Date().toISOString()
      };

      // Cache for 20 minutes
      await CacheService.set(cacheKey, result, 20 * 60);
      
      return result;

    } catch (error) {
      console.error('Batch-wise registrations error:', error);
      throw error;
    }
  }

  // ==========================================
  // PRIVACY SETTINGS MANAGEMENT
  // ==========================================

  async getPrivacySettings(eventId) {
    try {
      const cacheKey = this.cacheKeys.privacySettings(eventId);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      let settings = await prisma.eventPrivacySettings.findUnique({
        where: { eventId }
      });

      // Create default settings if none exist
      if (!settings) {
        settings = await prisma.eventPrivacySettings.create({
          data: { eventId }
        });
      }

      // Cache for 30 minutes (settings don't change frequently)
      await CacheService.set(cacheKey, settings, 30 * 60);
      
      return settings;

    } catch (error) {
      console.error('Get privacy settings error:', error);
      throw error;
    }
  }

  async updatePrivacySettings(eventId, updates) {
    try {
      // Validate updates
      const allowedFields = [
        'showPaymentAmounts', 'showDonationAmounts', 'showUserEmails', 
        'showUserPhones', 'showGuestDetails', 'showBatchInfo', 
        'showRegistrationDate', 'enablePublicDashboard', 'dashboardTitle', 
        'dashboardMessage', 'showTotalCount', 'showBatchStats', 'showPaymentStats'
      ];

      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      // Update settings
      const settings = await prisma.eventPrivacySettings.upsert({
        where: { eventId },
        update: {
          ...filteredUpdates,
          updatedAt: new Date()
        },
        create: {
          eventId,
          ...filteredUpdates
        }
      });

      // Invalidate caches
      await this.invalidateDashboardCaches(eventId);
      
      return settings;

    } catch (error) {
      console.error('Update privacy settings error:', error);
      throw error;
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async getEventWithPrivacySettings(eventId) {
    const [event, privacySettings] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          eventDate: true,
          venue: true,
          eventMode: true,
          maxCapacity: true,
          registrationFee: true,
          guestFee: true,
          status: true
        }
      }),
      this.getPrivacySettings(eventId)
    ]);

    return { event, privacySettings };
  }

  async getPublicRegistrationData(eventId, privacySettings) {
    const selectFields = {
      id: true,
      registrationDate: privacySettings.showRegistrationDate,
      totalGuests: true,
      status: true,
      user: {
        select: {
          fullName: true,
          batch: privacySettings.showBatchInfo,
          profileImage: true,
          email: privacySettings.showUserEmails,
          whatsappNumber: privacySettings.showUserPhones
        }
      }
    };

    // Conditionally add payment fields
    if (privacySettings.showPaymentAmounts) {
      selectFields.totalAmount = true;
      selectFields.paymentStatus = true;
    }

    if (privacySettings.showDonationAmounts) {
      selectFields.donationAmount = true;
    }

    // Conditionally add guest details
    if (privacySettings.showGuestDetails) {
      selectFields.guests = {
        where: { status: 'ACTIVE' },
        select: {
          name: true
        }
      };
    }

    const registrations = await prisma.eventRegistration.findMany({
      where: {
        eventId,
        status: 'CONFIRMED'
      },
      select: selectFields,
      orderBy: { registrationDate: 'asc' },
      take: 100 // Limit public view to first 100 registrations
    });

    return registrations.map(reg => ({
      id: reg.id,
      user: {
        fullName: reg.user.fullName,
        ...(privacySettings.showBatchInfo && { batch: reg.user.batch }),
        ...(privacySettings.showUserEmails && { email: reg.user.email }),
        ...(privacySettings.showUserPhones && { whatsappNumber: reg.user.whatsappNumber }),
        profileImage: reg.user.profileImage
      },
      ...(privacySettings.showRegistrationDate && { registrationDate: reg.registrationDate }),
      totalGuests: reg.totalGuests,
      ...(privacySettings.showPaymentAmounts && { 
        totalAmount: reg.totalAmount,
        paymentStatus: reg.paymentStatus 
      }),
      ...(privacySettings.showDonationAmounts && { donationAmount: reg.donationAmount }),
      ...(privacySettings.showGuestDetails && { 
        guestNames: reg.guests ? reg.guests.map(g => g.name) : [] 
      })
    }));
  }

  async getAdminRegistrationData(eventId, options) {
    const { page, limit, sortBy, sortOrder, search, batch, status } = options;
    
    // Build where clause
    const whereClause = {
      eventId,
      ...(status && { status })
    };

    if (search) {
      whereClause.OR = [
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (batch) {
      whereClause.user = { batch: parseInt(batch) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [registrations, totalCount] = await Promise.all([
      prisma.eventRegistration.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              whatsappNumber: true,
              batch: true,
              profileImage: true
            }
          },
          guests: {
            where: { status: 'ACTIVE' },
            select: {
              name: true,
              email: true,
              mealPreference: true
            }
          },
          merchandiseOrders: {
            select: {
              id: true,
              quantity: true,
              totalPrice: true,
              merchandise: {
                select: { name: true }
              }
            }
          },
          checkIns: {
            select: {
              checkedInAt: true,
              guestsCheckedIn: true
            }
          },
          qr: {
            select: {
              qrCode: true,
              generatedAt: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: parseInt(limit)
      }),
      
      prisma.eventRegistration.count({ where: whereClause })
    ]);

    return {
      registrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    };
  }

  async getPublicStatistics(eventId, privacySettings) {
    const stats = await prisma.eventRegistration.aggregate({
      where: {
        eventId,
        status: 'CONFIRMED'
      },
      _count: { id: true },
      _sum: {
        totalGuests: true,
        ...(privacySettings.showPaymentAmounts && { totalAmount: true }),
        ...(privacySettings.showDonationAmounts && { donationAmount: true })
      }
    });

    const result = {
      totalRegistrations: stats._count.id,
      totalGuests: stats._sum.totalGuests || 0
    };

    if (privacySettings.showPaymentAmounts) {
      result.totalRevenue = Number(stats._sum.totalAmount || 0);
    }

    if (privacySettings.showDonationAmounts) {
      result.totalDonations = Number(stats._sum.donationAmount || 0);
    }

    // Add batch breakdown if enabled
    if (privacySettings.showBatchStats) {
      const batchStats = await prisma.eventRegistration.groupBy({
        by: ['user.batch'],
        where: {
          eventId,
          status: 'CONFIRMED'
        },
        _count: { id: true }
      });

      result.batchBreakdown = batchStats.map(stat => ({
        batch: stat.user.batch,
        count: stat._count.id
      }));
    }

    return result;
  }

  async getAdminStatistics(eventId) {
    const [basicStats, paymentStats, checkInStats, guestStats] = await Promise.all([
      // Basic registration stats
      prisma.eventRegistration.aggregate({
        where: { eventId },
        _count: { id: true },
        _sum: {
          totalAmount: true,
          totalGuests: true,
          donationAmount: true
        }
      }),

      // Payment status breakdown
      prisma.eventRegistration.groupBy({
        by: ['paymentStatus'],
        where: { eventId },
        _count: { id: true }
      }),

      // Check-in stats
      prisma.eventCheckIn.count({
        where: {
          registration: { eventId }
        }
      }),

      // Guest stats
      prisma.eventGuest.aggregate({
        where: {
          registration: { eventId }
        },
        _count: { id: true }
      })
    ]);

    return {
      totalRegistrations: basicStats._count.id,
      totalRevenue: Number(basicStats._sum.totalAmount || 0),
      totalGuests: Number(basicStats._sum.totalGuests || 0),
      totalDonations: Number(basicStats._sum.donationAmount || 0),
      checkedInCount: checkInStats,
      attendanceRate: basicStats._count.id > 0 ? 
        Math.round((checkInStats / basicStats._count.id) * 100) : 0,
      paymentBreakdown: paymentStats.reduce((acc, stat) => {
        acc[stat.paymentStatus] = stat._count.id;
        return acc;
      }, {}),
      guestCount: guestStats._count.id
    };
  }

  async getBatchWiseStats(eventId) {
    return await this.getBatchWiseRegistrations(eventId);
  }

  // Cache invalidation
  async invalidateDashboardCaches(eventId) {
    const keys = [
      this.cacheKeys.publicDashboard(eventId),
      this.cacheKeys.adminDashboard(eventId),
      this.cacheKeys.batchStats(eventId),
      this.cacheKeys.privacySettings(eventId)
    ];
    
    await Promise.all(keys.map(key => CacheService.del(key)));
  }
}

module.exports = new RegistrationDashboardService();