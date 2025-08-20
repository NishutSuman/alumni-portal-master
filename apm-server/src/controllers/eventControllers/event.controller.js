// src/controllers/event.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');
const { deleteUploadedFile, getFileUrl } = require('../../middleware/upload.middleware');

// Helper function to generate unique slug
const generateSlug = (title, suffix = '') => {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
};

// Get all events (public)
const getAllEvents = async (req, res) => {
  const { 
    category, 
    status, 
    eventMode, 
    search, 
    upcoming = true,
    sortBy = 'eventDate',
    sortOrder = 'asc' 
  } = req.query;
  
  const { page, limit, skip } = getPaginationParams(req.query, 10);
  
  try {
    // Build where clause
    const whereClause = {};
    
    // Default status filter for public users
    if (req.user?.role !== 'SUPER_ADMIN') {
      whereClause.status = {
        in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED']
      };
    }
    
    // Apply filters
    if (category) {
      whereClause.categoryId = category;
    }
    
    if (status && req.user?.role === 'SUPER_ADMIN') {
      whereClause.status = status;
    }
    
    if (eventMode) {
      whereClause.eventMode = eventMode;
    }
    
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { venue: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Filter by upcoming/past events
    if (upcoming === 'true') {
      whereClause.eventDate = { gte: new Date() };
    } else if (upcoming === 'false') {
      whereClause.eventDate = { lt: new Date() };
    }
    
    // Valid sort fields
    const validSortFields = ['eventDate', 'createdAt', 'title', 'registrationStartDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'eventDate';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';
    
    // Get total count
    const total = await prisma.event.count({ where: whereClause });
    
    // Get events
    const events = await prisma.event.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        slug: true,
        eventDate: true,
        startTime: true,
        endTime: true,
        registrationStartDate: true,
        registrationEndDate: true,
        venue: true,
        meetingLink: true,
        maxCapacity: true,
        eventMode: true,
        status: true,
        hasRegistration: true,
        hasExternalLink: true,
        externalRegistrationLink: true,
        registrationFee: true,
        guestFee: true,
        heroImage: true,
        images: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
          },
        },
        _count: {
          select: {
            registrations: {
              where: { status: 'CONFIRMED' }
            },
            sections: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { [sortField]: order },
      skip,
      take: limit,
    });
    
    // Transform events to include additional calculated fields
    const transformedEvents = events.map(event => {
      const now = new Date();
      const eventDate = new Date(event.eventDate);
      const regStart = event.registrationStartDate ? new Date(event.registrationStartDate) : null;
      const regEnd = event.registrationEndDate ? new Date(event.registrationEndDate) : null;
      
      // Calculate registration status
      let registrationStatus = 'CLOSED';
      if (event.hasRegistration && !event.hasExternalLink) {
        if (regStart && now < regStart) {
          registrationStatus = 'NOT_STARTED';
        } else if (regEnd && now > regEnd) {
          registrationStatus = 'CLOSED';
        } else if (event.maxCapacity && event._count.registrations >= event.maxCapacity) {
          registrationStatus = 'FULL';
        } else {
          registrationStatus = 'OPEN';
        }
      } else if (event.hasExternalLink) {
        registrationStatus = 'EXTERNAL';
      }
      
      return {
        ...event,
        registrationCount: event._count.registrations,
        sectionCount: event._count.sections,
        registrationStatus,
        isUpcoming: eventDate > now,
        isPast: eventDate < now,
        _count: undefined,
      };
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, transformedEvents, pagination, 'Events retrieved successfully');
    
  } catch (error) {
    console.error('Get events error:', error);
    return errorResponse(res, 'Failed to retrieve events', 500);
  }
};

// Get single event by ID or slug (public)
const getEventById = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Try to find by ID first, then by slug
    const whereClause = eventId.length === 25 // CUID length
      ? { id: eventId }
      : { slug: eventId };
    
    const event = await prisma.event.findUnique({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
            batch: true,
          },
        },
        sections: {
          where: { isVisible: true },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            sectionType: true,
            title: true,
            content: true,
            orderIndex: true,
          },
        },
        merchandise: {
          where: { isActive: true },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            images: true,
            availableSizes: true,
            stockQuantity: true,
          },
        },
        _count: {
          select: {
            registrations: {
              where: { status: 'CONFIRMED' }
            },
            guests: {
              where: { status: 'ACTIVE' }
            },
          },
        },
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
    
    // Calculate additional fields
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const regStart = event.registrationStartDate ? new Date(event.registrationStartDate) : null;
    const regEnd = event.registrationEndDate ? new Date(event.registrationEndDate) : null;
    
    // Calculate registration status
    let registrationStatus = 'CLOSED';
    if (event.hasRegistration && !event.hasExternalLink) {
      if (regStart && now < regStart) {
        registrationStatus = 'NOT_STARTED';
      } else if (regEnd && now > regEnd) {
        registrationStatus = 'CLOSED';
      } else if (event.maxCapacity && event._count.registrations >= event.maxCapacity) {
        registrationStatus = 'FULL';
      } else {
        registrationStatus = 'OPEN';
      }
    } else if (event.hasExternalLink) {
      registrationStatus = 'EXTERNAL';
    }
    
    // Check if current user is registered
    let userRegistration = null;
    if (req.user) {
      userRegistration = await prisma.eventRegistration.findUnique({
        where: {
          eventId_userId: {
            eventId: event.id,
            userId: req.user.id,
          },
        },
        select: {
          id: true,
          status: true,
          registrationDate: true,
          totalAmount: true,
          paymentStatus: true,
          totalGuests: true,
          activeGuests: true,
        },
      });
    }
    
    const transformedEvent = {
      ...event,
      registrationCount: event._count.registrations,
      guestCount: event._count.guests,
      registrationStatus,
      isUpcoming: eventDate > now,
      isPast: eventDate < now,
      userRegistration,
      _count: undefined,
    };
    
    return successResponse(res, { event: transformedEvent }, 'Event retrieved successfully');
    
  } catch (error) {
    console.error('Get event by ID error:', error);
    return errorResponse(res, 'Failed to retrieve event', 500);
  }
};

