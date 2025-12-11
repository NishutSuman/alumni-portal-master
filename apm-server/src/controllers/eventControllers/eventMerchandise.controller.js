// src/controllers/eventControllers/eventMerchandise.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { getTenantFilter, getTenantData } = require('../../utils/tenant.util');

// Add merchandise item (Admin only)
const addMerchandise = async (req, res) => {
  const { eventId } = req.params;
  const { name, description, price, availableSizes, stockQuantity } = req.body;
  const userId = req.user.id;

  try {
    // Check if event exists and has merchandise enabled
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: {
        id: true,
        title: true,
        hasMerchandise: true,
        status: true
      }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    if (!event.hasMerchandise) {
      return errorResponse(res, 'Merchandise is not enabled for this event', 400);
    }

    // Get the next order index
    const lastItem = await prisma.eventMerchandise.findFirst({
      where: { eventId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });

    const nextOrderIndex = (lastItem?.orderIndex || 0) + 1;

    // Create merchandise item
    const merchandise = await prisma.eventMerchandise.create({
      data: {
        eventId,
        name,
        description: description || null,
        price: parseFloat(price),
        availableSizes: availableSizes || [],
        stockQuantity: stockQuantity ? parseInt(stockQuantity) : null,
        orderIndex: nextOrderIndex,
        isActive: true
      }
    });

    // Log activity using existing pattern
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_create',
        details: {
          eventId,
          merchandiseId: merchandise.id,
          merchandiseName: name,
          price: parseFloat(price)
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }
    });

    return successResponse(res, merchandise, 'Merchandise item added successfully', 201);

  } catch (error) {
    console.error('Add merchandise error:', error);
    return errorResponse(res, 'Failed to add merchandise item', 500);
  }
};

// Get all merchandise for event (Public)
const getEventMerchandise = async (req, res) => {
  const { eventId } = req.params;
  const { includeInactive = false } = req.query;

  try {
    // Check if event exists
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: {
        id: true,
        title: true,
        hasMerchandise: true
      }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    if (!event.hasMerchandise) {
      return successResponse(res, {
        event: { id: event.id, title: event.title },
        merchandise: [],
        hasMerchandise: false
      }, 'Merchandise not available for this event');
    }

    // Build where clause
    const whereClause = { eventId };
    
    // Only show active items to public users, admins can see all
    if (!includeInactive || req.user?.role !== 'SUPER_ADMIN') {
      whereClause.isActive = true;
    }

    const merchandise = await prisma.eventMerchandise.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: true,
        availableSizes: true,
        stockQuantity: true,
        isActive: true,
        orderIndex: true,
        createdAt: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    return successResponse(res, {
      event: { id: event.id, title: event.title },
      merchandise,
      hasMerchandise: true,
      totalItems: merchandise.length
    }, 'Event merchandise retrieved successfully');

  } catch (error) {
    console.error('Get event merchandise error:', error);
    return errorResponse(res, 'Failed to retrieve merchandise', 500);
  }
};

// Get single merchandise item (Public)
const getMerchandiseItem = async (req, res) => {
  const { eventId, itemId } = req.params;

  try {
    const merchandise = await prisma.eventMerchandise.findFirst({
      where: {
        id: itemId,
        eventId,
        event: { ...getTenantFilter(req) },
        ...(req.user?.role !== 'SUPER_ADMIN' && { isActive: true })
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        images: true,
        availableSizes: true,
        stockQuantity: true,
        isActive: true,
        orderIndex: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            hasMerchandise: true
          }
        }
      }
    });

    if (!merchandise) {
      return errorResponse(res, 'Merchandise item not found', 404);
    }

    return successResponse(res, merchandise, 'Merchandise item retrieved successfully');

  } catch (error) {
    console.error('Get merchandise item error:', error);
    return errorResponse(res, 'Failed to retrieve merchandise item', 500);
  }
};

// Update merchandise item (Admin only)
const updateMerchandise = async (req, res) => {
  const { eventId, itemId } = req.params;
  const { name, description, price, availableSizes, stockQuantity, isActive } = req.body;
  const userId = req.user.id;

  try {
    // Check if merchandise item exists
    const existingItem = await prisma.eventMerchandise.findFirst({
      where: {
        id: itemId,
        eventId,
        event: { ...getTenantFilter(req) }
      }
    });

    if (!existingItem) {
      return errorResponse(res, 'Merchandise item not found', 404);
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (availableSizes !== undefined) updateData.availableSizes = availableSizes;
    if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity ? parseInt(stockQuantity) : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update merchandise item
    const updatedMerchandise = await prisma.eventMerchandise.update({
      where: { id: itemId },
      data: updateData
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_update',
        details: {
          eventId,
          merchandiseId: itemId,
          updates: updateData
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }
    });

    return successResponse(res, updatedMerchandise, 'Merchandise item updated successfully');

  } catch (error) {
    console.error('Update merchandise error:', error);
    return errorResponse(res, 'Failed to update merchandise item', 500);
  }
};

// Delete merchandise item (Admin only)
const deleteMerchandise = async (req, res) => {
  const { eventId, itemId } = req.params;
  const userId = req.user.id;

  try {
    // Check if merchandise item exists
    const existingItem = await prisma.eventMerchandise.findFirst({
      where: {
        id: itemId,
        eventId,
        event: { ...getTenantFilter(req) }
      },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    if (!existingItem) {
      return errorResponse(res, 'Merchandise item not found', 404);
    }

    // Check if item has orders
    if (existingItem._count.orders > 0) {
      return errorResponse(res, 'Cannot delete merchandise item with existing orders. Set as inactive instead.', 400);
    }

    // Delete merchandise item
    await prisma.eventMerchandise.delete({
      where: { id: itemId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_delete',
        details: {
          eventId,
          merchandiseId: itemId,
          merchandiseName: existingItem.name
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }
    });

    return successResponse(res, null, 'Merchandise item deleted successfully');

  } catch (error) {
    console.error('Delete merchandise error:', error);
    return errorResponse(res, 'Failed to delete merchandise item', 500);
  }
};

// Reorder merchandise items (Admin only)
const reorderMerchandise = async (req, res) => {
  const { eventId } = req.params;
  const { itemOrders } = req.body;
  const userId = req.user.id;

  try {
    // Validate all items belong to the event
    const itemIds = itemOrders.map(item => item.id);
    const existingItems = await prisma.eventMerchandise.findMany({
      where: {
        id: { in: itemIds },
        eventId,
        event: { ...getTenantFilter(req) }
      },
      select: { id: true }
    });

    if (existingItems.length !== itemIds.length) {
      return errorResponse(res, 'Some merchandise items not found', 400);
    }

    // Update order indexes in transaction
    await prisma.$transaction(
      itemOrders.map(item => 
        prisma.eventMerchandise.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex }
        })
      )
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_reorder',
        details: {
          eventId,
          reorderedItems: itemOrders.length
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      }
    });

    return successResponse(res, null, 'Merchandise items reordered successfully');

  } catch (error) {
    console.error('Reorder merchandise error:', error);
    return errorResponse(res, 'Failed to reorder merchandise items', 500);
  }
};

module.exports = {
  addMerchandise,
  getEventMerchandise,
  getMerchandiseItem,
  updateMerchandise,
  deleteMerchandise,
  reorderMerchandise
};