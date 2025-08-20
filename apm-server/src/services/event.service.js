// src/services/event.service.js
const { prisma } = require('../config/database');

/**
 * Event utility service for common operations
 */
class EventService {
  
  /**
   * Check if event registration is open
   */
  static checkRegistrationStatus(event) {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const regStart = event.registrationStartDate ? new Date(event.registrationStartDate) : null;
    const regEnd = event.registrationEndDate ? new Date(event.registrationEndDate) : null;
    
    // Basic availability check
    if (!event.hasRegistration || event.hasExternalLink) {
      return {
        status: event.hasExternalLink ? 'EXTERNAL' : 'CLOSED',
        canRegister: false,
        message: event.hasExternalLink ? 'Registration available via external link' : 'Registration not available'
      };
    }
    
    // Check if event is in the past
    if (eventDate < now) {
      return {
        status: 'CLOSED',
        canRegister: false,
        message: 'Event has already passed'
      };
    }
    
    // Check registration period
    if (regStart && now < regStart) {
      return {
        status: 'NOT_STARTED',
        canRegister: false,
        message: `Registration opens on ${regStart.toLocaleDateString()}`
      };
    }
    
    if (regEnd && now > regEnd) {
      return {
        status: 'CLOSED',
        canRegister: false,
        message: 'Registration period has ended'
      };
    }
    
    // Check capacity
    if (event.maxCapacity && event._count?.registrations >= event.maxCapacity) {
      return {
        status: 'FULL',
        canRegister: false,
        message: 'Event is full'
      };
    }
    
    return {
      status: 'OPEN',
      canRegister: true,
      message: 'Registration is open'
    };
  }
  
  /**
   * Calculate event fees
   */
  static calculateEventFees(event, guestCount = 0, merchandiseItems = [], donationAmount = 0) {
    const registrationFee = parseFloat(event.registrationFee) || 0;
    const guestFee = parseFloat(event.guestFee) || 0;
    
    // Calculate guest fees
    const totalGuestFees = guestCount * guestFee;
    
    // Calculate merchandise total
    const merchandiseTotal = merchandiseItems.reduce((total, item) => {
      return total + (parseFloat(item.price) * parseInt(item.quantity));
    }, 0);
    
    // Total amount
    const totalAmount = registrationFee + totalGuestFees + merchandiseTotal + parseFloat(donationAmount);
    
    return {
      registrationFee,
      guestCount,
      guestFee,
      totalGuestFees,
      merchandiseTotal,
      donationAmount: parseFloat(donationAmount),
      totalAmount,
      breakdown: {
        registration: registrationFee,
        guests: totalGuestFees,
        merchandise: merchandiseTotal,
        donation: parseFloat(donationAmount)
      }
    };
  }
  
  /**
   * Get event statistics
   */
  static async getEventStatistics(eventId) {
    try {
      const [event, registrationStats, guestStats, merchandiseStats] = await Promise.all([
        prisma.event.findUnique({
          where: { id: eventId },
          select: {
            id: true,
            title: true,
            maxCapacity: true,
            registrationFee: true,
            guestFee: true,
            eventDate: true,
          }
        }),
        
        // Registration statistics
        prisma.eventRegistration.groupBy({
          by: ['status'],
          where: { eventId },
          _count: true,
          _sum: {
            totalAmount: true,
            registrationFeePaid: true,
            guestFeesPaid: true,
            merchandiseTotal: true,
            donationAmount: true,
          }
        }),
        
        // Guest statistics
        prisma.eventGuest.groupBy({
          by: ['status'],
          where: {
            registration: { eventId }
          },
          _count: true,
        }),
        
        // Merchandise statistics
        prisma.eventMerchandiseOrder.groupBy({
          by: ['merchandiseId'],
          where: {
            registration: { eventId }
          },
          _count: true,
          _sum: {
            quantity: true,
            totalPrice: true,
          }
        })
      ]);
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Process registration stats
      const registrations = {
        total: registrationStats.reduce((sum, stat) => sum + stat._count, 0),
        confirmed: registrationStats.find(s => s.status === 'CONFIRMED')?._count || 0,
        cancelled: registrationStats.find(s => s.status === 'CANCELLED')?._count || 0,
        waitlist: registrationStats.find(s => s.status === 'WAITLIST')?._count || 0,
      };
      
      // Process guest stats
      const guests = {
        total: guestStats.reduce((sum, stat) => sum + stat._count, 0),
        active: guestStats.find(s => s.status === 'ACTIVE')?._count || 0,
        cancelled: guestStats.find(s => s.status === 'CANCELLED')?._count || 0,
      };
      
      // Process financial stats
      const revenue = registrationStats.reduce((totals, stat) => {
        return {
          total: totals.total + (stat._sum.totalAmount || 0),
          registration: totals.registration + (stat._sum.registrationFeePaid || 0),
          guests: totals.guests + (stat._sum.guestFeesPaid || 0),
          merchandise: totals.merchandise + (stat._sum.merchandiseTotal || 0),
          donations: totals.donations + (stat._sum.donationAmount || 0),
        };
      }, { total: 0, registration: 0, guests: 0, merchandise: 0, donations: 0 });
      
      // Calculate capacity utilization
      const capacityUtilization = event.maxCapacity 
        ? Math.round((registrations.confirmed / event.maxCapacity) * 100)
        : null;
      
      return {
        event: {
          id: event.id,
          title: event.title,
          maxCapacity: event.maxCapacity,
          eventDate: event.eventDate,
        },
        registrations,
        guests,
        revenue,
        capacityUtilization,
        merchandise: {
          itemsSold: merchandiseStats.length,
          totalQuantity: merchandiseStats.reduce((sum, stat) => sum + (stat._sum.quantity || 0), 0),
          totalRevenue: merchandiseStats.reduce((sum, stat) => sum + (stat._sum.totalPrice || 0), 0),
        }
      };
      
    } catch (error) {
      console.error('Get event statistics error:', error);
      throw error;
    }
  }
  
