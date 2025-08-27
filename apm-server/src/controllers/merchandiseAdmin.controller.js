// src/controllers/merchandiseAdmin.controller.js
// Standalone Merchandise Admin Controller - Independent of Events

const MerchandiseService = require('../services/merchandise.service');
const { prisma } = require('../config/database');
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPaginationParams,
  calculatePagination
} = require('../utils/response');

/**
 * Get all merchandise orders (admin)
 * GET /api/admin/merchandise/orders
 * Access: SUPER_ADMIN
 */
const getAllOrders = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query, 20);
    const { search, status, deliveryStatus, startDate, endDate } = req.query;

    // Build where clause
    let whereClause = {};

    if (search) {
      whereClause.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (deliveryStatus && deliveryStatus !== 'ALL') {
      whereClause.deliveryStatus = deliveryStatus;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const [total, orders] = await Promise.all([
      prisma.merchandiseOrder.count({ where: whereClause }),
      prisma.merchandiseOrder.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              batch: true
            }
          },
          items: {
            include: {
              merchandise: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  images: true
                }
              }
            }
          },
          paymentTransaction: {
            select: {
              id: true,
              status: true,
              transactionNumber: true,
              completedAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    // Transform orders for admin view
    const transformedOrders = orders.map(order => {
      const itemCount = order.items.length;
      const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const categories = [...new Set(order.items.map(item => item.merchandise.category))];

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customer: {
          name: order.user.fullName,
          email: order.user.email,
          batch: order.user.batch
        },
        totalAmount: order.totalAmount,
        formattedAmount: `₹${order.totalAmount}`,
        status: order.status,
        deliveryStatus: order.deliveryStatus,
        paymentStatus: order.paymentStatus,
        itemCount,
        totalQuantity,
        categories,
        paymentTransaction: order.paymentTransaction,
        deliveredAt: order.deliveredAt,
        deliveredBy: order.deliveredBy,
        createdAt: order.createdAt,
        canMarkDelivered: order.deliveryStatus === 'PENDING' && order.paymentStatus === 'COMPLETED'
      };
    });

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(res, transformedOrders, pagination, 'Orders retrieved successfully');

  } catch (error) {
    console.error('Get all orders error:', error);
    return errorResponse(res, 'Failed to retrieve orders', 500);
  }
};

/**
 * Mark order as delivered (admin)
 * POST /api/admin/merchandise/orders/:orderId/delivered
 * Access: SUPER_ADMIN
 */
const markOrderDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryNotes, confirmationPhoto } = req.body;
    const adminId = req.user.id;

    const updatedOrder = await MerchandiseService.markOrderDelivered(
      orderId, 
      adminId, 
      deliveryNotes
    );

    // Get full order details for response
    const orderDetails = await prisma.merchandiseOrder.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            fullName: true,
            email: true
          }
        },
        items: {
          include: {
            merchandise: {
              select: {
                name: true,
                category: true
              }
            }
          }
        }
      }
    });

    // TODO: Send delivery confirmation email to customer
    console.log(`📧 Order delivered notification should be sent to: ${orderDetails.user.email}`);

    return successResponse(res, {
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        deliveryStatus: updatedOrder.deliveryStatus,
        deliveredAt: updatedOrder.deliveredAt,
        deliveryNotes: updatedOrder.deliveryNotes,
        customer: orderDetails.user,
        items: orderDetails.items
      }
    }, 'Order marked as delivered successfully');

  } catch (error) {
    console.error('Mark order delivered error:', error);
    
    if (error.message === 'Order not found') {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (error.message.includes('already marked as delivered')) {
      return res.status(409).json({
        success: false,
        message: 'Order already marked as delivered'
      });
    }

    return errorResponse(res, 'Failed to mark order as delivered', 500);
  }
};

/**
 * Get order statistics (admin)
 * GET /api/admin/merchandise/stats
 * Access: SUPER_ADMIN
 */