// Create event (Super Admin only)
const createEvent = async (req, res) => {
  const {
    title,
    description,
    categoryId,
    eventDate,
    startTime,
    endTime,
    registrationStartDate,
    registrationEndDate,
    venue,
    meetingLink,
    maxCapacity,
    eventMode = 'PHYSICAL',
    status = 'DRAFT',
    // Feature flags
    hasRegistration = true,
    hasExternalLink = false,
    externalRegistrationLink,
    hasCustomForm = false,
    hasMeals = false,
    hasGuests = false,
    hasDonations = false,
    hasMerchandise = false,
    hasPrizes = false,
    hasSponsors = false,
    hasOrganizers = false,
    // Settings
    allowFormModification = true,
    formModificationDeadlineHours = 24,
    // Fees
    registrationFee = 0,
    guestFee = 0,
  } = req.body;
  
  // Basic validation
  if (!title || !description || !categoryId || !eventDate) {
    return errorResponse(res, 'Title, description, category, and event date are required', 400);
  }
  
  try {
    // Validate category exists
    const category = await prisma.eventCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    
    if (!category || !category.isActive) {
      return errorResponse(res, 'Invalid or inactive event category', 400);
    }
    
    // Validate event date
    const eventDateTime = new Date(eventDate);
    if (eventDateTime < new Date()) {
      return errorResponse(res, 'Event date cannot be in the past', 400);
    }
    
    // Validate registration dates
    if (registrationStartDate && registrationEndDate) {
      const regStart = new Date(registrationStartDate);
      const regEnd = new Date(registrationEndDate);
      
      if (regStart >= regEnd) {
        return errorResponse(res, 'Registration end date must be after start date', 400);
      }
      
      if (regEnd > eventDateTime) {
        return errorResponse(res, 'Registration end date cannot be after event date', 400);
      }
    }
    
    // Generate unique slug
    let slug = generateSlug(title);
    let slugCounter = 1;
    
    while (await prisma.event.findUnique({ where: { slug } })) {
      slug = generateSlug(title, slugCounter);
      slugCounter++;
    }
    
    // Handle uploaded files
    let heroImage = null;
    let images = [];
    
    if (req.files) {
      if (req.files.heroImage && req.files.heroImage[0]) {
        heroImage = getFileUrl(req, req.files.heroImage[0].filename, 'events');
      }
      
      if (req.files.images) {
        images = req.files.images.map(file => 
          getFileUrl(req, file.filename, 'events')
        );
      }
    }
    
    // Create event
    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        slug,
        categoryId,
        eventDate: eventDateTime,
        startTime,
        endTime,
        registrationStartDate: registrationStartDate ? new Date(registrationStartDate) : null,
        registrationEndDate: registrationEndDate ? new Date(registrationEndDate) : null,
        venue: venue?.trim(),
        meetingLink: meetingLink?.trim(),
        maxCapacity: maxCapacity ? parseInt(maxCapacity) : null,
        eventMode,
        status,
        hasRegistration: Boolean(hasRegistration),
        hasExternalLink: Boolean(hasExternalLink),
        externalRegistrationLink: hasExternalLink ? externalRegistrationLink?.trim() : null,
        hasCustomForm: Boolean(hasCustomForm),
        hasMeals: Boolean(hasMeals),
        hasGuests: Boolean(hasGuests),
        hasDonations: Boolean(hasDonations),
        hasMerchandise: Boolean(hasMerchandise),
        hasPrizes: Boolean(hasPrizes),
        hasSponsors: Boolean(hasSponsors),
        hasOrganizers: Boolean(hasOrganizers),
        allowFormModification: Boolean(allowFormModification),
        formModificationDeadlineHours: parseInt(formModificationDeadlineHours),
        registrationFee: parseFloat(registrationFee),
        guestFee: parseFloat(guestFee),
        heroImage,
        images,
        createdBy: req.user.id,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
          },
        },
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_create',
        details: {
          eventId: event.id,
          eventTitle: event.title,
          categoryId: event.categoryId,
          eventDate: event.eventDate,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { event }, 'Event created successfully', 201);
    
  } catch (error) {
    console.error('Create event error:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        deleteUploadedFile(file.path);
      });
    }
    
    return errorResponse(res, 'Failed to create event', 500);
  }
};

