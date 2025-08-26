// ============================================
// FILE: src/controllers/support/ticketAdmin.controller.js  
// ============================================

const TicketService = require('../../services/ticket.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * Get all tickets for admin with filters
 * GET /api/admin/tickets
 */
const getAdminTickets = async (req, res) => {
  try {
    const adminId = req.user.id;
    const filters = req.query;
    
    const result = await TicketService.getAdminTickets(adminId, filters);
    
    return successResponse(
      res,
      result,
      'Admin tickets retrieved successfully'
    );
  } catch (error) {
    console.error('Get admin tickets error:', error);
    return errorResponse(res, 'Failed to retrieve tickets', 500);
  }
};

/**
 * Get ticket details (admin view with internal notes)
 * GET /api/admin/tickets/:ticketId
 */
const getAdminTicketDetails = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.user.id;
    
    const ticket = await TicketService.getTicketDetails(ticketId, adminId, true);
    
    return successResponse(
      res,
      ticket,
      'Ticket details retrieved successfully'
    );
  } catch (error) {
    console.error('Get admin ticket details error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve ticket details', 500);
  }
};

/**
 * Update ticket status
 * PATCH /api/admin/tickets/:ticketId/status
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;
    
    const updatedTicket = await TicketService.updateTicketStatus(ticketId, adminId, status);
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ticket_status_updated',
        details: {
          ticketId,
          newStatus: status,
          ticketNumber: updatedTicket.ticketNumber
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      updatedTicket,
      'Ticket status updated successfully'
    );
  } catch (error) {
    console.error('Update ticket status error:', error);
    return errorResponse(res, error.message || 'Failed to update ticket status', 500);
  }
};

/**
 * Respond to ticket
 * POST /api/admin/tickets/:ticketId/respond
 */
const respondToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, statusUpdate, isInternalNote = false } = req.body;
    const adminId = req.user.id;
    
    // Handle response attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        filePath: file.path.replace('uploads/', '')
      }));
    }
    
    const response = await TicketService.adminRespondToTicket(
      ticketId,
      adminId,
      message,
      attachments,
      statusUpdate,
      isInternalNote
    );

    // 🎫 ADD THIS NOTIFICATION HOOK:
    try {
      const TicketNotificationService = require('../../services/ticketNotification.service');
      await TicketNotificationService.handleTicketLifecycleEvent('ADMIN_RESPONSE', ticketId, { 
        messageId: response.id 
      });
    } catch (notificationError) {
      console.error('Admin response notification failed:', notificationError);
      // Don't break response if notification fails
    }
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ticket_admin_response',
        details: {
          ticketId,
          isInternalNote,
          statusUpdate
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      response,
      'Response sent successfully',
      201
    );
  } catch (error) {
    console.error('Admin respond error:', error);
    return errorResponse(res, error.message || 'Failed to send response', 500);
  }
};

/**
 * Assign ticket to admin
 * POST /api/admin/tickets/:ticketId/assign
 */
const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignedToId } = req.body;
    const currentAdminId = req.user.id;
    
    const result = await TicketService.assignTicketToAdmin(
      ticketId,
      assignedToId,
      currentAdminId
    );
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: currentAdminId,
        action: 'ticket_assigned',
        details: {
          ticketId,
          assignedToId,
          ticketNumber: result.ticketNumber
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      result,
      'Ticket assigned successfully'
    );
  } catch (error) {
    console.error('Assign ticket error:', error);
    return errorResponse(res, error.message || 'Failed to assign ticket', 500);
  }
};

/**
 * Close ticket with resolution
 * POST /api/admin/tickets/:ticketId/close
 */
const closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolutionNote } = req.body;
    const adminId = req.user.id;
    
    const closedTicket = await TicketService.closeTicket(ticketId, adminId, resolutionNote);

    // 🎫 ADD THIS NOTIFICATION HOOK:
    try {
      const TicketNotificationService = require('../../services/ticketNotification.service');
      await TicketNotificationService.handleTicketLifecycleEvent('CLOSED', ticketId);
    } catch (notificationError) {
      console.error('Ticket closed notification failed:', notificationError);
      // Don't break closure if notification fails
    }
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ticket_closed',
        details: {
          ticketId,
          ticketNumber: closedTicket.ticketNumber,
          resolutionNote
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      closedTicket,
      'Ticket closed successfully'
    );
  } catch (error) {
    console.error('Close ticket error:', error);
    return errorResponse(res, error.message || 'Failed to close ticket', 500);
  }
};

/**
 * Get admin dashboard statistics
 * GET /api/admin/tickets/dashboard
 */
const getAdminDashboard = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const stats = await TicketService.getAdminDashboardStats(adminId);
    
    return successResponse(
      res,
      stats,
      'Admin dashboard statistics retrieved successfully'
    );
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard statistics', 500);
  }
};

module.exports = {
  getAdminTickets,
  getAdminTicketDetails,
  updateTicketStatus,
  respondToTicket,
  assignTicket,
  closeTicket,
  getAdminDashboard
};