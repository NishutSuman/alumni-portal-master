// src/controllers/merchandiseAdmin.controller.js
// Admin Controller for Standalone Merchandise Management

const { prisma } = require('../../config/database');
const MerchandiseService = require('../../services/merchandise/merchandise.service');
const { 
  successResponse, 
  errorResponse, 
  paginatedResponse,
  getPaginationParams 
} = require('../../utils/response');

/**
 * Create new merchandise (admin only)
 * POST /api/admin/merchandise
 * Access: SUPER_ADMIN
 */
const createMerchandise = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      category,
      availableSizes,
      stock,
      isActive = false, // Default to inactive until admin releases
      lowStockThreshold = 5
    } = req.body;
    
    const createdBy = req.user.id;

    // Create merchandise
    const merchandise = await prisma.merchandise.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category: category || 'GENERAL',
        availableSizes: availableSizes || ['FREE_SIZE'],
        stock: parseInt(stock) || 0,
        isActive,
        lowStockThreshold: parseInt(lowStockThreshold),
        createdBy,
        images: []
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: createdBy,
        action: 'merchandise_created',
        details: {
          merchandiseId: merchandise.id,
          name: merchandise.name,
          price: merchandise.price,
          stock: merchandise.stock
        }
      }
    });

    return successResponse(
      res,
      { merchandise },
      'Merchandise created successfully',
      201
    );

  } catch (error) {
    console.error('Create merchandise error:', error);
    return errorResponse(res, 'Failed to create merchandise', 500);
  }
};

/**
 * Update merchandise
 * PUT /api/admin/merchandise/:merchandiseId
 * Access: SUPER_ADMIN
 */
const updateMerchandise = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const updateData = req.body;
    const updatedBy = req.user.id;

    // Check if merchandise exists
    const existingMerchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId }
    });

    if (!existingMerchandise) {
      return errorResponse(res, 'Merchandise not found', 404);
    }

    // Prepare update data
    const dataToUpdate = {};
    
    if (updateData.name) dataToUpdate.name = updateData.name;
    if (updateData.description) dataToUpdate.description = updateData.description;
    if (updateData.price) dataToUpdate.price = parseFloat(updateData.price);
    if (updateData.category) dataToUpdate.category = updateData.category;
    if (updateData.availableSizes) dataToUpdate.availableSizes = updateData.availableSizes;
    if (updateData.lowStockThreshold) dataToUpdate.lowStockThreshold = parseInt(updateData.lowStockThreshold);
    if (typeof updateData.isActive === 'boolean') dataToUpdate.isActive = updateData.isActive;

    // Update merchandise
    const updatedMerchandise = await prisma.merchandise.update({
      where: { id: merchandiseId },
      data: dataToUpdate
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: updatedBy,
        action: 'merchandise_updated',
        details: {
          merchandiseId,
          changes: dataToUpdate,
          previousValues: {
            name: existingMerchandise.name,
            price: existingMerchandise.price,
            isActive: existingMerchandise.isActive
          }
        }
      }
    });

    // Clear caches
    await MerchandiseService.clearMerchandiseCaches(merchandiseId);

    return successResponse(
      res,
      { merchandise: updatedMerchandise },
      'Merchandise updated successfully'
    );

  } catch (error) {
    console.error('Update merchandise error:', error);
    return errorResponse(res, 'Failed to update merchandise', 500);
  }
};

/**
 * Delete merchandise (soft delete)
 * DELETE /api/admin/merchandise/:merchandiseId
 * Access: SUPER_ADMIN
 */
const deleteMerchandise = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const deletedBy = req.user.id;

    // Check if merchandise exists
    const merchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId },
      include: {
        _count: {
          select: {
            orders: { where: { status: { in: ['PENDING', 'CONFIRMED'] } } }
          }
        }
      }
    });

    if (!merchandise) {
      return errorResponse(res, 'Merchandise not found', 404);
    }

    // Check if there are pending orders
    if (merchandise._count.orders > 0) {
      return errorResponse(
        res,
        'Cannot delete merchandise with pending orders',
        400
      );
    }

    // Soft delete - mark as inactive
    await prisma.merchandise.update({
      where: { id: merchandiseId },
      data: { 
        isActive: false,
        deletedAt: new Date()
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: deletedBy,
        action: 'merchandise_deleted',
        details: {
          merchandiseId,
          name: merchandise.name,
          reason: 'Admin deletion'
        }
      }
    });

    // Clear caches
    await MerchandiseService.clearMerchandiseCaches(merchandiseId);

    return successResponse(
      res,
      { merchandiseId },
      'Merchandise deleted successfully'
    );

  } catch (error) {
    console.error('Delete merchandise error:', error);
    return errorResponse(res, 'Failed to delete merchandise', 500);
  }
};

