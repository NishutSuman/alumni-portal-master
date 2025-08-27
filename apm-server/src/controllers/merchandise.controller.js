// src/controllers/merchandise.controller.js
// Standalone Merchandise Controller - Independent of Events

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
 * Get merchandise catalog (public)
 * GET /api/merchandise/catalog
 * Access: Public (no authentication required)
 */
const getMerchandiseCatalog = async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query, 12);
    const { search, category, includeInactive } = req.query;

    // Build where clause
    let whereClause = {};
    
    // Only show active items for public access
    if (includeInactive !== 'true') {
      whereClause.isActive = true;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category && category !== 'ALL') {
      whereClause.category = category;
    }

    const [total, merchandise] = await Promise.all([
      prisma.merchandise.count({ where: whereClause }),
      prisma.merchandise.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          images: true,
          availableSizes: true,
          stock: true,
          category: true,
          isActive: true,
          createdAt: true
        },
        orderBy: [
          { isActive: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      })
    ]);

    // Transform data for public consumption
    const transformedMerchandise = merchandise.map(item => ({
      ...item,
      isInStock: item.stock > 0,
      stockLevel: item.stock > 10 ? 'HIGH' : item.stock > 0 ? 'LOW' : 'OUT_OF_STOCK'
    }));

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(
      res,
      transformedMerchandise,
      pagination,
      'Merchandise catalog retrieved successfully'
    );

  } catch (error) {
    console.error('Get merchandise catalog error:', error);
    return errorResponse(res, 'Failed to retrieve merchandise catalog', 500);
  }
};

/**
 * Get single merchandise item details (public)
 * GET /api/merchandise/:merchandiseId
 * Access: Public (no authentication required)
 */
const getMerchandiseDetails = async (req, res) => {
  try {
    const { merchandiseId } = req.params;

    const merchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: true,
        availableSizes: true,
        stock: true,
        category: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!merchandise) {
      return res.status(404).json({
        success: false,
        message: 'Merchandise item not found'
      });
    }

    // Add computed fields
    const merchandiseWithDetails = {
      ...merchandise,
      isInStock: merchandise.stock > 0,
      stockLevel: merchandise.stock > 10 ? 'HIGH' : merchandise.stock > 0 ? 'LOW' : 'OUT_OF_STOCK',
      formattedPrice: `₹${merchandise.price}`,
      sizeOptions: merchandise.availableSizes.map(size => ({
        value: size,
        label: size,
        available: true // You could add size-specific stock in the future
      }))
    };

    return successResponse(
      res,
      { merchandise: merchandiseWithDetails },
      'Merchandise details retrieved successfully'
    );

  } catch (error) {
    console.error('Get merchandise details error:', error);
    return errorResponse(res, 'Failed to retrieve merchandise details', 500);
  }
};

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
      stock, 
      availableSizes, 
      category,
      isActive 
    } = req.body;
    const createdBy = req.user.id;

    // Check if merchandise with same name already exists
    const existingMerchandise = await prisma.merchandise.findFirst({
      where: { 
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingMerchandise) {
      return res.status(409).json({
        success: false,
        message: 'Merchandise with this name already exists'
      });
    }

    const merchandise = await prisma.merchandise.create({
      data: {
        name,
        description,
        price,
        stock: stock || 0,
        availableSizes: availableSizes || ['FREE_SIZE'],
        category,
        isActive: isActive !== undefined ? isActive : true,
        createdBy
      },
      include: {
        creator: {
          select: { fullName: true, email: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: createdBy,
        action: 'merchandise_created',
        details: {
          merchandiseId: merchandise.id,
          merchandiseName: merchandise.name,
          price: merchandise.price.toString(),
          stock: merchandise.stock
        }
      }
    });

    // Clear merchandise caches
    await MerchandiseService.clearMerchandiseCaches();

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
 * Update merchandise (admin only)
 * PUT /api/admin/merchandise/:merchandiseId
 * Access: SUPER_ADMIN
 */
const updateMerchandise = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const updateData = req.body;
    const updatedBy = req.user.id;

    // Get current merchandise
    const currentMerchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId }
    });

    if (!currentMerchandise) {
      return res.status(404).json({
        success: false,
        message: 'Merchandise not found'
      });
    }

    // Check for duplicate name if name is being updated
    if (updateData.name && updateData.name !== currentMerchandise.name) {
      const existingMerchandise = await prisma.merchandise.findFirst({
        where: { 
          name: { equals: updateData.name, mode: 'insensitive' },
          id: { not: merchandiseId }
        }
      });

      if (existingMerchandise) {
        return res.status(409).json({
          success: false,
          message: 'Merchandise with this name already exists'
        });
      }
    }

    const updatedMerchandise = await prisma.merchandise.update({
      where: { id: merchandiseId },
      data: updateData,
      include: {
        creator: {
          select: { fullName: true, email: true }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: updatedBy,
        action: 'merchandise_updated',
        details: {
          merchandiseId,
          merchandiseName: updatedMerchandise.name,
          changes: Object.keys(updateData)
        }
      }
    });

    // Clear merchandise caches
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
 * Delete merchandise (admin only)
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
      select: { 
        id: true, 
        name: true,
        _count: {
          select: {
            orderItems: true,
            cartItems: true
          }
        }
      }
    });

    if (!merchandise) {
      return res.status(404).json({
        success: false,
        message: 'Merchandise not found'
      });
    }

    // Check if merchandise has orders or cart items
    if (merchandise._count.orderItems > 0 || merchandise._count.cartItems > 0) {
      // Soft delete by deactivating instead of hard delete
      const deactivatedMerchandise = await prisma.merchandise.update({
        where: { id: merchandiseId },
        data: { isActive: false }
      });

      await prisma.activityLog.create({
        data: {
          userId: deletedBy,
          action: 'merchandise_deactivated',
          details: {
            merchandiseId,
            merchandiseName: merchandise.name,
            reason: 'Has existing orders or cart items'
          }
        }
      });

      return successResponse(
        res,
        { merchandise: deactivatedMerchandise },
        'Merchandise deactivated (has existing orders/cart items)'
      );
    }

    // Hard delete if no dependencies
    await prisma.merchandise.delete({
      where: { id: merchandiseId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: deletedBy,
        action: 'merchandise_deleted',
        details: {
          merchandiseId,
          merchandiseName: merchandise.name
        }
      }
    });

    // Clear merchandise caches
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
 * Update merchandise stock (admin only)
 * POST /api/admin/merchandise/:merchandiseId/stock
 * Access: SUPER_ADMIN
 */