  /**
   * Check if user can modify event registration
   */
  static canModifyRegistration(event, registration) {
    if (!event.allowFormModification) {
      return {
        canModify: false,
        reason: 'Form modification is not allowed for this event'
      };
    }
    
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const deadlineHours = event.formModificationDeadlineHours || 24;
    const modificationDeadline = new Date(eventDate.getTime() - (deadlineHours * 60 * 60 * 1000));
    
    if (now > modificationDeadline) {
      return {
        canModify: false,
        reason: `Registration modification deadline has passed (${deadlineHours} hours before event)`
      };
    }
    
    if (registration.status !== 'CONFIRMED') {
      return {
        canModify: false,
        reason: 'Only confirmed registrations can be modified'
      };
    }
    
    return {
      canModify: true,
      deadlineTime: modificationDeadline
    };
  }
  
  /**
   * Generate event slug from title
   */
  static generateSlug(title, suffix = '') {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    return suffix ? `${baseSlug}-${suffix}` : baseSlug;
  }
  
  /**
   * Validate event business rules
   */
  static validateEventData(eventData) {
    const errors = [];
    
    // Basic validation
    if (!eventData.title || eventData.title.trim().length < 3) {
      errors.push('Event title must be at least 3 characters long');
    }
    
    if (!eventData.description || eventData.description.trim().length < 10) {
      errors.push('Event description must be at least 10 characters long');
    }
    
    // Date validation
    if (eventData.eventDate) {
      const eventDate = new Date(eventData.eventDate);
      const now = new Date();
      
      if (eventDate < now) {
        errors.push('Event date cannot be in the past');
      }
      
      // Registration date validation
      if (eventData.registrationStartDate && eventData.registrationEndDate) {
        const regStart = new Date(eventData.registrationStartDate);
        const regEnd = new Date(eventData.registrationEndDate);
        
        if (regStart >= regEnd) {
          errors.push('Registration end date must be after start date');
        }
        
        if (regEnd > eventDate) {
          errors.push('Registration end date cannot be after event date');
        }
      }
    }
    
    // Time validation
    if (eventData.startTime && eventData.endTime) {
      const [startHour, startMin] = eventData.startTime.split(':').map(Number);
      const [endHour, endMin] = eventData.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (startMinutes >= endMinutes) {
        errors.push('End time must be after start time');
      }
    }
    
    // External link validation
    if (eventData.hasExternalLink && !eventData.externalRegistrationLink) {
      errors.push('External registration link is required when external link is enabled');
    }
    
    // Capacity validation
    if (eventData.maxCapacity && eventData.maxCapacity < 1) {
      errors.push('Maximum capacity must be at least 1');
    }
    
    // Fee validation
    if (eventData.registrationFee && eventData.registrationFee < 0) {
      errors.push('Registration fee cannot be negative');
    }
    
    if (eventData.guestFee && eventData.guestFee < 0) {
      errors.push('Guest fee cannot be negative');
    }
    
    return errors;
  }
  
  /**
   * Get upcoming events for user dashboard
   */
  static async getUpcomingEvents(limit = 5) {
    try {
      const now = new Date();
      
      const events = await prisma.event.findMany({
        where: {
          eventDate: { gte: now },
          status: {
            in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING']
          }
        },
        select: {
          id: true,
          title: true,
          slug: true,
          eventDate: true,
          startTime: true,
          venue: true,
          eventMode: true,
          hasRegistration: true,
          registrationFee: true,
          heroImage: true,
          category: {
            select: {
              id: true,
              name: true,
            }
          },
          _count: {
            select: {
              registrations: {
                where: { status: 'CONFIRMED' }
              }
            }
          }
        },
        orderBy: { eventDate: 'asc' },
        take: limit,
      });
      
      return events.map(event => ({
        ...event,
        registrationCount: event._count.registrations,
        _count: undefined,
      }));
      
    } catch (error) {
      console.error('Get upcoming events error:', error);
      throw error;
    }
  }
  
  /**
   * Get event dashboard statistics
   */
  static async getDashboardStats() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      const [
        totalEvents,
        upcomingEvents,
        draftEvents,
        recentRegistrations,
        totalRevenue
      ] = await Promise.all([
        prisma.event.count(),
        
        prisma.event.count({
          where: {
            eventDate: { gte: now },
            status: { in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED'] }
          }
        }),
        
        prisma.event.count({
          where: { status: 'DRAFT' }
        }),
        
        prisma.eventRegistration.count({
          where: {
            createdAt: { gte: thirtyDaysAgo },
            status: 'CONFIRMED'
          }
        }),
        
        prisma.eventRegistration.aggregate({
          where: { status: 'CONFIRMED' },
          _sum: { totalAmount: true }
        })
      ]);
      
      return {
        totalEvents,
        upcomingEvents,
        draftEvents,
        recentRegistrations,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        generatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Get event dashboard stats error:', error);
      throw error;
    }
  }
}

module.exports = EventService;