/**
 * Update merchandise stock
 * POST /api/admin/merchandise/:merchandiseId/stock
 * Access: SUPER_ADMIN
 */
const updateMerchandiseStock = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const { stock, reason } = req.body;
    const updatedBy = req.user.id;

    // Validate stock value
    const stockValue = parseInt(stock);
    if (isNaN(stockValue) || stockValue < 0) {
      return errorResponse(res, 'Invalid stock value', 400);
    }

    // Check if merchandise exists
    const merchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId }
    });

    if (!merchandise) {
      return errorResponse(res, 'Merchandise not found', 404);
    }

    const previousStock = merchandise.stock;

    // Update stock
    const updatedMerchandise = await prisma.merchandise.update({
      where: { id: merchandiseId },
      data: { stock: stockValue }
    });

    // Log stock change
    await prisma.activityLog.create({
      data: {
        userId: updatedBy,
        action: 'merchandise_stock_updated',
        details: {
          merchandiseId,
          name: merchandise.name,
          previousStock,
          newStock: stockValue,
          reason: reason || 'Manual stock update'
        }
      }
    });

    // Clear stock caches
    await MerchandiseService.clearStockCaches(merchandiseId);

    return successResponse(
      res,
      { 
        merchandise: {
          id: updatedMerchandise.id,
          name: updatedMerchandise.name,
          stock: updatedMerchandise.stock,
          previousStock
        }
      },
      'Stock updated successfully'
    );

  } catch (error) {
    console.error('Update stock error:', error);
    return errorResponse(res, 'Failed to update stock', 500);
  }
};

/**
 * Upload merchandise images
 * POST /api/admin/merchandise/:merchandiseId/images
 * Access: SUPER_ADMIN
 */
const uploadMerchandiseImages = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const files = req.files;
    const uploadedBy = req.user.id;

    if (!files || files.length === 0) {
      return errorResponse(res, 'No files uploaded', 400);
    }

    // Check if merchandise exists
    const merchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId },
      select: { id: true, name: true, images: true }
    });

    if (!merchandise) {
      return errorResponse(res, 'Merchandise not found', 404);
    }

    // Generate URLs for uploaded files
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const newImageUrls = files.map(file => {
      const relativePath = file.path
        .replace(process.cwd(), '')
        .replace(/\\/g, '/');
      return `${baseUrl}${relativePath}`;
    });

    // Update merchandise with new image URLs
    const existingImages = merchandise.images || [];
    const updatedImages = [...existingImages, ...newImageUrls];

    const updatedMerchandise = await prisma.merchandise.update({
      where: { id: merchandiseId },
      data: { images: updatedImages }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: uploadedBy,
        action: 'merchandise_images_uploaded',
        details: {
          merchandiseId,
          merchandiseName: merchandise.name,
          uploadedCount: files.length,
          totalImages: updatedImages.length
        }
      }
    });

    // Clear merchandise caches
    await MerchandiseService.clearMerchandiseCaches(merchandiseId);

    return successResponse(
      res,
      {
        merchandise: {
          id: updatedMerchandise.id,
          name: updatedMerchandise.name,
          images: updatedMerchandise.images
        },
        uploadedImages: newImageUrls,
        uploadCount: files.length
      },
      `${files.length} image(s) uploaded successfully`
    );

  } catch (error) {
    console.error('Upload merchandise images error:', error);
    return errorResponse(res, 'Failed to upload images', 500);
  }
};

/**
 * Release merchandise for sale (admin approval workflow)
 * POST /api/admin/merchandise/:merchandiseId/release
 * Access: SUPER_ADMIN
 */
