// src/controllers/support/ticketExport.controller.js
const TicketExportService = require('../../services/ticket/ticketExport.service');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Export single ticket conversation as PDF
 * GET /api/tickets/:ticketId/export/pdf
 */
const exportTicketPDF = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.id;

    const exportResult = await TicketExportService.exportTicketConversationToPDF(ticketId, userId);
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    res.setHeader('Content-Length', exportResult.buffer.length);
    
    // Send PDF buffer
    res.send(exportResult.buffer);

  } catch (error) {
    console.error('Export ticket PDF error:', error);
    return errorResponse(res, error.message || 'Failed to export ticket conversation', 500);
  }
};

/**
 * Export tickets list as CSV (Admin only)  
 * POST /api/tickets/admin/export/csv
 */
const exportTicketsCSV = async (req, res) => {
  try {
    const filters = req.body || {};
    
    // Build filters from request body
    const whereClause = {};
    
    if (filters.status) {
      whereClause.status = filters.status;
    }
    
    if (filters.priority) {
      whereClause.priority = filters.priority;
    }
    
    if (filters.categoryId) {
      whereClause.categoryId = filters.categoryId;
    }
    
    if (filters.dateFrom || filters.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) {
        whereClause.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.createdAt.lte = new Date(filters.dateTo);
      }
    }

    const exportResult = await TicketExportService.exportTicketsToCSV(whereClause);
    
    // Set response headers for CSV download
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    
    // Send CSV content
    res.send(exportResult.content);

  } catch (error) {
    console.error('Export tickets CSV error:', error);
    return errorResponse(res, error.message || 'Failed to export tickets list', 500);
  }
};

/**
 * Get export status and history (Admin only)
 * GET /api/tickets/admin/export/history
 */
const getExportHistory = async (req, res) => {
  try {
    // Get recent export activities from activity logs
    const exports = await prisma.activityLog.findMany({
      where: {
        action: {
          in: ['ticket_pdf_export', 'tickets_csv_export']
        }
      },
      include: {
        user: {
          select: { fullName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const exportHistory = exports.map(log => ({
      id: log.id,
      userName: log.user.fullName,
      exportType: log.action.includes('pdf') ? 'PDF' : 'CSV',
      details: log.details,
      exportedAt: log.createdAt,
      ipAddress: log.ipAddress
    }));

    return successResponse(
      res,
      { exports: exportHistory },
      'Export history retrieved successfully'
    );

  } catch (error) {
    console.error('Export history error:', error);
    return errorResponse(res, 'Failed to retrieve export history', 500);
  }
};

/**
 * Get export statistics (Admin only)
 * GET /api/tickets/admin/export/stats
 */
const getExportStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalPDFExports,
      totalCSVExports,
      recentPDFExports,
      recentCSVExports
    ] = await Promise.all([
      prisma.activityLog.count({
        where: { action: 'ticket_pdf_export' }
      }),
      prisma.activityLog.count({
        where: { action: 'tickets_csv_export' }
      }),
      prisma.activityLog.count({
        where: {
          action: 'ticket_pdf_export',
          createdAt: { gte: thirtyDaysAgo }
        }
      }),
      prisma.activityLog.count({
        where: {
          action: 'tickets_csv_export',
          createdAt: { gte: thirtyDaysAgo }
        }
      })
    ]);

    const stats = {
      total: {
        pdfExports: totalPDFExports,
        csvExports: totalCSVExports,
        allExports: totalPDFExports + totalCSVExports
      },
      recent30Days: {
        pdfExports: recentPDFExports,
        csvExports: recentCSVExports,
        allExports: recentPDFExports + recentCSVExports
      }
    };

    return successResponse(
      res,
      stats,
      'Export statistics retrieved successfully'
    );

  } catch (error) {
    console.error('Export stats error:', error);
    return errorResponse(res, 'Failed to retrieve export statistics', 500);
  }
};

/**
 * Log export activity for tracking
 */
const logExportActivity = async (userId, exportType, details, ipAddress, userAgent) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action: exportType === 'PDF' ? 'ticket_pdf_export' : 'tickets_csv_export',
        details,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    console.error('Log export activity error:', error);
  }
};

module.exports = {
  exportTicketPDF,
  exportTicketsCSV,
  getExportHistory,
  getExportStats,
  logExportActivity
};