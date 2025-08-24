// src/controllers/merchandise/MerchandiseDeliveryController.js
const { successResponse, errorResponse, paginatedResponse, getPaginationParams } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * @desc    Mark merchandise order as delivered
 * @route   POST /api/merchandise/orders/:orderId/deliver
 * @access  Private (SUPER_ADMIN)
 */
const markAsDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { 
      recipientName, 
      deliveryNotes, 
      confirmationPhoto, 
      deliveryLocation 
    } = req.body;

    // Validate order exists and is ready for delivery
    const order = await prisma.eventMerchandiseOrder.findUnique({
      where: { id: orderId },
      include: {
        merchandise: {
          select: {
            name: true,
            images: true
          }
        },
        registration: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true
              }
            },
            event: {
              select: {
                title: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return errorResponse(res, 'Merchandise order not found', 404);
    }

    if (order.paymentStatus !== 'COMPLETED') {
      return errorResponse(res, 'Order payment is not completed', 400);
    }

    // Check if already delivered
    const existingDelivery = await prisma.merchandiseDelivery.findUnique({
      where: { orderId }
    });

    if (existingDelivery) {
      return errorResponse(res, 'Order is already marked as delivered', 409);
    }

    // Create delivery record
    const delivery = await prisma.merchandiseDelivery.create({
      data: {
        orderId,
        deliveredBy: req.user.id,
        recipientName: recipientName || order.registration.user.fullName,
        deliveryNotes,
        confirmationPhoto,
        deliveryLocation,
        status: 'DELIVERED'
      },
      include: {
        order: {
          include: {
            merchandise: true,
            registration: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        deliveryStaff: {
          select: {
            fullName: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'merchandise_delivered',
        details: {
          orderId,
          merchandiseName: order.merchandise.name,
          recipientName: delivery.recipientName,
          registrationId: order.registrationId,
          eventTitle: order.registration.event.title
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      delivery: {
        id: delivery.id,
        deliveredAt: delivery.deliveredAt,
        recipientName: delivery.recipientName,
        deliveryNotes: delivery.deliveryNotes,
        deliveryLocation: delivery.deliveryLocation,
        status: delivery.status
      },
      order: {
        id: order.id,
        merchandiseName: order.merchandise.name,
        quantity: order.quantity,
        selectedSize: order.selectedSize
      },
      customer: {
        name: order.registration.user.fullName,
        email: order.registration.user.email
      },
      deliveryStaff: delivery.deliveryStaff.fullName
    }, 'Merchandise marked as delivered successfully');

  } catch (error) {
    console.error('Mark as delivered error:', error);
    return errorResponse(res, 'Failed to mark merchandise as delivered', 500);
  }
};

/**
 * @desc    Get merchandise deliveries for an event
 * @route   GET /api/events/:eventId/merchandise-deliveries
 * @access  Private (SUPER_ADMIN)
 */
const getEventDeliveries = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, page = 1, limit = 20, search } = req.query;
    const { skip } = getPaginationParams({ page, limit }, 20);

    // Build where clause
    const whereClause = {
      order: {
        registration: { eventId }
      }
    };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { recipientName: { contains: search, mode: 'insensitive' } },
        { order: { merchandise: { name: { contains: search, mode: 'insensitive' } } } }
      ];
    }

    const [deliveries, totalCount] = await Promise.all([
      prisma.merchandiseDelivery.findMany({
        where: whereClause,
        include: {
          order: {
            include: {
              merchandise: {
                select: {
                  name: true,
                  images: true
                }
              },
              registration: {
                include: {
                  user: {
                    select: {
                      fullName: true,
                      email: true
                    }
                  }
                }
              }
            }
          },
          deliveryStaff: {
            select: {
              fullName: true
            }
          }
        },
        orderBy: { deliveredAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),

      prisma.merchandiseDelivery.count({ where: whereClause })
    ]);

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalItems: totalCount,
      itemsPerPage: parseInt(limit)
    };

    return paginatedResponse(res, deliveries, pagination, 'Merchandise deliveries retrieved successfully');

  } catch (error) {
    console.error('Get event deliveries error:', error);
    return errorResponse(res, 'Failed to retrieve merchandise deliveries', 500);
  }
};

/**
 * @desc    Get delivery statistics
 * @route   GET /api/events/:eventId/delivery-stats
 * @access  Private (SUPER_ADMIN)
 */
const getDeliveryStats = async (req, res) => {
  try {
    const { eventId } = req.params;

    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(emo.id) as total_orders,
        COUNT(md.id) as delivered_orders,
        COUNT(CASE WHEN emo.payment_status = 'COMPLETED' AND md.id IS NULL THEN 1 END) as pending_deliveries,
        ROUND(
          (COUNT(md.id)::decimal / COUNT(emo.id) * 100), 2
        ) as delivery_rate,
        SUM(emo.total_price) as total_order_value,
        SUM(CASE WHEN md.id IS NOT NULL THEN emo.total_price ELSE 0 END) as delivered_value
      FROM event_merchandise_orders emo
      JOIN event_registrations er ON emo.registration_id = er.id
      LEFT JOIN merchandise_deliveries md ON emo.id = md.order_id
      WHERE er.event_id = ${eventId}
        AND emo.payment_status = 'COMPLETED'
    `;

    const stat = stats[0];

    return successResponse(res, {
      totalOrders: Number(stat.total_orders),
      deliveredOrders: Number(stat.delivered_orders),
      pendingDeliveries: Number(stat.pending_deliveries),
      deliveryRate: Number(stat.delivery_rate),
      totalOrderValue: Number(stat.total_order_value),
      deliveredValue: Number(stat.delivered_value)
    }, 'Delivery statistics retrieved successfully');

  } catch (error) {
    console.error('Get delivery stats error:', error);
    return errorResponse(res, 'Failed to retrieve delivery statistics', 500);
  }
};

module.exports = {
  markAsDelivered,
  getEventDeliveries,
  getDeliveryStats
};