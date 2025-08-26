// src/services/ticketExport.service.js
const { prisma } = require('../config/database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class TicketExportService {
  
  /**
   * Export ticket conversation as PDF
   */
  static async exportTicketConversationToPDF(ticketId, userId) {
    try {
      // Get ticket with full conversation
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: { fullName: true, email: true }
          },
          category: {
            select: { name: true }
          },
          assignedTo: {
            select: { fullName: true }
          },
          resolver: {
            select: { fullName: true }
          },
          messages: {
            include: {
              sender: {
                select: { fullName: true, role: true }
              },
              attachments: {
                select: { originalName: true, fileSize: true, mimeType: true }
              }
            },
            orderBy: { createdAt: 'asc' }
          },
          attachments: {
            select: { originalName: true, fileSize: true, mimeType: true }
          }
        }
      });

      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Check access permissions
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      const hasAccess = ticket.userId === userId || 
                       ticket.assignedToId === userId ||
                       user.role === 'SUPER_ADMIN';

      if (!hasAccess) {
        throw new Error('Access denied to export this ticket');
      }

      // Generate PDF
      const pdfBuffer = await this.generatePDFBuffer(ticket);
      
      // Generate filename
      const fileName = `ticket_${ticket.ticketNumber}_conversation.pdf`;
      
      return {
        buffer: pdfBuffer,
        fileName,
        mimeType: 'application/pdf'
      };

    } catch (error) {
      console.error('Export ticket PDF error:', error);
      throw error;
    }
  }

  /**
   * Generate PDF buffer from ticket data
   */
  static async generatePDFBuffer(ticket) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          margin: 50,
          size: 'A4'
        });
        
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // PDF Header
        doc.fontSize(20)
           .fillColor('#333')
           .text('Alumni Portal Support System', { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(16)
           .fillColor('#666') 
           .text('Ticket Conversation Export', { align: 'center' })
           .moveDown(1);

        // Ticket Information Section
        doc.fontSize(14)
           .fillColor('#333')
           .text('TICKET INFORMATION', { underline: true })
           .moveDown(0.5);

        const ticketInfo = [
          ['Ticket Number:', ticket.ticketNumber],
          ['Subject:', ticket.subject],
          ['Category:', ticket.category.name],
          ['Priority:', ticket.priority],
          ['Status:', ticket.status],
          ['Created By:', ticket.user.fullName],
          ['User Email:', ticket.user.email],
          ['Assigned To:', ticket.assignedTo?.fullName || 'Unassigned'],
          ['Created On:', ticket.createdAt.toLocaleDateString()],
          ['Last Activity:', ticket.lastActivity.toLocaleDateString()],
          ['Resolved By:', ticket.resolver?.fullName || 'N/A'],
          ['Resolved On:', ticket.resolvedAt?.toLocaleDateString() || 'N/A']
        ];

        ticketInfo.forEach(([label, value]) => {
          doc.fontSize(10)
             .fillColor('#666')
             .text(label, { continued: true })
             .fillColor('#333')
             .text(` ${value}`)
             .moveDown(0.3);
        });

        doc.moveDown(1);

        // Description Section
        doc.fontSize(14)
           .fillColor('#333')
           .text('ISSUE DESCRIPTION', { underline: true })
           .moveDown(0.5);

        doc.fontSize(10)
           .fillColor('#333')
           .text(ticket.description, { align: 'left' })
           .moveDown(1);

        // Initial Attachments
        if (ticket.attachments.length > 0) {
          doc.fontSize(12)
             .fillColor('#333')
             .text('INITIAL ATTACHMENTS', { underline: true })
             .moveDown(0.3);

          ticket.attachments.forEach(attachment => {
            doc.fontSize(10)
               .fillColor('#666')
               .text(`• ${attachment.originalName} (${this.formatFileSize(attachment.fileSize)})`)
               .moveDown(0.2);
          });
          doc.moveDown(0.5);
        }

        // Conversation Section
        if (ticket.messages.length > 0) {
          doc.fontSize(14)
             .fillColor('#333')
             .text('CONVERSATION HISTORY', { underline: true })
             .moveDown(0.5);

          ticket.messages.forEach((message, index) => {
            // Check if we need a new page
            if (doc.y > doc.page.height - 150) {
              doc.addPage();
            }

            // Message header
            const senderType = message.isFromAdmin ? 'ADMIN' : 'USER';
            const headerColor = message.isFromAdmin ? '#007bff' : '#28a745';
            
            doc.fontSize(11)
               .fillColor(headerColor)
               .text(`${senderType}: ${message.sender.fullName}`, { continued: true })
               .fillColor('#666')
               .text(` - ${message.createdAt.toLocaleDateString()} ${message.createdAt.toLocaleTimeString()}`)
               .moveDown(0.3);

            // Message content
            doc.fontSize(10)
               .fillColor('#333')
               .text(message.message, { 
                 align: 'left',
                 indent: 20 
               })
               .moveDown(0.3);

            // Message attachments
            if (message.attachments.length > 0) {
              doc.fontSize(9)
                 .fillColor('#666')
                 .text('Attachments:', { indent: 20 })
                 .moveDown(0.2);

              message.attachments.forEach(attachment => {
                doc.fontSize(9)
                   .fillColor('#666')
                   .text(`  • ${attachment.originalName} (${this.formatFileSize(attachment.fileSize)})`, { indent: 25 })
                   .moveDown(0.1);
              });
            }

            doc.moveDown(0.5);
          });
        }

        // Satisfaction Section
        if (ticket.satisfaction) {
          doc.fontSize(12)
             .fillColor('#333')
             .text('USER SATISFACTION', { underline: true })
             .moveDown(0.3);

          const satisfactionMap = {
            'VERY_SATISFIED': '⭐⭐⭐⭐⭐ Very Satisfied',
            'SATISFIED': '⭐⭐⭐⭐ Satisfied', 
            'NEUTRAL': '⭐⭐⭐ Neutral',
            'DISSATISFIED': '⭐⭐ Dissatisfied',
            'VERY_DISSATISFIED': '⭐ Very Dissatisfied'
          };

          doc.fontSize(10)
             .fillColor('#333')
             .text(`Rating: ${satisfactionMap[ticket.satisfaction] || ticket.satisfaction}`)
             .moveDown(1);
        }

        // Footer
        doc.fontSize(8)
           .fillColor('#999')
           .text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, { 
             align: 'center' 
           });

        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Export multiple tickets as CSV (admin only)
   */
  static async exportTicketsToCSV(filters = {}) {
    try {
      const tickets = await prisma.ticket.findMany({
        where: {
          ...filters
        },
        include: {
          user: {
            select: { fullName: true, email: true }
          },
          category: {
            select: { name: true }
          },
          assignedTo: {
            select: { fullName: true }
          },
          resolver: {
            select: { fullName: true }
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // CSV Header
      const csvHeader = [
        'Ticket Number',
        'Subject', 
        'User Name',
        'User Email',
        'Category',
        'Priority',
        'Status',
        'Assigned To',
        'Resolved By',
        'Message Count',
        'Satisfaction',
        'Created Date',
        'Resolved Date',
        'Response Time (Hours)'
      ].join(',');

      // CSV Rows
      const csvRows = await Promise.all(
        tickets.map(async (ticket) => {
          // Calculate response time
          const firstAdminResponse = await prisma.ticketMessage.findFirst({
            where: {
              ticketId: ticket.id,
              isFromAdmin: true
            },
            orderBy: { createdAt: 'asc' }
          });

          let responseTime = '';
          if (firstAdminResponse) {
            const diffMs = firstAdminResponse.createdAt - ticket.createdAt;
            responseTime = (diffMs / (1000 * 60 * 60)).toFixed(1); // Hours
          }

          return [
            ticket.ticketNumber,
            `"${ticket.subject.replace(/"/g, '""')}"`,
            ticket.user.fullName,
            ticket.user.email,
            ticket.category.name,
            ticket.priority,
            ticket.status,
            ticket.assignedTo?.fullName || '',
            ticket.resolver?.fullName || '',
            ticket._count.messages,
            ticket.satisfaction || '',
            ticket.createdAt.toLocaleDateString(),
            ticket.resolvedAt?.toLocaleDateString() || '',
            responseTime
          ].join(',');
        })
      );

      const csvContent = [csvHeader, ...csvRows].join('\n');
      
      return {
        content: csvContent,
        fileName: `tickets_export_${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv'
      };

    } catch (error) {
      console.error('Export tickets CSV error:', error);
      throw error;
    }
  }
}

module.exports = TicketExportService;