// Update event (Super Admin only)
const updateEvent = async (req, res) => {
  const { eventId } = req.params;
  const updateData = req.body;
  
  try {
    // Get existing event
    const existingEvent = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        slug: true,
        categoryId: true,
        heroImage: true,
        images: true,
        status: true,
        _count: {
          select: {
            registrations: {
              where: { status: 'CONFIRMED' }
            }
          }
        }
      },
    });
    
    if (!existingEvent) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Prepare update data
    const updateFields = {};
    
    // Basic fields
    if (updateData.title !== undefined) {
      updateFields.title = updateData.title.trim();
      
      // Generate new slug if title changed
      if (updateData.title.trim() !== existingEvent.title) {
        let newSlug = generateSlug(updateData.title);
        let slugCounter = 1;
        
        while (await prisma.event.findFirst({ 
          where: { slug: newSlug, NOT: { id: eventId } } 
        })) {
          newSlug = generateSlug(updateData.title, slugCounter);
          slugCounter++;
        }
        
        updateFields.slug = newSlug;
      }
    }
    
    if (updateData.description !== undefined) {
      updateFields.description = updateData.description.trim();
    }
    
    if (updateData.categoryId !== undefined) {
      // Validate category exists
      const category = await prisma.eventCategory.findUnique({
        where: { id: updateData.categoryId },
        select: { id: true, isActive: true },
      });
      
      if (!category || !category.isActive) {
        return errorResponse(res, 'Invalid or inactive event category', 400);
      }
      
      updateFields.categoryId = updateData.categoryId;
    }
    
    // Date fields with validation
    if (updateData.eventDate !== undefined) {
      const eventDateTime = new Date(updateData.eventDate);
      
      // Only allow future dates for events with registrations
      if (existingEvent._count.registrations > 0 && eventDateTime < new Date()) {
        return errorResponse(res, 'Cannot set past date for event with existing registrations', 400);
      }
      
      updateFields.eventDate = eventDateTime;
    }
    
    // Handle other fields...
    const simpleFields = [
      'startTime', 'endTime', 'venue', 'meetingLink', 'eventMode', 'status',
      'hasRegistration', 'hasExternalLink', 'externalRegistrationLink',
      'hasCustomForm', 'hasMeals', 'hasGuests', 'hasDonations', 'hasMerchandise',
      'hasPrizes', 'hasSponsors', 'hasOrganizers', 'allowFormModification',
      'formModificationDeadlineHours', 'registrationFee', 'guestFee', 'maxCapacity'
    ];
    
    simpleFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    });
    
    // Handle file uploads
    let heroImage = existingEvent.heroImage;
    let images = existingEvent.images;
    
    if (req.files) {
      if (req.files.heroImage && req.files.heroImage[0]) {
        // Delete old hero image
        if (existingEvent.heroImage && existingEvent.heroImage.includes('/uploads/')) {
          const oldFileName = existingEvent.heroImage.split('/').pop();
          deleteUploadedFile(`./public/uploads/events/${oldFileName}`);
        }
        heroImage = getFileUrl(req, req.files.heroImage[0].filename, 'events');
      }
      
      if (req.files.images) {
        // Delete old images
        if (existingEvent.images && existingEvent.images.length > 0) {
          existingEvent.images.forEach(imagePath => {
            if (imagePath.includes('/uploads/')) {
              const fileName = imagePath.split('/').pop();
              deleteUploadedFile(`./public/uploads/events/${fileName}`);
            }
          });
        }
        images = req.files.images.map(file => 
          getFileUrl(req, file.filename, 'events')
        );
      }
    }
    
    updateFields.heroImage = heroImage;
    updateFields.images = images;
    
    // Update event
    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: updateFields,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            role: true,
          },
        },
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_update',
        details: {
          eventId: updatedEvent.id,
          eventTitle: updatedEvent.title,
          changes: Object.keys(updateFields),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { event: updatedEvent }, 'Event updated successfully');
    
  } catch (error) {
    console.error('Update event error:', error);
    
    // Clean up new uploaded files on error
    if (req.files) {
      Object.values(req.files).flat().forEach(file => {
        deleteUploadedFile(file.path);
      });
    }
    
    return errorResponse(res, 'Failed to update event', 500);
  }
};