const getOrderStatistics = async (req, res) => {
  try {
    const { period = '30', category } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(period));

    const analytics = await MerchandiseService.getMerchandiseAnalytics({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      category
    });

    // Get additional admin-specific statistics
    const [
      pendingOrders,
      pendingDeliveries,
      lowStockItems,
      totalCustomers
    ] = await Promise.all([
      // Pending orders count
      prisma.merchandiseOrder.count({
        where: {
          status: 'PENDING',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Pending deliveries count
      prisma.merchandiseOrder.count({
        where: {
          deliveryStatus: 'PENDING',
          paymentStatus: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // Low stock items (stock <= 5)
      prisma.merchandise.findMany({
        where: {
          stock: { lte: 5 },
          isActive: true
        },
        select: {
          id: true,
          name: true,
          stock: true,
          category: true
        }
      }),

      // Total unique customers who placed orders
      prisma.merchandiseOrder.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: true
      })
    ]);

    const adminStats = {
      ...analytics,
      adminMetrics: {
        pendingOrders,
        pendingDeliveries,
        lowStockItemsCount: lowStockItems.length,
        totalCustomers: totalCustomers.length,
        lowStockItems,
        period: parseInt(period)
      }
    };

    return successResponse(res, {
      statistics: adminStats
    }, 'Order statistics retrieved successfully');

  } catch (error) {
    console.error('Get order statistics error:', error);
    return errorResponse(res, 'Failed to retrieve statistics', 500);
  }
};

/**
 * Get stock alerts (admin)
 * GET /api/admin/merchandise/stock-alerts
 * Access: SUPER_ADMIN
 */
const getStockAlerts = async (req, res) => {
  try {
    const { threshold = 10 } = req.query;

    const lowStockItems = await prisma.merchandise.findMany({
      where: {
        stock: { lte: parseInt(threshold) },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        stock: true,
        category: true,
        price: true,
        images: true,
        createdAt: true
      },
      orderBy: [
        { stock: 'asc' },
        { name: 'asc' }
      ]
    });

    // Categorize alerts
    const alerts = {
      critical: lowStockItems.filter(item => item.stock === 0),
      warning: lowStockItems.filter(item => item.stock > 0 && item.stock <= 5),
      low: lowStockItems.filter(item => item.stock > 5 && item.stock <= parseInt(threshold))
    };

    const summary = {
      total: lowStockItems.length,
      critical: alerts.critical.length,
      warning: alerts.warning.length,
      low: alerts.low.length
    };

    return successResponse(res, {
      alerts,
      summary,
      threshold: parseInt(threshold)
    }, 'Stock alerts retrieved successfully');

  } catch (error) {
    console.error('Get stock alerts error:', error);
    return errorResponse(res, 'Failed to retrieve stock alerts', 500);
  }
};

/**
 * Update order status (admin)
 * PUT /api/admin/merchandise/orders/:orderId/status
 * Access: SUPER_ADMIN
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user.id;

    // Validate status
    const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status',
        validStatuses
      });
    }

    // Get current order
    const currentOrder = await prisma.merchandiseOrder.findUnique({
      where: { id: orderId },
      select: { 
        id: true, 
        orderNumber: true, 
        status: true,
        userId: true,
        totalAmount: true
      }
    });

    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order status
    const updatedOrder = await prisma.merchandiseOrder.update({
      where: { id: orderId },
      data: { 
        status,
        ...(status === 'DELIVERED' && { 
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(),
          deliveredBy: adminId 
        })
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'merchandise_order_status_updated',
        details: {
          orderId,
          orderNumber: currentOrder.orderNumber,
          oldStatus: currentOrder.status,
          newStatus: status,
          reason: reason || 'Admin status update'
        }
      }
    });

    return successResponse(res, {
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        deliveryStatus: updatedOrder.deliveryStatus
      }
    }, 'Order status updated successfully');

  } catch (error) {
    console.error('Update order status error:', error);
    return errorResponse(res, 'Failed to update order status', 500);
  }
};

/**
 * Get customer order history (admin)
 * GET /api/admin/merchandise/customers/:userId/orders
 * Access: SUPER_ADMIN
 */
const getCustomerOrderHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit, skip } = getPaginationParams(req.query, 10);

    // Get customer details
    const customer = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        batch: true,
        isActive: true
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer's orders
    const [total, orders] = await Promise.all([
      prisma.merchandiseOrder.count({ where: { userId } }),
      prisma.merchandiseOrder.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              merchandise: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  images: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    // Calculate customer statistics
    const customerStats = await prisma.merchandiseOrder.aggregate({
      where: { 
        userId,
        paymentStatus: 'COMPLETED'
      },
      _sum: { totalAmount: true },
      _count: true
    });

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(res, orders, pagination, 'Customer order history retrieved successfully', {
      customer,
      customerStats: {
        totalOrders: customerStats._count,
        totalSpent: customerStats._sum.totalAmount || 0,
        averageOrderValue: customerStats._count > 0 
          ? (customerStats._sum.totalAmount || 0) / customerStats._count 
          : 0
      }
    });

  } catch (error) {
    console.error('Get customer order history error:', error);
    return errorResponse(res, 'Failed to retrieve customer order history', 500);
  }
};

module.exports = {
  // Order management
  getAllOrders,
  markOrderDelivered,
  updateOrderStatus,
  
  // Analytics and reporting
  getOrderStatistics,
  getStockAlerts,
  
  // Customer management
  getCustomerOrderHistory
};