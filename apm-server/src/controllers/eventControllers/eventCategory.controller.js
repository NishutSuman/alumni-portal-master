// src/controllers/eventCategory.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');

// Get all event categories (public)
const getAllCategories = async (req, res) => {
  const { includeInactive = false } = req.query;
  
  try {
    const whereClause = {};
    
    // Only include active categories unless explicitly requested
    if (!includeInactive || req.user?.role !== 'SUPER_ADMIN') {
      whereClause.isActive = true;
    }
    
    const categories = await prisma.eventCategory.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: {
          select: {
            events: {
              where: {
                status: {
                  in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING']
                }
              }
            }
          }
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
    
    // Transform response to include event count
    const transformedCategories = categories.map(category => ({
      ...category,
      eventCount: category._count.events,
      _count: undefined,
    }));
    
    return successResponse(res, { categories: transformedCategories }, 'Event categories retrieved successfully');
    
  } catch (error) {
    console.error('Get event categories error:', error);
    return errorResponse(res, 'Failed to retrieve event categories', 500);
  }
};

// Get single category with events (public)
const getCategoryById = async (req, res) => {
  const { categoryId } = req.params;
  const { page, limit, skip } = getPaginationParams(req.query, 10);
  
  try {
    // Get category details
    const category = await prisma.eventCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!category) {
      return errorResponse(res, 'Event category not found', 404);
    }
    
    if (!category.isActive && req.user?.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Event category not found', 404);
    }
    
    // Get events in this category with pagination
    const whereClause = {
      categoryId,
      status: {
        in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING']
      }
    };
    
    // Super admin can see all events
    if (req.user?.role === 'SUPER_ADMIN') {
      delete whereClause.status;
    }
    
    const [events, totalEvents] = await Promise.all([
      prisma.event.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          description: true,
          slug: true,
          eventDate: true,
          startTime: true,
          endTime: true,
          venue: true,
          eventMode: true,
          status: true,
          maxCapacity: true,
          hasRegistration: true,
          registrationFee: true,
          heroImage: true,
          creator: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
          _count: {
            select: {
              registrations: {
                where: { status: 'CONFIRMED' }
              }
            }
          },
          createdAt: true,
        },
        orderBy: { eventDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where: whereClause })
    ]);
    
    // Transform events to include registration count
    const transformedEvents = events.map(event => ({
      ...event,
      registrationCount: event._count.registrations,
      _count: undefined,
    }));
    
    const pagination = calculatePagination(totalEvents, page, limit);
    
    return paginatedResponse(res, {
      category,
      events: transformedEvents,
    }, pagination, 'Category events retrieved successfully');
    
  } catch (error) {
    console.error('Get category by ID error:', error);
    return errorResponse(res, 'Failed to retrieve category', 500);
  }
};

// Create event category (Super Admin only)
const createCategory = async (req, res) => {
  const { name, description } = req.body;
  
  // Basic validation
  if (!name || name.trim().length === 0) {
    return errorResponse(res, 'Category name is required', 400);
  }
  
  if (name.length > 50) {
    return errorResponse(res, 'Category name must be less than 50 characters', 400);
  }
  
  try {
    // Check if category name already exists
    const existingCategory = await prisma.eventCategory.findUnique({
      where: { name: name.trim().toUpperCase() },
    });
    
    if (existingCategory) {
      return errorResponse(res, 'Event category with this name already exists', 409);
    }
    
    // Create category
    const category = await prisma.eventCategory.create({
      data: {
        name: name.trim().toUpperCase(),
        description: description?.trim() || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_category_create',
        details: {
          categoryId: category.id,
          categoryName: category.name,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { category }, 'Event category created successfully', 201);
    
  } catch (error) {
    console.error('Create event category error:', error);
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return errorResponse(res, 'Event category with this name already exists', 409);
    }
    
    return errorResponse(res, 'Failed to create event category', 500);
  }
};

// Update event category (Super Admin only)
const updateCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { name, description, isActive } = req.body;
  
  try {
    // Check if category exists
    const existingCategory = await prisma.eventCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        _count: {
          select: { events: true }
        }
      },
    });
    
    if (!existingCategory) {
      return errorResponse(res, 'Event category not found', 404);
    }
    
    // Prepare update data
    const updateData = {};
    
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return errorResponse(res, 'Category name cannot be empty', 400);
      }
      
      if (name.length > 50) {
        return errorResponse(res, 'Category name must be less than 50 characters', 400);
      }
      
      const trimmedName = name.trim().toUpperCase();
      
      // Check if new name conflicts with existing category
      if (trimmedName !== existingCategory.name) {
        const nameConflict = await prisma.eventCategory.findUnique({
          where: { name: trimmedName },
        });
        
        if (nameConflict) {
          return errorResponse(res, 'Event category with this name already exists', 409);
        }
        
        updateData.name = trimmedName;
      }
    }
    
    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }
    
    if (isActive !== undefined) {
      // Prevent deactivating categories that have events
      if (!isActive && existingCategory._count.events > 0) {
        return errorResponse(res, 'Cannot deactivate category with existing events', 400);
      }
      updateData.isActive = Boolean(isActive);
    }
    
    // Update category
    const updatedCategory = await prisma.eventCategory.update({
      where: { id: categoryId },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_category_update',
        details: {
          categoryId: updatedCategory.id,
          categoryName: updatedCategory.name,
          changes: Object.keys(updateData),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { category: updatedCategory }, 'Event category updated successfully');
    
  } catch (error) {
    console.error('Update event category error:', error);
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return errorResponse(res, 'Event category with this name already exists', 409);
    }
    
    return errorResponse(res, 'Failed to update event category', 500);
  }
};

// Delete event category (Super Admin only)
const deleteCategory = async (req, res) => {
  const { categoryId } = req.params;
  
  try {
    // Check if category exists and has events
    const category = await prisma.eventCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        _count: {
          select: { events: true }
        }
      },
    });
    
    if (!category) {
      return errorResponse(res, 'Event category not found', 404);
    }
    
    // Prevent deleting categories with events
    if (category._count.events > 0) {
      return errorResponse(res, 'Cannot delete category with existing events. Move or delete events first.', 400);
    }
    
    // Delete category
    await prisma.eventCategory.delete({
      where: { id: categoryId },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_category_delete',
        details: {
          categoryId: category.id,
          categoryName: category.name,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Event category deleted successfully');
    
  } catch (error) {
    console.error('Delete event category error:', error);
    return errorResponse(res, 'Failed to delete event category', 500);
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};