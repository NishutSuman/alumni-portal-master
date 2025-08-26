const { prisma } = require('../config/database');
const CacheService = require('../config/redis');
const TicketAuditService = require('./ticketAudit.service');
const { v4: uuidv4 } = require('uuid');

class TicketBulkService {
  
  // ==========================================
  // BULK OPERATIONS
  // ==========================================
  
  static async performBulkOperation(adminId, operationType, ticketIds, operationData = {}) {
    const operationId = uuidv4();
    
    // Create bulk operation record
    const bulkOperation = await prisma.ticketBulkOperation.create({
      data: {
        operationId,
        operationType,
        description: this.generateOperationDescription(operationType, operationData),
        targetCount: ticketIds.length,
        ticketIds,
        operationData,
        status: 'PENDING',
        performedBy: adminId
      }
    });
    
    // Process operation asynchronously
    setImmediate(async () => {
      await this.processBulkOperation(bulkOperation);
    });
    
    return {
      operationId,
      status: 'PENDING',
      targetCount: ticketIds.length,
      message: 'Bulk operation started. You will be notified when completed.'
    };
  }
  
  static async processBulkOperation(bulkOperation) {
    try {
      await prisma.ticketBulkOperation.update({
        where: { id: bulkOperation.id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date()
        }
      });
      
      const results = {
        successful: [],
        failed: []
      };
      
      // Process each ticket
      for (const ticketId of bulkOperation.ticketIds) {
        try {
          await this.processSingleTicket(
            ticketId,
            bulkOperation.operationType,
            bulkOperation.operationData,
            bulkOperation.performedBy
          );
          
          results.successful.push(ticketId);
        } catch (error) {
          console.error(`Bulk operation failed for ticket ${ticketId}:`, error);
          results.failed.push({
            ticketId,
            error: error.message
          });
        }
      }
      
      // Update operation status
      const status = results.failed.length === 0 ? 'COMPLETED' : 
                    results.successful.length === 0 ? 'FAILED' : 
                    'PARTIALLY_COMPLETED';
      
      await prisma.ticketBulkOperation.update({
        where: { id: bulkOperation.id },
        data: {
          status,
          successCount: results.successful.length,
          failureCount: results.failed.length,
          results,
          completedAt: new Date()
        }
      });
      
      // Log bulk action in audit trail
      await TicketAuditService.logBulkAction(
        results.successful,
        bulkOperation.performedBy,
        bulkOperation.operationType,
        {
          operationId: bulkOperation.operationId,
          totalTargeted: bulkOperation.targetCount,
          successCount: results.successful.length,
          failureCount: results.failed.length
        }
      );
      
      // Invalidate relevant caches
      await this.invalidateBulkOperationCaches();
      
    } catch (error) {
      console.error('Bulk operation processing error:', error);
      
      await prisma.ticketBulkOperation.update({
        where: { id: bulkOperation.id },
        data: {
          status: 'FAILED',
          failureReason: error.message,
          completedAt: new Date()
        }
      });
    }
  }
  
  static async processSingleTicket(ticketId, operationType, operationData, adminId) {
    switch (operationType) {
      case 'ASSIGN_TO_ADMIN':
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            assignedToId: operationData.assignedToId,
            assignedAt: new Date(),
            lastActivity: new Date()
          }
        });
        break;
        
      case 'CHANGE_STATUS':
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: operationData.status,
            lastActivity: new Date(),
            ...(operationData.status === 'RESOLVED' && {
              resolvedAt: new Date(),
              resolvedBy: adminId
            })
          }
        });
        break;
        
      case 'CHANGE_PRIORITY':
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            priority: operationData.priority,
            lastActivity: new Date()
          }
        });
        break;
        
      case 'CHANGE_CATEGORY':
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            categoryId: operationData.categoryId,
            lastActivity: new Date()
          }
        });
        break;
        
      case 'CLOSE_WITH_RESOLUTION':
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: 'CLOSED',
            resolvedAt: new Date(),
            resolvedBy: adminId,
            resolutionNote: operationData.resolutionNote,
            lastActivity: new Date()
          }
        });
        break;
        
      case 'ADD_TAG':
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { tags: true }
        });
        
        const currentTags = ticket.tags || [];
        const newTags = [...new Set([...currentTags, ...operationData.tags])];
        
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            tags: newTags,
            lastActivity: new Date()
          }
        });
        break;
        
      default:
        throw new Error(`Unsupported bulk operation type: ${operationType}`);
    }
  }
  
  // ==========================================
  // BULK OPERATION STATUS
  // ==========================================
  
  static async getBulkOperationStatus(operationId, adminId) {
    const operation = await prisma.ticketBulkOperation.findUnique({
      where: { operationId },
      include: {
        performer: {
          select: { id: true, fullName: true }
        }
      }
    });
    
    if (!operation) {
      throw new Error('Bulk operation not found');
    }
    
    // Permission check
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });
    
    if (operation.performedBy !== adminId && user.role !== 'SUPER_ADMIN') {
      throw new Error('Access denied to this operation');
    }
    
    return operation;
  }
  
  static async getAdminBulkOperationHistory(adminId, limit = 20) {
    const operations = await prisma.ticketBulkOperation.findMany({
      where: { performedBy: adminId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        operationId: true,
        operationType: true,
        description: true,
        targetCount: true,
        successCount: true,
        failureCount: true,
        status: true,
        createdAt: true,
        completedAt: true
      }
    });
    
    return operations;
  }
  
  // ==========================================
  // UTILITIES
  // ==========================================
  
  static generateOperationDescription(operationType, operationData) {
    const descriptions = {
      ASSIGN_TO_ADMIN: `Bulk assign to admin: ${operationData.adminName}`,
      CHANGE_STATUS: `Bulk status change to: ${operationData.status}`,
      CHANGE_PRIORITY: `Bulk priority change to: ${operationData.priority}`,
      CHANGE_CATEGORY: `Bulk category change to: ${operationData.categoryName}`,
      CLOSE_WITH_RESOLUTION: 'Bulk close with resolution',
      ADD_TAG: `Bulk add tags: ${operationData.tags?.join(', ')}`,
      EXPORT_SELECTED: 'Export selected tickets'
    };
    
    return descriptions[operationType] || `Bulk operation: ${operationType}`;
  }
  
  static async invalidateBulkOperationCaches() {
    const patterns = [
      'tickets:admin:*',
      'tickets:user:*',
      'tickets:details:*',
      'bulk:operations:*'
    ];
    
    await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
  }
}

module.exports = TicketBulkService;