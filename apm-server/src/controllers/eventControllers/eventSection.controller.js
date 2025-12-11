// src/controllers/eventSection.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { getTenantFilter, getTenantData } = require('../../utils/tenant.util');

// Add section to event (Super Admin only)
const addEventSection = async (req, res) => {
  const { eventId } = req.params;
  const { sectionType, title, content, orderIndex = 0, isVisible = true } = req.body;
  
  // Basic validation
  if (!sectionType || !title || !content) {
    return errorResponse(res, 'Section type, title, and content are required', 400);
  }
  
  // Validate section type
  const validSectionTypes = ['SCHEDULE', 'ORGANIZERS', 'LOCATION', 'PRIZES', 'SPONSORS', 'DONATIONS', 'MERCHANDISE', 'CUSTOM'];
  if (!validSectionTypes.includes(sectionType)) {
    return errorResponse(res, 'Invalid section type', 400);
  }
  
  try {
    // Check if event exists
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: { id: true, title: true, status: true },
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Check for duplicate section types (except CUSTOM which can have multiple)
    if (sectionType !== 'CUSTOM') {
      const existingSection = await prisma.eventSection.findFirst({
        where: {
          eventId,
          sectionType,
        },
      });
      
      if (existingSection) {
        return errorResponse(res, `Event already has a ${sectionType} section`, 400);
      }
    }
    
    // Get the next order index if not provided
    let finalOrderIndex = parseInt(orderIndex);
    if (orderIndex === 0 || !orderIndex) {
      const lastSection = await prisma.eventSection.findFirst({
        where: { eventId },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      finalOrderIndex = lastSection ? lastSection.orderIndex + 1 : 1;
    }
    
    // Create section
    const section = await prisma.eventSection.create({
      data: {
        eventId,
        sectionType,
        title: title.trim(),
        content: content.trim(),
        orderIndex: finalOrderIndex,
        isVisible: Boolean(isVisible),
      },
      select: {
        id: true,
        sectionType: true,
        title: true,
        content: true,
        orderIndex: true,
        isVisible: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_section_add',
        details: {
          eventId: event.id,
          eventTitle: event.title,
          sectionId: section.id,
          sectionType: section.sectionType,
          sectionTitle: section.title,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { section }, 'Event section added successfully', 201);
    
  } catch (error) {
    console.error('Add event section error:', error);
    return errorResponse(res, 'Failed to add event section', 500);
  }
};

// Get all sections for an event (public)
const getEventSections = async (req, res) => {
  const { eventId } = req.params;
  const { includeHidden = false } = req.query;
  
  try {
    // Check if event exists and is visible
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: {
        id: true,
        title: true,
        status: true,
        createdBy: true
      },
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Check visibility permissions
    if (req.user?.role !== 'SUPER_ADMIN' && 
        !['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED'].includes(event.status)) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Build where clause
    const whereClause = { eventId };
    
    // Include hidden sections only for Super Admins or event creators
    if (!includeHidden || (req.user?.role !== 'SUPER_ADMIN' && req.user?.id !== event.createdBy)) {
      whereClause.isVisible = true;
    }
    
    // Get sections
    const sections = await prisma.eventSection.findMany({
      where: whereClause,
      select: {
        id: true,
        sectionType: true,
        title: true,
        content: true,
        orderIndex: true,
        isVisible: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { orderIndex: 'asc' },
    });
    
    return successResponse(res, { sections }, 'Event sections retrieved successfully');
    
  } catch (error) {
    console.error('Get event sections error:', error);
    return errorResponse(res, 'Failed to retrieve event sections', 500);
  }
};

// Update event section (Super Admin only)
const updateEventSection = async (req, res) => {
  const { eventId, sectionId } = req.params;
  const { sectionType, title, content, orderIndex, isVisible } = req.body;
  
  try {
    // Check if section exists and belongs to the event
    const existingSection = await prisma.eventSection.findFirst({
      where: {
        id: sectionId,
        eventId,
        event: { ...getTenantFilter(req) }
      },
      select: {
        id: true,
        sectionType: true,
        title: true,
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!existingSection) {
      return errorResponse(res, 'Event section not found', 404);
    }
    
    // Prepare update data
    const updateData = {};
    
    if (sectionType !== undefined) {
      const validSectionTypes = ['SCHEDULE', 'ORGANIZERS', 'LOCATION', 'PRIZES', 'SPONSORS', 'DONATIONS', 'MERCHANDISE', 'CUSTOM'];
      if (!validSectionTypes.includes(sectionType)) {
        return errorResponse(res, 'Invalid section type', 400);
      }
      
      // Check for duplicate section types (except CUSTOM)
      if (sectionType !== 'CUSTOM' && sectionType !== existingSection.sectionType) {
        const duplicateSection = await prisma.eventSection.findFirst({
          where: {
            eventId,
            sectionType,
            NOT: { id: sectionId },
          },
        });
        
        if (duplicateSection) {
          return errorResponse(res, `Event already has a ${sectionType} section`, 400);
        }
      }
      
      updateData.sectionType = sectionType;
    }
    
    if (title !== undefined) {
      if (!title.trim()) {
        return errorResponse(res, 'Section title cannot be empty', 400);
      }
      updateData.title = title.trim();
    }
    
    if (content !== undefined) {
      if (!content.trim()) {
        return errorResponse(res, 'Section content cannot be empty', 400);
      }
      updateData.content = content.trim();
    }
    
    if (orderIndex !== undefined) {
      updateData.orderIndex = parseInt(orderIndex);
    }
    
    if (isVisible !== undefined) {
      updateData.isVisible = Boolean(isVisible);
    }
    
    // Update section
    const updatedSection = await prisma.eventSection.update({
      where: { id: sectionId },
      data: updateData,
      select: {
        id: true,
        sectionType: true,
        title: true,
        content: true,
        orderIndex: true,
        isVisible: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_section_update',
        details: {
          eventId: existingSection.event.id,
          eventTitle: existingSection.event.title,
          sectionId: updatedSection.id,
          sectionType: updatedSection.sectionType,
          sectionTitle: updatedSection.title,
          changes: Object.keys(updateData),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { section: updatedSection }, 'Event section updated successfully');
    
  } catch (error) {
    console.error('Update event section error:', error);
    return errorResponse(res, 'Failed to update event section', 500);
  }
};

// Delete event section (Super Admin only)
const deleteEventSection = async (req, res) => {
  const { eventId, sectionId } = req.params;
  
  try {
    // Check if section exists and belongs to the event
    const section = await prisma.eventSection.findFirst({
      where: {
        id: sectionId,
        eventId,
        event: { ...getTenantFilter(req) }
      },
      select: {
        id: true,
        sectionType: true,
        title: true,
        event: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!section) {
      return errorResponse(res, 'Event section not found', 404);
    }
    
    // Delete section
    await prisma.eventSection.delete({
      where: { id: sectionId },
    });
    
    // Log deletion
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'event_section_delete',
        entityType: 'EventSection',
        entityId: sectionId,
        oldValues: {
          eventId: section.event.id,
          eventTitle: section.event.title,
          sectionType: section.sectionType,
          sectionTitle: section.title,
        },
        newValues: null,
      },
    });
    
    return successResponse(res, null, 'Event section deleted successfully');
    
  } catch (error) {
    console.error('Delete event section error:', error);
    return errorResponse(res, 'Failed to delete event section', 500);
  }
};

// Reorder event sections (Super Admin only)
const reorderEventSections = async (req, res) => {
  const { eventId } = req.params;
  const { sectionOrders } = req.body; // Array of { sectionId, orderIndex }
  
  if (!Array.isArray(sectionOrders) || sectionOrders.length === 0) {
    return errorResponse(res, 'Section orders array is required', 400);
  }
  
  try {
    // Check if event exists
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: { id: true, title: true },
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Validate all sections belong to this event
    const sectionIds = sectionOrders.map(item => item.sectionId);
    const existingSections = await prisma.eventSection.findMany({
      where: {
        id: { in: sectionIds },
        eventId,
      },
      select: { id: true },
    });
    
    if (existingSections.length !== sectionIds.length) {
      return errorResponse(res, 'Some sections do not belong to this event', 400);
    }
    
    // Update sections in a transaction
    await prisma.$transaction(async (prisma) => {
      for (const { sectionId, orderIndex } of sectionOrders) {
        await prisma.eventSection.update({
          where: { id: sectionId },
          data: { orderIndex: parseInt(orderIndex) },
        });
      }
    });
    
    // Get updated sections
    const updatedSections = await prisma.eventSection.findMany({
      where: { eventId },
      select: {
        id: true,
        sectionType: true,
        title: true,
        orderIndex: true,
        isVisible: true,
      },
      orderBy: { orderIndex: 'asc' },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_sections_reorder',
        details: {
          eventId: event.id,
          eventTitle: event.title,
          sectionOrders,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { sections: updatedSections }, 'Event sections reordered successfully');
    
  } catch (error) {
    console.error('Reorder event sections error:', error);
    return errorResponse(res, 'Failed to reorder event sections', 500);
  }
};

// Get section by ID (public)
const getSectionById = async (req, res) => {
  const { eventId, sectionId } = req.params;
  
  try {
    // Check if section exists and belongs to the event
    const section = await prisma.eventSection.findFirst({
      where: {
        id: sectionId,
        eventId,
        event: { ...getTenantFilter(req) }
      },
      select: {
        id: true,
        sectionType: true,
        title: true,
        content: true,
        orderIndex: true,
        isVisible: true,
        createdAt: true,
        updatedAt: true,
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            createdBy: true,
          },
        },
      },
    });

    if (!section) {
      return errorResponse(res, 'Event section not found', 404);
    }
    
    // Check visibility permissions
    if (req.user?.role !== 'SUPER_ADMIN' && 
        !['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED'].includes(section.event.status)) {
      return errorResponse(res, 'Event section not found', 404);
    }
    
    // Check if section is visible (unless user is Super Admin or event creator)
    if (!section.isVisible && 
        req.user?.role !== 'SUPER_ADMIN' && 
        req.user?.id !== section.event.createdBy) {
      return errorResponse(res, 'Event section not found', 404);
    }
    
    return successResponse(res, { section }, 'Event section retrieved successfully');
    
  } catch (error) {
    console.error('Get section by ID error:', error);
    return errorResponse(res, 'Failed to retrieve event section', 500);
  }
};

module.exports = {
  addEventSection,
  getEventSections,
  getSectionById,
  updateEventSection,
  deleteEventSection,
  reorderEventSections,
};