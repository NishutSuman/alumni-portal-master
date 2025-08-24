// src/services/qr/CheckInService.js
const { prisma } = require('../../config/database');
const { CacheService } = require('../../config/redis');
const QRCodeService = require('./QRCodeService');

class CheckInService {
  constructor() {
    this.cacheKeys = {
      checkInStats: (eventId) => `checkin:event:${eventId}:stats`,
      liveCount: (eventId) => `checkin:event:${eventId}:live`,
    };
  }

  /**
   * Process check-in via QR code
   */
  async processCheckIn(qrCode, checkInData, staffUserId = null) {
    try {
      const { 
        guestsCheckedIn = 0, 
        checkInLocation, 
        notes,
        guestDetails = []
      } = checkInData;

      // Validate QR code first
      const qrValidation = await QRCodeService.validateQRCode(qrCode);
      if (!qrValidation.isValid) {
        throw new Error(qrValidation.error || 'Invalid QR code');
      }

      const qrData = qrValidation.data;
      const registrationId = qrData.registrationId;

      // Check if already checked in
      const existingCheckIn = await prisma.eventCheckIn.findFirst({
        where: { registrationId }
      });

      if (existingCheckIn) {
        return {
          success: false,
          error: 'Already checked in',
          checkIn: existingCheckIn,
          isAlreadyCheckedIn: true
        };
      }

      // Validate guest count
      const maxGuests = qrData.summary.totalGuests || 0;
      if (guestsCheckedIn > maxGuests) {
        throw new Error(`Cannot check in ${guestsCheckedIn} guests. Maximum allowed: ${maxGuests}`);
      }

      // Process check-in in transaction
      const checkIn = await prisma.$transaction(async (tx) => {
        // Create check-in record
        const newCheckIn = await tx.eventCheckIn.create({
          data: {
            registrationId,
            qrId: qrValidation.qrRecord.id,
            checkedInBy: staffUserId,
            guestsCheckedIn: Math.min(guestsCheckedIn, maxGuests),
            totalGuests: maxGuests,
            guestDetails: guestDetails.length > 0 ? guestDetails : null,
            checkInLocation,
            notes,
            checkInMethod: 'QR_CODE',
            isVerified: true
          },
          include: {
            registration: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    batch: true
                  }
                },
                event: {
                  select: {
                    title: true,
                    eventDate: true
                  }
                }
              }
            }
          }
        });

        // Update QR scan count
        await tx.registrationQR.update({
          where: { id: qrValidation.qrRecord.id },
          data: {
            lastScannedAt: new Date(),
            scanCount: { increment: 1 }
          }
        });

