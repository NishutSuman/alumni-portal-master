// ============================================
// TICKET SERVICE - FIXED STRUCTURE
// Following existing patterns from EventService
// ============================================

// FILE: src/services/ticket.service.js
const { prisma } = require('../../config/database');
const CacheService = require('../../config/redis');
const { generateTicketNumber } = require('../../utils/ticketNumber.util');

class TicketService {
  // Fixed categories (no seeding needed)
  static TICKET_CATEGORIES = [
    'Tech', 'Post', 'Event', 'LifeLink', 'Account', 
    'Registration', 'Payment', 'Billing', 'General', 
    'Committee/Cell', 'Miscellaneous', 'Discipline'
  ];

  // ==========================================
  // CATEGORY MANAGEMENT
  // ==========================================

  static async ensureCategories() {
    try {
      for (const categoryName of this.TICKET_CATEGORIES) {
        await prisma.ticketCategory.upsert({
          where: { name: categoryName },
          update: {},
          create: {
            name: categoryName,
            isActive: true,
            priority: 0
          }
        });
      }
    } catch (error) {
      console.error('Error ensuring ticket categories:', error);
    }
  }

  static async getTicketCategories() {
    const cacheKey = 'tickets:categories:active';
    const cached = await CacheService.get(cacheKey);
    
    if (cached) return cached;
    
    // Ensure categories exist
    await this.ensureCategories();
    
    const categories = await prisma.ticketCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    
    await CacheService.set(cacheKey, categories, 3600); // 1 hour
    return categories;
  }

  static async getAvailableAdmins() {
    const cacheKey = 'tickets:admins:available';
    const cached = await CacheService.get(cacheKey);
    
    if (cached) return cached;
    
    const admins = await prisma.user.findMany({
      where: {
        role: 'SUPER_ADMIN',
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        profileImage: true
      },
      orderBy: { fullName: 'asc' }
    });
    
    await CacheService.set(cacheKey, admins, 1800); // 30 minutes
    return admins;
  }

  // ==========================================
  // TICKET CREATION & MANAGEMENT
  // ==========================================
  