const updateMerchandiseStock = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const { stock, reason } = req.body;
    const adminId = req.user.id;

    const updatedMerchandise = await MerchandiseService.updateStock(
      merchandiseId, 
      stock, 
      adminId
    );

    // Clear stock-related caches
    await MerchandiseService.clearMerchandiseCaches(merchandiseId);

    return successResponse(
      res,
      { 
        merchandise: {
          id: updatedMerchandise.id,
          name: updatedMerchandise.name,
          stock: updatedMerchandise.stock
        },
        reason
      },
      'Stock updated successfully'
    );

  } catch (error) {
    console.error('Update merchandise stock error:', error);
    
    if (error.message === 'Merchandise not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    return errorResponse(res, 'Failed to update stock', 500);
  }
};

/**
 * Upload merchandise images (admin only)
 * POST /api/admin/merchandise/:merchandiseId/images
 * Access: SUPER_ADMIN
 */
const uploadMerchandiseImages = async (req, res) => {
  try {
    const { merchandiseId } = req.params;
    const uploadedBy = req.user.id;
    const files = req.files;

    // Check if merchandise exists
    const merchandise = await prisma.merchandise.findUnique({
      where: { id: merchandiseId },
      select: { id: true, name: true, images: true }
    });

    if (!merchandise) {
      return res.status(404).json({
        success: false,
        message: 'Merchandise not found'
      });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Generate URLs for uploaded files (following your existing pattern)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const newImageUrls = files.map(file => {
      const relativePath = file.path.replace(process.cwd(), '').replace(/\\/g, '/');
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
 * Get merchandise analytics (admin only)
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

module.exports = {
  // Public endpoints
  getMerchandiseCatalog,
  getMerchandiseDetails,
  
  // Admin endpoints
  createMerchandise,
  updateMerchandise,
  deleteMerchandise,
  updateMerchandiseStock,
  uploadMerchandiseImages,
  getMerchandiseAnalytics
};