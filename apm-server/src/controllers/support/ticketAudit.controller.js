const TicketAuditService = require('../../services/ticket/ticketAudit.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * Get ticket audit trail
 * GET /api/tickets/:ticketId/audit
 */
const getTicketAuditTrail = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { limit = 50 } = req.query;
    const userId = req.user.id;
    
    // Permission check - user must have access to the ticket
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { userId: true, assignedToId: true }
    });
    
    if (!ticket) {
      return errorResponse(res, 'Ticket not found', 404);
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const hasAccess = ticket.userId === userId || 
                     ticket.assignedToId === userId ||
                     user.role === 'SUPER_ADMIN';
    
    if (!hasAccess) {
      return errorResponse(res, 'Access denied', 403);
    }
    
    const auditTrail = await TicketAuditService.getTicketAuditTrail(ticketId, parseInt(limit));
    
    return successResponse(
      res,
      auditTrail,
      'Audit trail retrieved successfully'
    );
  } catch (error) {
    console.error('Get audit trail error:', error);
    return errorResponse(res, 'Failed to retrieve audit trail', 500);
  }
};

/**
 * Get user audit history (admin only)
 * GET /api/admin/users/:userId/audit
 */
const getUserAuditHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100 } = req.query;
    
    const auditHistory = await TicketAuditService.getUserAuditHistory(userId, parseInt(limit));
    
    return successResponse(
      res,
      auditHistory,
      'User audit history retrieved successfully'
    );
  } catch (error) {
    console.error('Get user audit history error:', error);
    return errorResponse(res, 'Failed to retrieve audit history', 500);
  }
};

module.exports = {
  getTicketAuditTrail,
  getUserAuditHistory
};