// Delete event (Super Admin only)
const deleteEvent = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Get event with related data
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        heroImage: true,
        images: true,
        _count: {
          select: {
            registrations: true,
            sections: true,
          }
        }
      },
    });
    
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Prevent deletion if there are registrations
    if (event._count.registrations > 0) {
      return errorResponse(res, 'Cannot delete event with existing registrations. Archive it instead.', 400);
    }
    
    // Delete associated files
    if (event.heroImage && event.heroImage.includes('/uploads/')) {
      const fileName = event.heroImage.split('/').pop();
      deleteUploadedFile(`./public/uploads/events/${fileName}`);
    }
    
    if (event.images && event.images.length > 0) {
      event.images.forEach(imagePath => {
        if (imagePath.includes('/uploads/')) {
          const fileName = imagePath.split('/').pop();
          deleteUploadedFile(`./public/uploads/events/${fileName}`);
        }
      });
    }
    
    // Delete event (cascade will handle related records)
    await prisma.event.delete({
      where: { id: eventId },
    });
    
    // Log deletion
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'event_delete',
        entityType: 'Event',
        entityId: eventId,
        oldValues: { 
          title: event.title,
          sectionsCount: event._count.sections 
        },
        newValues: null,
      },
    });
    
    return successResponse(res, null, 'Event deleted successfully');
    
  } catch (error) {
    console.error('Delete event error:', error);
    return errorResponse(res, 'Failed to delete event', 500);
  }
};

// Update event status (Super Admin only)
const updateEventStatus = async (req, res) => {
  const { eventId } = req.params;
  const { status } = req.body;
  
  // Validate status
  const validStatuses = ['DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];
  if (!validStatuses.includes(status)) {
    return errorResponse(res, 'Invalid event status', 400);
  }
  
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, status: true },
    });
    
    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Update status
    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: { status },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
      },
    });
    
    // Log status change
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_status_change',
        details: {
          eventId: event.id,
          eventTitle: event.title,
          oldStatus: event.status,
          newStatus: status,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { event: updatedEvent }, `Event status updated to ${status}`);
    
  } catch (error) {
    console.error('Update event status error:', error);
    return errorResponse(res, 'Failed to update event status', 500);
  }
};

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventStatus,
};