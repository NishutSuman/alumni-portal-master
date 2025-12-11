// src/controllers/announcement/announcement.controller.js
// System Announcements Controller - CRUD operations for admin announcements

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { successResponse, errorResponse } = require('../../utils/response');
const { getTenantFilter, getTenantId } = require('../../utils/tenant.util');
const { NotificationService } = require('../../services/notification.service');

// ============================================
// ADMIN OPERATIONS
// ============================================

/**
 * Create a new announcement
 * POST /api/announcements
 * Access: SUPER_ADMIN
 */
const createAnnouncement = async (req, res) => {
  try {
    const { message } = req.body;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return errorResponse(res, 'Organization context required', 400);
    }

    // Validate message length (100 words max)
    const wordCount = message.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 100) {
      return errorResponse(res, 'Message exceeds 100 word limit', 400);
    }

    // Create the announcement
    const announcement = await prisma.announcement.create({
      data: {
        message: message.trim(),
        isActive: true,
        createdById: req.user.id,
        organizationId: tenantId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Send notification to all active users in the organization
    try {
      const activeUsers = await prisma.user.findMany({
        where: {
          organizationId: tenantId,
          isActive: true,
        },
        select: { id: true },
      });

      const recipientIds = activeUsers.map((user) => user.id);

      if (recipientIds.length > 0) {
        console.log(`📢 Sending announcement notification to ${recipientIds.length} users`);
        await NotificationService.createAndSendNotification({
          recipientIds,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: 'New Announcement',
          message: message.trim(),
          priority: 'MEDIUM',
          organizationId: tenantId,
          data: {
            announcementId: announcement.id,
          },
        });
        console.log(`✅ Announcement notifications sent successfully`);
      } else {
        console.log('⚠️ No active users found to notify');
      }
    } catch (notifError) {
      console.error('Failed to send announcement notifications:', notifError);
      // Don't fail the request if notifications fail
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'announcement_created',
        details: {
          announcementId: announcement.id,
          messagePreview: message.substring(0, 50),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return successResponse(res, announcement, 'Announcement created successfully', 201);
  } catch (error) {
    console.error('Create announcement error:', error);
    return errorResponse(res, 'Failed to create announcement', 500);
  }
};

/**
 * Get all announcements (Admin view with all statuses)
 * GET /api/announcements/admin
 * Access: SUPER_ADMIN
 */
const getAdminAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const tenantFilter = getTenantFilter(req);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...tenantFilter,
      ...(status !== undefined && { isActive: status === 'active' }),
    };

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              fullName: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.announcement.count({ where }),
    ]);

    return successResponse(res, {
      announcements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get admin announcements error:', error);
    return errorResponse(res, 'Failed to fetch announcements', 500);
  }
};

/**
 * Toggle announcement active status
 * PATCH /api/announcements/:id/toggle
 * Access: SUPER_ADMIN
 */
const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = getTenantFilter(req);
    const tenantId = getTenantId(req);

    // Find the announcement
    const announcement = await prisma.announcement.findFirst({
      where: {
        id,
        ...tenantFilter,
      },
    });

    if (!announcement) {
      return errorResponse(res, 'Announcement not found', 404);
    }

    // Toggle the status
    const updated = await prisma.announcement.update({
      where: { id },
      data: { isActive: !announcement.isActive },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Send notification to all users when announcement is ACTIVATED
    if (updated.isActive) {
      try {
        const activeUsers = await prisma.user.findMany({
          where: {
            organizationId: tenantId,
            isActive: true,
          },
          select: { id: true },
        });

        const recipientIds = activeUsers.map((user) => user.id);

        if (recipientIds.length > 0) {
          console.log(`📢 Sending activation notification to ${recipientIds.length} users`);
          await NotificationService.createAndSendNotification({
            recipientIds,
            type: 'SYSTEM_ANNOUNCEMENT',
            title: 'Announcement Activated',
            message: updated.message,
            priority: 'MEDIUM',
            organizationId: tenantId,
            data: {
              announcementId: updated.id,
            },
          });
          console.log(`✅ Activation notifications sent successfully`);
        }
      } catch (notifError) {
        console.error('Failed to send activation notifications:', notifError);
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: updated.isActive ? 'announcement_activated' : 'announcement_deactivated',
        details: { announcementId: id },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return successResponse(
      res,
      updated,
      `Announcement ${updated.isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error) {
    console.error('Toggle announcement status error:', error);
    return errorResponse(res, 'Failed to update announcement', 500);
  }
};

/**
 * Delete announcement
 * DELETE /api/announcements/:id
 * Access: SUPER_ADMIN
 */
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = getTenantFilter(req);

    // Verify announcement exists and belongs to tenant
    const announcement = await prisma.announcement.findFirst({
      where: {
        id,
        ...tenantFilter,
      },
    });

    if (!announcement) {
      return errorResponse(res, 'Announcement not found', 404);
    }

    await prisma.announcement.delete({
      where: { id },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'announcement_deleted',
        details: {
          announcementId: id,
          messagePreview: announcement.message.substring(0, 50),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    return successResponse(res, null, 'Announcement deleted successfully');
  } catch (error) {
    console.error('Delete announcement error:', error);
    return errorResponse(res, 'Failed to delete announcement', 500);
  }
};

// ============================================
// PUBLIC/USER OPERATIONS
// ============================================

/**
 * Get active announcements (for dashboard display)
 * GET /api/announcements/active
 * Access: Authenticated users
 */
const getActiveAnnouncements = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    const announcements = await prisma.announcement.findMany({
      where: {
        ...tenantFilter,
        isActive: true,
      },
      select: {
        id: true,
        message: true,
        createdAt: true,
        createdBy: {
          select: {
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      // No limit - show all active announcements
    });

    return successResponse(res, { announcements });
  } catch (error) {
    console.error('Get active announcements error:', error);
    return errorResponse(res, 'Failed to fetch announcements', 500);
  }
};

/**
 * Get all announcements for user (history view)
 * GET /api/announcements
 * Access: Authenticated users
 */
const getAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const tenantFilter = getTenantFilter(req);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...tenantFilter,
      isActive: true, // Users only see active announcements
    };

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        select: {
          id: true,
          message: true,
          createdAt: true,
          createdBy: {
            select: {
              fullName: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.announcement.count({ where }),
    ]);

    return successResponse(res, {
      announcements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    return errorResponse(res, 'Failed to fetch announcements', 500);
  }
};

module.exports = {
  createAnnouncement,
  getAdminAnnouncements,
  toggleAnnouncementStatus,
  deleteAnnouncement,
  getActiveAnnouncements,
  getAnnouncements,
};