        return newCheckIn;
      });

      // Clear cache for live stats
      await this.invalidateEventCache(qrData.eventId);

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: qrData.userId,
          action: 'event_checkin',
          details: {
            eventId: qrData.eventId,
            registrationId,
            checkInId: checkIn.id,
            guestsCheckedIn,
            checkInMethod: 'QR_CODE',
            staffUserId
          },
          ipAddress: null, // Will be set by controller
          userAgent: null  // Will be set by controller
        }
      });

      return {
        success: true,
        checkIn,
        qrData: {
          user: qrData.user,
          event: qrData.event,
          summary: qrData.summary
        }
      };

    } catch (error) {
      console.error('Check-in processing error:', error);
      throw error;
    }
  }

  /**
   * Get check-in statistics for an event
   */
  async getEventCheckInStats(eventId) {
    try {
      const cacheKey = this.cacheKeys.checkInStats(eventId);
      
      // Try cache first
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      // Get comprehensive stats
      const [basicStats, guestStats, timeStats] = await Promise.all([
        this.getBasicCheckInStats(eventId),
        this.getGuestCheckInStats(eventId),
        this.getCheckInTimeStats(eventId)
      ]);

      const stats = {
        ...basicStats,
        guests: guestStats,
        timeline: timeStats,
        generatedAt: new Date().toISOString()
      };

      // Cache for 5 minutes (live data)
      await CacheService.set(cacheKey, stats, 5 * 60);
      
      return stats;

    } catch (error) {
      console.error('Check-in stats error:', error);
      throw error;
    }
  }

  /**
   * Get real-time check-in count
   */
  async getLiveCheckInCount(eventId) {
    try {
      const cacheKey = this.cacheKeys.liveCount(eventId);
      
      const cached = await CacheService.get(cacheKey);
      if (cached) return cached;

      const count = await prisma.eventCheckIn.count({
        where: {
          registration: { eventId }
        }
      });

      const liveData = {
        checkedInCount: count,
        timestamp: new Date().toISOString()
      };

      // Cache for 2 minutes
      await CacheService.set(cacheKey, liveData, 2 * 60);
      
      return liveData;

    } catch (error) {
      console.error('Live check-in count error:', error);
      return { checkedInCount: 0, timestamp: new Date().toISOString() };
    }
  }

  /**
   * Get check-in history for an event
   */
  async getCheckInHistory(eventId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const [checkIns, totalCount] = await Promise.all([
        prisma.eventCheckIn.findMany({
          where: {
            registration: { eventId }
          },
          include: {
            registration: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    batch: true,
                    profileImage: true
                  }
                }
              }
            },
            checkedInStaff: {
              select: {
                fullName: true
              }
            }
          },
          orderBy: { checkedInAt: 'desc' },
          skip,
          take: limit
        }),

        prisma.eventCheckIn.count({
          where: {
            registration: { eventId }
          }
        })
      ]);

      return {
        checkIns,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: limit
        }
      };

    } catch (error) {
      console.error('Check-in history error:', error);
      throw error;
    }
  }

  // Helper methods
  async getBasicCheckInStats(eventId) {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT er.id) as total_registrations,
        COUNT(DISTINCT ci.registration_id) as checked_in_registrations,
        COUNT(ci.id) as total_checkins,
        ROUND(
          (COUNT(DISTINCT ci.registration_id)::decimal / COUNT(DISTINCT er.id) * 100), 2
        ) as checkin_rate
      FROM event_registrations er
      LEFT JOIN event_check_ins ci ON er.id = ci.registration_id
      WHERE er.event_id = ${eventId}
        AND er.status = 'CONFIRMED'
    `;

    const stat = stats[0];
    return {
      totalRegistrations: Number(stat.total_registrations),
      checkedInRegistrations: Number(stat.checked_in_registrations),
      remainingRegistrations: Number(stat.total_registrations) - Number(stat.checked_in_registrations),
      checkInRate: Number(stat.checkin_rate),
      totalCheckIns: Number(stat.total_checkins)
    };
  }

  async getGuestCheckInStats(eventId) {
    const guestStats = await prisma.$queryRaw`
      SELECT 
        SUM(er.total_guests) as total_guests_registered,
        SUM(ci.guests_checked_in) as total_guests_checked_in,
        AVG(ci.guests_checked_in) as avg_guests_per_checkin
      FROM event_registrations er
      LEFT JOIN event_check_ins ci ON er.id = ci.registration_id
      WHERE er.event_id = ${eventId}
        AND er.status = 'CONFIRMED'
    `;

    const stat = guestStats[0];
    return {
      totalGuestsRegistered: Number(stat.total_guests_registered || 0),
      totalGuestsCheckedIn: Number(stat.total_guests_checked_in || 0),
      averageGuestsPerCheckIn: Number(stat.avg_guests_per_checkin || 0)
    };
  }

  async getCheckInTimeStats(eventId) {
    const timeStats = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', ci.checked_in_at) as check_in_hour,
        COUNT(*) as checkins_count
      FROM event_check_ins ci
      JOIN event_registrations er ON ci.registration_id = er.id
      WHERE er.event_id = ${eventId}
      GROUP BY check_in_hour
      ORDER BY check_in_hour
    `;

    return timeStats.map(stat => ({
      hour: stat.check_in_hour,
      count: Number(stat.checkins_count)
    }));
  }

  async invalidateEventCache(eventId) {
    const keys = [
      this.cacheKeys.checkInStats(eventId),
      this.cacheKeys.liveCount(eventId)
    ];
    
    await Promise.all(keys.map(key => CacheService.del(key)));
  }
}

module.exports = new CheckInService();