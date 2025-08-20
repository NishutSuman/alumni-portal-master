// src/controllers/eventRegistration.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');

// Get all registrations for an event (Super Admin only)
const getEventRegistrations = async (req, res) => {
  const { eventId } = req.params;
  const { status, search } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query, 20);
  
  try {
    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });
    
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Build where clause
    const whereClause = { eventId };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (search) {
      whereClause.user = {
        fullName: { contains: search, mode: 'insensitive' }
      };
    }
    
    // Get total count
    const total = await prisma.eventRegistration.count({ where: whereClause });
    
    // Get registrations
    const registrations = await prisma.eventRegistration.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
            batch: true,
            whatsappNumber: true,
          },
        },
        guests: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            mealPreference: true,
            status: true,
          },
        },
        formResponses: {
          include: {
            field: {
              select: {
                fieldLabel: true,
                fieldType: true,
              },
            },
          },
        },
      },
      orderBy: { registrationDate: 'desc' },
      skip,
      take: limit,
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, registrations, pagination, 'Event registrations retrieved successfully');
    
  } catch (error) {
    console.error('Get event registrations error:', error);
    return errorResponse(res, 'Failed to retrieve event registrations', 500);
  }
};

// Get registration statistics (Super Admin only)
const getRegistrationStats = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, maxCapacity: true },
    });
    
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    const [statusStats, paymentStats, totalRevenue, guestStats] = await Promise.all([
      // Registration status distribution
      prisma.eventRegistration.groupBy({
        by: ['status'],
        where: { eventId },
        _count: true,
      }),
      
      // Payment status distribution
      prisma.eventRegistration.groupBy({
        by: ['paymentStatus'],
        where: { eventId },
        _count: true,
      }),
      
      // Total revenue
      prisma.eventRegistration.aggregate({
        where: { eventId, status: 'CONFIRMED' },
        _sum: { totalAmount: true },
      }),
      
      // Guest statistics
      prisma.eventGuest.groupBy({
        by: ['status'],
        where: { registration: { eventId } },
        _count: true,
      }),
    ]);
    
    const stats = {
      event: {
        id: event.id,
        title: event.title,
        maxCapacity: event.maxCapacity,
      },
      registrations: {
        total: statusStats.reduce((sum, stat) => sum + stat._count, 0),
        byStatus: statusStats.map(stat => ({
          status: stat.status,
          count: stat._count,
        })),
      },
      payments: {
        byStatus: paymentStats.map(stat => ({
          status: stat.paymentStatus,
          count: stat._count,
        })),
        totalRevenue: totalRevenue._sum.totalAmount || 0,
      },
      guests: {
        total: guestStats.reduce((sum, stat) => sum + stat._count, 0),
        byStatus: guestStats.map(stat => ({
          status: stat.status,
          count: stat._count,
        })),
      },
    };
    
    return successResponse(res, { stats }, 'Registration statistics retrieved successfully');
    
  } catch (error) {
    console.error('Get registration stats error:', error);
    return errorResponse(res, 'Failed to retrieve registration statistics', 500);
  }
};

module.exports = {
  getEventRegistrations,
  getRegistrationStats,
};