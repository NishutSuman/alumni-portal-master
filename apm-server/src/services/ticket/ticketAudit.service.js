
// ============================================
// FILE: src/services/ticketAudit.service.js (NEW)
// ============================================

const { prisma } = require('../../config/database');

class TicketAuditService {
  
  // ==========================================
  // AUDIT LOGGING
  // ==========================================
  
  static async logAction(ticketId, performedBy, actionType, details = {}, context = {}) {
    try {
      const auditData = {
        ticketId,
        actionType,
        performedBy,
        isSystem: false,
        description: this.generateDescription(actionType, details),
        ...context
      };
      
      // Add field changes if provided
      if (details.fieldName && (details.oldValue !== undefined || details.newValue !== undefined)) {
        auditData.fieldName = details.fieldName;
        auditData.oldValue = details.oldValue ? JSON.stringify(details.oldValue) : null;
        auditData.newValue = details.newValue ? JSON.stringify(details.newValue) : null;
      }
      
      // Add metadata
      if (Object.keys(details).length > 0) {
        auditData.metadata = details;
      }
      
      await prisma.ticketAuditLog.create({
        data: auditData
      });
      
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Don't throw - audit logging failures shouldn't break the main operation
    }
  }
  
  static async logSystemAction(ticketId, actionType, details = {}) {
    await this.logAction(ticketId, null, actionType, details, { isSystem: true });
  }
  
  static async logBulkAction(ticketIds, performedBy, actionType, details = {}) {
    const promises = ticketIds.map(ticketId => 
      this.logAction(ticketId, performedBy, 'BULK_OPERATION', {
        ...details,
        originalAction: actionType,
        bulkOperationSize: ticketIds.length
      })
    );
    
    await Promise.allSettled(promises);
  }
  
  // ==========================================
  // AUDIT QUERIES
  // ==========================================
  
  static async getTicketAuditTrail(ticketId, limit = 50) {
    return await prisma.ticketAuditLog.findMany({
      where: { ticketId },
      include: {
        performer: {
          select: { id: true, fullName: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
  
  static async getUserAuditHistory(userId, limit = 100) {
    return await prisma.ticketAuditLog.findMany({
      where: { performedBy: userId },
      include: {
        ticket: {
          select: { id: true, ticketNumber: true, subject: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
  
  // ==========================================
  // DESCRIPTION GENERATORS
  // ==========================================
  
  static generateDescription(actionType, details) {
    const descriptions = {
      CREATED: 'Ticket was created',
      STATUS_CHANGED: `Status changed from ${details.oldValue} to ${details.newValue}`,
      PRIORITY_CHANGED: `Priority changed from ${details.oldValue} to ${details.newValue}`,
      CATEGORY_CHANGED: `Category changed`,
      ASSIGNED: `Ticket assigned to ${details.assignedToName}`,
      REASSIGNED: `Ticket reassigned from ${details.oldAssignee} to ${details.newAssignee}`,
      MESSAGE_ADDED: details.isInternalNote ? 'Internal note added' : 'Message added',
      MESSAGE_EDITED: 'Message was edited',
      MESSAGE_REACTION_ADDED: `Reacted with ${details.reactionType}`,
      ATTACHMENT_ADDED: `${details.attachmentCount} file(s) uploaded`,
      ATTACHMENT_REMOVED: 'Attachment removed',
      SATISFACTION_RATED: `Satisfaction rated: ${details.satisfaction}`,
      REOPENED: `Ticket reopened. Reason: ${details.reason}`,
      CLOSED: 'Ticket was closed',
      BULK_OPERATION: `Bulk operation: ${details.originalAction} (${details.bulkOperationSize} tickets)`
    };
    
    return descriptions[actionType] || `Action performed: ${actionType}`;
  }
}

module.exports = TicketAuditService;