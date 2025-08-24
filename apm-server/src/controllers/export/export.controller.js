// src/controllers/export/ExportController.js
const { successResponse, errorResponse } = require('../../utils/response');
const ExportService = require('../../services/export/ExportService');
const { prisma } = require('../../config/database');

/**
 * @desc    Export complete event report
 * @route   GET /api/events/:eventId/export/complete-report
 * @access  Private (SUPER_ADMIN)
 */
const exportCompleteEventReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { format = 'csv' } = req.query;

    // Validate event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Generate report
    const reportData = await ExportService.exportCompleteEventReport(eventId, format);

    // Set appropriate headers for file download
    const fileName = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_complete_report.${format.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'}`;
    const contentType = format.toLowerCase() === 'xlsx' ? 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
      'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    });

    // Log export activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'export_complete_report',
        details: {
          eventId,
          eventTitle: event.title,
          format,
          fileName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    if (format.toLowerCase() === 'xlsx') {
      return res.send(reportData);
    } else {
      return res.send(reportData);
    }

  } catch (error) {
    console.error('Export complete report error:', error);
    return errorResponse(res, 'Failed to generate complete report', 500);
  }
};

/**
 * @desc    Export registration list
 * @route   GET /api/events/:eventId/export/registrations
 * @access  Private (SUPER_ADMIN)
 */
const exportRegistrationList = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { 
      format = 'csv', 
      includeGuests = 'true', 
      includeCustomFields = 'true',
      status = 'CONFIRMED' 
    } = req.query;

    // Validate event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Prepare options
    const options = {
      includeGuests: includeGuests === 'true',
      includeCustomFields: includeCustomFields === 'true',
      status: status === 'all' ? null : status
    };

    // Generate report
    const reportData = await ExportService.exportRegistrationList(eventId, format, options);

    // Set headers
    const fileName = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_registrations.${format.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'}`;
    const contentType = format.toLowerCase() === 'xlsx' ? 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
      'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    });

    // Log export activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'export_registrations',
        details: {
          eventId,
          eventTitle: event.title,
          format,
          options,
          fileName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return res.send(reportData);

  } catch (error) {
    console.error('Export registration list error:', error);
    return errorResponse(res, 'Failed to generate registration list', 500);
  }
};

/**
 * @desc    Export financial report
 * @route   GET /api/events/:eventId/export/financial-report
 * @access  Private (SUPER_ADMIN)
 */
const exportFinancialReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { format = 'csv' } = req.query;

    // Validate event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Generate report
    const reportData = await ExportService.exportFinancialReport(eventId, format);

    // Set headers
    const fileName = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_financial_report.${format.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'}`;
    const contentType = format.toLowerCase() === 'xlsx' ? 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
      'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    });

    // Log export activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'export_financial_report',
        details: {
          eventId,
          eventTitle: event.title,
          format,
          fileName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return res.send(reportData);

  } catch (error) {
    console.error('Export financial report error:', error);
    return errorResponse(res, 'Failed to generate financial report', 500);
  }
};

/**
 * @desc    Export attendance report
 * @route   GET /api/events/:eventId/export/attendance-report
 * @access  Private (SUPER_ADMIN)
 */
const exportAttendanceReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { format = 'csv' } = req.query;

    // Validate event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Generate report
    const reportData = await ExportService.exportAttendanceReport(eventId, format);

    // Set headers
    const fileName = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_attendance_report.${format.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'}`;
    const contentType = format.toLowerCase() === 'xlsx' ? 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
      'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    });

    // Log export activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'export_attendance_report',
        details: {
          eventId,
          eventTitle: event.title,
          format,
          fileName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return res.send(reportData);

  } catch (error) {
    console.error('Export attendance report error:', error);
    return errorResponse(res, 'Failed to generate attendance report', 500);
  }
};

/**
 * @desc    Export merchandise report
 * @route   GET /api/events/:eventId/export/merchandise-report
 * @access  Private (SUPER_ADMIN)
 */
const exportMerchandiseReport = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { format = 'csv' } = req.query;

    // Validate event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Generate report
    const reportData = await ExportService.exportMerchandiseReport(eventId, format);

    // Set headers
    const fileName = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}_merchandise_report.${format.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'}`;
    const contentType = format.toLowerCase() === 'xlsx' ? 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
      'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    });

    // Log export activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'export_merchandise_report',
        details: {
          eventId,
          eventTitle: event.title,
          format,
          fileName
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return res.send(reportData);

  } catch (error) {
    console.error('Export merchandise report error:', error);
    return errorResponse(res, 'Failed to generate merchandise report', 500);
  }
};

/**
 * @desc    Export batch-wise participation report
 * @route   GET /api/admin/events/batch-report/:batchYear
 * @access  Private (SUPER_ADMIN)
 */
const exportBatchReport = async (req, res) => {
  try {
    const { batchYear } = req.params;
    const { format = 'csv' } = req.query;

    // Validate batch year
    const year = parseInt(batchYear);
    if (isNaN(year) || year < 2000 || year > new Date().getFullYear() + 10) {
      return errorResponse(res, 'Invalid batch year', 400);
    }

    // Check if batch has any members
    const memberCount = await prisma.user.count({
      where: { batch: year, isActive: true }
    });

    if (memberCount === 0) {
      return errorResponse(res, 'No active members found for this batch', 404);
    }

    // Generate report
    const reportData = await ExportService.exportBatchReport(year, format);

    // Set headers
    const fileName = `Batch_${year}_participation_report.${format.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'}`;
    const contentType = format.toLowerCase() === 'xlsx' ? 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
      'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-cache'
    });

    // Log export activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'export_batch_report',
        details: {
          batchYear: year,
          format,
          fileName,
          memberCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return res.send(reportData);

  } catch (error) {
    console.error('Export batch report error:', error);
    return errorResponse(res, 'Failed to generate batch report', 500);
  }
};

module.exports = {
  exportCompleteEventReport,
  exportRegistrationList,
  exportFinancialReport,
  exportAttendanceReport,
  exportMerchandiseReport,
  exportBatchReport
};