// ============================================
// FILE: src/controllers/support/ticketCategory.controller.js
// ============================================

const TicketService = require('../../services/ticket/ticket.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * Get active ticket categories
 * GET /api/tickets/categories
 */
const getActiveCategories = async (req, res) => {
  try {
    const categories = await TicketService.getTicketCategories();
    
    return successResponse(
      res,
      categories,
      'Ticket categories retrieved successfully'
    );
  } catch (error) {
    console.error('Get categories error:', error);
    return errorResponse(res, 'Failed to retrieve categories', 500);
  }
};

/**
 * Get available admins for ticket assignment
 * GET /api/tickets/admins
 */
const getAvailableAdmins = async (req, res) => {
  try {
    const admins = await TicketService.getAvailableAdmins();
    
    return successResponse(
      res,
      admins,
      'Available admins retrieved successfully'
    );
  } catch (error) {
    console.error('Get available admins error:', error);
    return errorResponse(res, 'Failed to retrieve available admins', 500);
  }
};

/**
 * Enhanced Add message to ticket conversation (UPDATE EXISTING METHOD)
 * POST /api/tickets/:ticketId/messages
 */
const addEnhancedMessage = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, contentType, formattedContent } = req.body;
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
    
    const messageData = {
      message,
      contentType: contentType || 'PLAIN_TEXT',
      formattedContent: formattedContent ? JSON.parse(formattedContent) : null
    };
    
    const newMessage = await TicketMessageService.addMessage(
      ticketId, 
      userId, 
      messageData, 
      attachments
    );
    
    return successResponse(
      res,
      newMessage,
      'Message added successfully',
      201
    );
  } catch (error) {
    console.error('Add enhanced message error:', error);
    return errorResponse(res, error.message || 'Failed to add message', 500);
  }
};


module.exports = {
  getActiveCategories,
  getAvailableAdmins,
  addEnhancedMessage
};