

const TicketService = require('../../services/ticket.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * Create new support ticket
 * POST /api/tickets
 */
const createTicket = async (req, res) => {
  try {
    const { categoryId, subject, description, priority, assignedToId } = req.body;
    const userId = req.user.id;
    
    // Handle file attachments if any
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        filePath: file.path.replace('uploads/', '') // Remove uploads/ prefix for database
      }));
    }
    
    const ticketData = {
      categoryId,
      subject,
      description,
      priority,
      assignedToId: assignedToId || null,
      attachments
    };
    
    const ticket = await TicketService.createTicket(userId, ticketData);
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'ticket_created',
        details: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          priority: ticket.priority,
          assignedToId: ticket.assignedToId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      ticket,
      'Support ticket created successfully',
      201
    );
  } catch (error) {
    console.error('Create ticket error:', error);
    return errorResponse(res, error.message || 'Failed to create ticket', 500);
  }
};

/**
 * Get user's tickets with pagination and filters
 * GET /api/tickets
 */
const getUserTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = req.query;
    
    const result = await TicketService.getUserTickets(userId, filters);
    
    return successResponse(
      res,
      result,
      'User tickets retrieved successfully'
    );
  } catch (error) {
    console.error('Get user tickets error:', error);
    return errorResponse(res, 'Failed to retrieve tickets', 500);
  }
};

/**
 * Get ticket details with full conversation
 * GET /api/tickets/:ticketId
 */
const getTicketDetails = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.isAdmin || false;
    
    const ticket = await TicketService.getTicketDetails(ticketId, userId, isAdmin);
    
    return successResponse(
      res,
      ticket,
      'Ticket details retrieved successfully'
    );
  } catch (error) {
    console.error('Get ticket details error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve ticket details', 500);
  }
};

/**
 * Update ticket (subject/description only)
 * PUT /api/tickets/:ticketId
 */
const updateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;
    
    const updatedTicket = await TicketService.updateTicket(ticketId, userId, updateData);
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'ticket_updated',
        details: {
          ticketId,
          ticketNumber: updatedTicket.ticketNumber,
          changes: updateData
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      updatedTicket,
      'Ticket updated successfully'
    );
  } catch (error) {
    console.error('Update ticket error:', error);
    return errorResponse(res, error.message || 'Failed to update ticket', 500);
  }
};

/**
 * Reopen closed ticket
 * POST /api/tickets/:ticketId/reopen
 */
const reopenTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    
    const ticket = await TicketService.reopenTicket(ticketId, userId, reason);
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'ticket_reopened',
        details: {
          ticketId,
          reason
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      ticket,
      'Ticket reopened successfully'
    );
  } catch (error) {
    console.error('Reopen ticket error:', error);
    return errorResponse(res, error.message || 'Failed to reopen ticket', 500);
  }
};

/**
 * Add message to ticket conversation
 * POST /api/tickets/:ticketId/messages
 */
const addMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    
    // Handle message attachments
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
    
    const newMessage = await TicketService.addMessage(ticketId, userId, message, attachments);
    
    return successResponse(
      res,
      newMessage,
      'Message added successfully',
      201
    );
  } catch (error) {
    console.error('Add message error:', error);
    return errorResponse(res, error.message || 'Failed to add message', 500);
  }
};

/**
 * Rate ticket resolution
 * POST /api/tickets/:ticketId/satisfaction
 */
const rateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { satisfaction, satisfactionNote } = req.body;
    const userId = req.user.id;
    
    const result = await TicketService.rateTicketSatisfaction(
      ticketId, 
      userId, 
      satisfaction, 
      satisfactionNote
    );
    
    return successResponse(
      res,
      result,
      'Thank you for your feedback!'
    );
  } catch (error) {
    console.error('Rate ticket error:', error);
    return errorResponse(res, error.message || 'Failed to submit rating', 500);
  }
};

/**
 * Get user's ticket dashboard stats
 * GET /api/tickets/dashboard
 */
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await TicketService.getUserDashboardStats(userId);
    
    return successResponse(
      res,
      stats,
      'Dashboard statistics retrieved successfully'
    );
  } catch (error) {
    console.error('Get user dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard statistics', 500);
  }
};

/**
 * Request email copy of ticket conversation
 * POST /api/tickets/:ticketId/email-copy
 */
const requestEmailCopy = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;
    
    const result = await TicketService.requestEmailCopy(ticketId, userId);
    
    return successResponse(
      res,
      result,
      'Email copy request processed successfully'
    );
  } catch (error) {
    console.error('Request email copy error:', error);
    return errorResponse(res, error.message || 'Failed to process email request', 500);
  }
};

module.exports = {
  createTicket,
  getUserTickets,
  getTicketDetails,
  updateTicket,
  reopenTicket,
  addMessage,
  rateTicket,
  getUserDashboard,
  requestEmailCopy
};