const releaseMerchandise = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const { releaseNotes } = req.body;
    const releasedBy = req.user.id;

    // Check merchandise and validate for release
    const merchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId }
    });

    if (!merchandise) {
      return errorResponse(res, 'Merchandise not found', 404);
    }

    if (merchandise.isActive) {
      return errorResponse(res, 'Merchandise is already released', 400);
    }

    // Validation before release
    const validationErrors = [];
    
    if (!merchandise.name || merchandise.name.trim().length === 0) {
      validationErrors.push('Name is required');
    }
    
    if (!merchandise.price || merchandise.price <= 0) {
      validationErrors.push('Valid price is required');
    }
    
    if (!merchandise.stock || merchandise.stock <= 0) {
      validationErrors.push('Stock must be set before release');
    }
    
    if (!merchandise.images || merchandise.images.length === 0) {
      validationErrors.push('At least one image is required');
    }

    if (validationErrors.length > 0) {
      return errorResponse(
        res,
        'Cannot release merchandise. Please fix the following issues:',
        400,
        { validationErrors }
      );
    }

    // Release merchandise
    const updatedMerchandise = await prisma.merchandise.update({
      where: { id: merchandiseId },
      data: { 
        isActive: true,
        releasedAt: new Date(),
        releasedBy
      }
    });

    // Log release activity
    await prisma.activityLog.create({
      data: {
        userId: releasedBy,
        action: 'merchandise_released',
        details: {
          merchandiseId,
          name: merchandise.name,
          stock: merchandise.stock,
          price: merchandise.price,
          releaseNotes: releaseNotes || 'Merchandise released for sale'
        }
      }
    });

    // Clear all merchandise caches
    await MerchandiseService.clearAllMerchandiseCaches();

    return successResponse(
      res,
      { 
        merchandise: {
          id: updatedMerchandise.id,
          name: updatedMerchandise.name,
          isActive: updatedMerchandise.isActive,
          releasedAt: updatedMerchandise.releasedAt
        }
      },
      'Merchandise released successfully'
    );

  } catch (error) {
    console.error('Release merchandise error:', error);
    return errorResponse(res, 'Failed to release merchandise', 500);
  }
};

/**
 * Get all orders (admin)
 * GET /api/admin/merchandise/orders
 * Access: SUPER_ADMIN
 */
const getAllOrders = async (req, res) => {
  try {
    const { page, limit, status, deliveryStatus, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const { offset, pageSize } = getPaginationParams(page, limit);

    // Build where clause
    const whereClause = {};
    
    if (status) {
      whereClause.status = status.toUpperCase();
    }
    
    if (deliveryStatus) {
      whereClause.deliveryStatus = deliveryStatus.toUpperCase();
    }
    
    if (search) {
      whereClause.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get orders with pagination
    const [orders, totalCount] = await Promise.all([
      prisma.merchandiseOrder.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              graduationYear: true
            }
          },
          items: {
            include: {
              merchandise: {
                select: {
                  id: true,
                  name: true,
                  images: true
                }
              }
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: pageSize
      }),
      prisma.merchandiseOrder.count({ where: whereClause })
    ]);

    // Calculate summary statistics
    const statusCounts = await prisma.merchandiseOrder.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    const deliveryStatusCounts = await prisma.merchandiseOrder.groupBy({
      by: ['deliveryStatus'],
      _count: { deliveryStatus: true }
    });

    const summary = {
      total: totalCount,
      statusBreakdown: statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      deliveryBreakdown: deliveryStatusCounts.reduce((acc, item) => {
        acc[item.deliveryStatus] = item._count.deliveryStatus;
        return acc;
      }, {})
    };

    return paginatedResponse(
      res,
      orders,
      {
        page: parseInt(page) || 1,
        limit: pageSize,
        total: totalCount,
        summary
      },
      'Orders retrieved successfully'
    );

  } catch (error) {
    console.error('Get all orders error:', error);
    return errorResponse(res, 'Failed to retrieve orders', 500);
  }
};

/**
 * Mark order as delivered
 * POST /api/admin/merchandise/orders/:orderId/delivered
 * Access: SUPER_ADMIN
 */