  static async createTicket(userId, ticketData) {
    const { categoryId, subject, description, priority = 'MEDIUM', assignedToId, attachments = [] } = ticketData;
    
    // Generate unique ticket number
    const ticketNumber = await generateTicketNumber();
    
    // Validate assigned admin exists and is active
    if (assignedToId) {
      const assignedAdmin = await prisma.user.findFirst({
        where: {
          id: assignedToId,
          role: 'SUPER_ADMIN',
          isActive: true
        }
      });
      
      if (!assignedAdmin) {
        throw new Error('Selected admin is not available');
      }
    }
    
    // Create ticket with transaction
    const ticket = await prisma.$transaction(async (tx) => {
      // Create main ticket
      const newTicket = await tx.ticket.create({
        data: {
          ticketNumber,
          userId,
          categoryId,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          assignedToId,
          assignedAt: assignedToId ? new Date() : null,
          lastActivity: new Date()
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true }
          },
          assignedTo: {
            select: { id: true, fullName: true, email: true }
          },
          category: {
            select: { id: true, name: true, description: true }
          }
        }
      });
      
      // Add attachments if any
      if (attachments.length > 0) {
        await tx.ticketAttachment.createMany({
          data: attachments.map(attachment => ({
            ticketId: newTicket.id,
            filename: attachment.filename,
            originalName: attachment.originalName,
            fileSize: attachment.fileSize,
            mimeType: attachment.mimeType,
            filePath: attachment.filePath,
            uploadedBy: userId
          }))
        });
      }
      
      return newTicket;
    });
    
    // NO AUTOMATIC EMAIL - Only send if user requests
    
    // Invalidate relevant caches
    await this.invalidateTicketCaches(userId, assignedToId);
    
    return ticket;
  }
  
  static async getUserTickets(userId, filters = {}) {
    const { status, categoryId, page = 1, limit = 10, search } = filters;
    const skip = (page - 1) * limit;
    
    const where = {
      userId,
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ]
      })
    };
    
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, icon: true }
          },
          assignedTo: {
            select: { id: true, fullName: true }
          },
          _count: {
            select: {
              messages: true,
              attachments: true
            }
          }
        },
        orderBy: { lastActivity: 'desc' },
        skip,
        take: limit
      }),
      prisma.ticket.count({ where })
    ]);
    
    return {
      tickets,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        hasNext: skip + limit < total,
        hasPrevious: page > 1
      }
    };
  }
  
  // ==========================================
  // ADMIN TICKET MANAGEMENT
  // ==========================================
  
  static async getAdminTickets(adminId, filters = {}) {
    const { status, categoryId, assignedToMe, page = 1, limit = 20, search, priority } = filters;
    const skip = (page - 1) * limit;
    
    const where = {
      ...(status && { status }),
      ...(categoryId && { categoryId }),
      ...(priority && { priority }),
      ...(assignedToMe && { assignedToId: adminId }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { user: { fullName: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };
    
    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, batch: true }
          },
          category: {
            select: { id: true, name: true, icon: true }
          },
          assignedTo: {
            select: { id: true, fullName: true }
          },
          _count: {
            select: {
              messages: true,
              attachments: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { lastActivity: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.ticket.count({ where })
    ]);
    
    return {
      tickets,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        currentPage: page,
        hasNext: skip + limit < total,
        hasPrevious: page > 1
      }
    };
  }
  
  static async getTicketDetails(ticketId, requesterId, isAdmin = false) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, batch: true, profileImage: true }
        },
        category: {
          select: { id: true, name: true, description: true, icon: true }
        },
        assignedTo: {
          select: { id: true, fullName: true, email: true }
        },
        resolver: {
          select: { id: true, fullName: true }
        },
        messages: {
          include: {
            sender: {
              select: { id: true, fullName: true, role: true, profileImage: true }
            },
            attachments: {
              select: { id: true, filename: true, originalName: true, fileSize: true, mimeType: true }
            }
          },
          where: isAdmin ? {} : { isInternalNote: false }, // Hide internal notes from users
          orderBy: { createdAt: 'asc' }
        },
        attachments: {
          include: {
            uploader: {
              select: { id: true, fullName: true }
            }
          }
        }
      }
    });
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Check access permissions
    if (!isAdmin && ticket.userId !== requesterId) {
      throw new Error('Access denied');
    }
    
    // Mark messages as read if user is viewing
    if (!isAdmin && ticket.userId === requesterId) {
      await prisma.ticketMessage.updateMany({
        where: {
          ticketId: ticketId,
          isFromAdmin: true,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
    }
    
    return ticket;
  }

  // ==========================================
  // TICKET OPERATIONS
  // ==========================================
  
  static async updateTicket(ticketId, userId, updateData) {
    const { subject, description, categoryId, priority } = updateData;
    
    const updatedTicket = await prisma.ticket.update({
      where: { 
        id: ticketId,
        userId // Ensure user owns the ticket
      },
      data: {
        ...(subject && { subject: subject.trim() }),
        ...(description && { description: description.trim() }),
        ...(categoryId && { categoryId }),
        ...(priority && { priority }),
        lastActivity: new Date()
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true }
        },
        assignedTo: {
          select: { id: true, fullName: true }
        }
      }
    });
    
    // Invalidate caches
    await this.invalidateTicketCaches(userId, updatedTicket.assignedToId);
    
    return updatedTicket;
  }
  
  static async reopenTicket(ticketId, userId, reason) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } }
      }
    });
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    if (ticket.userId !== userId) {
      throw new Error('Access denied');
    }
    
    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      throw new Error('Only resolved or closed tickets can be reopened');
    }
    
    // Update ticket and add message
    const updatedTicket = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'REOPENED',
          reopenCount: { increment: 1 },
          lastActivity: new Date(),
          resolvedAt: null,
          resolvedBy: null,
          resolutionNote: null
        }
      });
      
      // Add reopen message
      await tx.ticketMessage.create({
        data: {
          ticketId: ticketId,
          senderId: userId,
          message: `Ticket reopened by user. Reason: ${reason}`,
          isFromAdmin: false
        }
      });
      
      return updated;
    });
    
    // NO AUTOMATIC NOTIFICATION
    
    // Invalidate caches
    await this.invalidateTicketCaches(userId, ticket.assignedToId);
    
    return updatedTicket;
  }

  static async addMessage(ticketId, userId, message, attachments = []) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { userId: true, assignedToId: true, status: true }
    });
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Determine if message is from admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const isFromAdmin = user.role === 'SUPER_ADMIN';
    
    const newMessage = await prisma.$transaction(async (tx) => {
      // Create the message
      const messageData = await tx.ticketMessage.create({
        data: {
          ticketId,
          senderId: userId,
          message: message.trim(),
          isFromAdmin
        },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, profileImage: true }
          }
        }
      });
      
      // Add attachments if any
      if (attachments.length > 0) {
        await tx.ticketMessageAttachment.createMany({
          data: attachments.map(attachment => ({
            messageId: messageData.id,
            filename: attachment.filename,
            originalName: attachment.originalName,
            fileSize: attachment.fileSize,
            mimeType: attachment.mimeType,
            filePath: attachment.filePath
          }))
        });
      }
      
      // Update ticket's last activity and status if needed
      const statusUpdate = {};
      if (isFromAdmin && ticket.status === 'OPEN') {
        statusUpdate.status = 'IN_PROGRESS';
      } else if (!isFromAdmin && ticket.status === 'WAITING_FOR_USER') {
        statusUpdate.status = 'IN_PROGRESS';
      }
      
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          lastActivity: new Date(),
          ...statusUpdate
        }
      });
      
      return messageData;
    });
    
    // NO AUTOMATIC NOTIFICATION
    
    // Invalidate caches
    await this.invalidateTicketCaches(ticket.userId, ticket.assignedToId);
    
    return newMessage;
  }

  static async rateTicketSatisfaction(ticketId, userId, satisfaction, satisfactionNote) {
    const updatedTicket = await prisma.ticket.update({
      where: { 
        id: ticketId,
        userId, // Ensure user owns the ticket
        status: { in: ['RESOLVED', 'CLOSED'] } // Only allow rating closed tickets
      },
      data: {
        satisfaction,
        satisfactionNote: satisfactionNote?.trim(),
        ratedAt: new Date()
      },
      include: {
        category: { select: { name: true } },
        assignedTo: { select: { fullName: true } }
      }
    });
    
    // Invalidate caches
    await this.invalidateTicketCaches(userId, updatedTicket.assignedToId);
    
    return updatedTicket;
  }

  // ==========================================
  // ADMIN OPERATIONS
  // ==========================================

  static async updateTicketStatus(ticketId, adminId, status) {
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        lastActivity: new Date(),
        ...(status === 'RESOLVED' && { resolvedAt: new Date(), resolvedBy: adminId })
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true } }
      }
    });
    
    // NO AUTOMATIC NOTIFICATION
    
    // Invalidate caches
    await this.invalidateTicketCaches(updatedTicket.userId, updatedTicket.assignedToId);
    
    return updatedTicket;
  }

  static async adminRespondToTicket(ticketId, adminId, message, attachments = [], statusUpdate, isInternalNote = false) {
    const response = await this.addMessage(ticketId, adminId, message, attachments);
    
    // Update status if provided
    if (statusUpdate) {
      await this.updateTicketStatus(ticketId, adminId, statusUpdate);
    }
    
    return response;
  }

  static async assignTicketToAdmin(ticketId, assignedToId, currentAdminId) {
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId,
        assignedAt: new Date(),
        lastActivity: new Date()
      },
      include: {
        user: { select: { fullName: true, email: true } },
        assignedTo: { select: { fullName: true, email: true } }
      }
    });
    
    // NO AUTOMATIC NOTIFICATION
    
    // Invalidate caches
    await this.invalidateTicketCaches(updatedTicket.userId, assignedToId);
    
    return updatedTicket;
  }

  static async closeTicket(ticketId, adminId, resolutionNote) {
    const closedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'CLOSED',
        resolvedAt: new Date(),
        resolvedBy: adminId,
        resolutionNote: resolutionNote.trim(),
        lastActivity: new Date()
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        resolver: { select: { fullName: true } }
      }
    });
    
    // NO AUTOMATIC NOTIFICATION
    
    // Invalidate caches
    await this.invalidateTicketCaches(closedTicket.userId, closedTicket.assignedToId);
    
    return closedTicket;
  }
  
  // ==========================================
  // DASHBOARD STATS (SIMPLIFIED AS REQUESTED)
  // ==========================================
  
  static async getUserDashboardStats(userId) {
    const cacheKey = `tickets:user:${userId}:dashboard`;
    const cached = await CacheService.get(cacheKey);
    
    if (cached) return cached;
    
    const [openCount, closedCount] = await Promise.all([
      prisma.ticket.count({
        where: { 
          userId, 
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'REOPENED'] } 
        }
      }),
      prisma.ticket.count({
        where: { 
          userId, 
          status: { in: ['RESOLVED', 'CLOSED'] } 
        }
      })
    ]);
    
    const stats = {
      openTickets: openCount,
      closedTickets: closedCount,
      totalTickets: openCount + closedCount
    };
    
    await CacheService.set(cacheKey, stats, 300); // 5 minutes
    return stats;
  }
  
  static async getAdminDashboardStats(adminId) {
    const cacheKey = `tickets:admin:${adminId}:dashboard`;
    const cached = await CacheService.get(cacheKey);
    
    if (cached) return cached;
    
    const [
      allOpenCount,
      allClosedCount,
      assignedOpenCount,
      assignedClosedCount,
      urgentCount
    ] = await Promise.all([
      // All open tickets
      prisma.ticket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'REOPENED'] } }
      }),
      // All closed tickets
      prisma.ticket.count({
        where: { status: { in: ['RESOLVED', 'CLOSED'] } }
      }),
      // Assigned open tickets
      prisma.ticket.count({
        where: { 
          assignedToId: adminId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'REOPENED'] } 
        }
      }),
      // Assigned closed tickets
      prisma.ticket.count({
        where: { 
          assignedToId: adminId,
          status: { in: ['RESOLVED', 'CLOSED'] } 
        }
      }),
      // Urgent tickets
      prisma.ticket.count({
        where: { 
          priority: 'URGENT',
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'REOPENED'] } 
        }
      })
    ]);
    
    const stats = {
      allTickets: {
        open: allOpenCount,
        closed: allClosedCount,
        total: allOpenCount + allClosedCount
      },
      myTickets: {
        open: assignedOpenCount,
        closed: assignedClosedCount,
        total: assignedOpenCount + assignedClosedCount
      },
      urgentTickets: urgentCount
    };
    
    await CacheService.set(cacheKey, stats, 300); // 5 minutes
    return stats;
  }
  
  // ==========================================
  // UTILITY METHODS
  // ==========================================
  
  static async invalidateTicketCaches(userId, assignedToId) {
    const patterns = [
      `tickets:user:${userId}:*`,
      'tickets:admin:*',
      'tickets:categories:*',
      'tickets:details:*'
    ];
    
    if (assignedToId) {
      patterns.push(`tickets:admin:${assignedToId}:*`);
    }
    
    await Promise.all(patterns.map(pattern => CacheService.delPattern(pattern)));
  }

  // Add method to request email copy (called explicitly by user)
  static async requestEmailCopy(ticketId, userId) {
    const ticket = await this.getTicketDetails(ticketId, userId, false);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    // Here you can implement email sending logic
    // This is called only when user explicitly requests it
    
    return { message: 'Email copy will be sent to your registered email address' };
  }
}

module.exports = TicketService;