const markOrderDelivered = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryNotes, confirmationPhoto, recipientName } = req.body;
    const deliveredBy = req.user.id;

    // Check if order exists
    const order = await prisma.merchandiseOrder.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { fullName: true, email: true } },
        items: {
          include: {
            merchandise: { select: { name: true } }
          }
        }
      }
    });

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    if (order.deliveryStatus === 'DELIVERED') {
      return errorResponse(res, 'Order is already marked as delivered', 400);
    }

    if (order.status !== 'CONFIRMED') {
      return errorResponse(res, 'Order must be confirmed before delivery', 400);
    }

    // Update order delivery status
    const updatedOrder = await prisma.merchandiseOrder.update({
      where: { id: orderId },
      data: {
        deliveryStatus: 'DELIVERED',
        deliveredAt: new Date(),
        deliveredBy: req.user.fullName || req.user.email,
        deliveryNotes
      }
    });

    // Create delivery record
    await prisma.merchandiseDelivery.create({
      data: {
        orderId,
        deliveredBy: req.user.fullName || req.user.email,
        deliveredAt: new Date(),
        deliveryNotes,
        confirmationPhoto,
        recipientName: recipientName || order.user.fullName,
        deliveryLocation: 'Office/Event Location', // You can make this dynamic
        status: 'DELIVERED'
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: deliveredBy,
        action: 'merchandise_order_delivered',
        details: {
          orderId,
          orderNumber: order.orderNumber,
          customerName: order.user.fullName,
          itemCount: order.items.length,
          deliveryNotes
        }
      }
    });

    // Send delivery confirmation email (implement this based on your email service)
    // await EmailService.sendDeliveryConfirmation(order);

    // Clear order caches
    await MerchandiseService.clearOrderCaches(order.orderNumber);

    return successResponse(
      res,
      {
        order: {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          deliveryStatus: updatedOrder.deliveryStatus,
          deliveredAt: updatedOrder.deliveredAt
        }
      },
      'Order marked as delivered successfully'
    );

  } catch (error) {
    console.error('Mark order delivered error:', error);
    return errorResponse(res, 'Failed to mark order as delivered', 500);
  }
};

/**
 * Get merchandise analytics
 * GET /api/admin/merchandise/analytics
 * Access: SUPER_ADMIN
 */
const getMerchandiseAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;

    const analytics = await MerchandiseService.getMerchandiseAnalytics({
      startDate,
      endDate,
      category
    });

    return successResponse(
      res,
      { analytics },
      'Merchandise analytics retrieved successfully'
    );

  } catch (error) {
    console.error('Get merchandise analytics error:', error);
    return errorResponse(res, 'Failed to retrieve analytics', 500);
  }
};

/**
 * Get low stock alerts
 * GET /api/admin/merchandise/stock-alerts
 * Access: SUPER_ADMIN
 */
const getLowStockAlerts = async (req, res) => {
  try {
    const lowStockItems = await prisma.merchandise.findMany({
      where: {
        isActive: true,
        OR: [
          { stock: { lte: prisma.merchandise.fields.lowStockThreshold } },
          { stock: { lte: 5 } } // Default threshold
        ]
      },
      select: {
        id: true,
        name: true,
        stock: true,
        lowStockThreshold: true,
        category: true,
        price: true
      },
      orderBy: { stock: 'asc' }
    });

    const criticalStockItems = lowStockItems.filter(item => item.stock <= 2);
    const outOfStockItems = lowStockItems.filter(item => item.stock === 0);

    return successResponse(
      res,
      {
        lowStockItems,
        summary: {
          total: lowStockItems.length,
          critical: criticalStockItems.length,
          outOfStock: outOfStockItems.length
        }
      },
      'Stock alerts retrieved successfully'
    );

  } catch (error) {
    console.error('Get low stock alerts error:', error);
    return errorResponse(res, 'Failed to retrieve stock alerts', 500);
  }
};

module.exports = {
  // Merchandise management
  createMerchandise,
  updateMerchandise,
  deleteMerchandise,
  updateMerchandiseStock,
  uploadMerchandiseImages,
  releaseMerchandise,
  
  // Order management
  getAllOrders,
  markOrderDelivered,
  
  // Analytics and monitoring
  getMerchandiseAnalytics,
  getLowStockAlerts
};