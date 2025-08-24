// src/controllers/qr/QRCodeController.js
const { successResponse, errorResponse } = require('../../utils/response');
const QRCodeService = require('../../services/qr/QRCodeService');
const CheckInService = require('../../services/qr/CheckInService');
const { prisma } = require('../../config/database');

/**
 * @desc    Generate QR code for user's registration
 * @route   GET /api/events/:eventId/my-registration/qr-code
 * @access  Private (User)
 */
const generateMyQRCode = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Get user's registration
    const registration = await prisma.eventRegistration.findFirst({
      where: {
        eventId,
        userId,
        status: 'CONFIRMED'
      }
    });

    if (!registration) {
      return errorResponse(res, 'Registration not found or not confirmed', 404);
    }

    // Generate QR code
    const qrResult = await QRCodeService.generateQRCode(registration.id);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'qr_code_generated',
        details: {
          eventId,
          registrationId: registration.id,
          isNew: qrResult.isNew
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      qrCode: qrResult.qrCode,
      qrImageUrl: qrResult.qrImageUrl,
      generatedAt: qrResult.generatedAt,
      isNew: qrResult.isNew,
      eventTitle: qrResult.qrData.event.title,
      registrationSummary: qrResult.qrData.summary
    }, qrResult.isNew ? 'QR code generated successfully' : 'QR code retrieved successfully');

  } catch (error) {
    console.error('Generate QR code error:', error);
    return errorResponse(res, 'Failed to generate QR code', 500);
  }
};

/**
 * @desc    Admin: Generate QR code for any registration
 * @route   POST /api/admin/events/:eventId/registrations/:registrationId/qr-code
 * @access  Private (SUPER_ADMIN)
 */
const generateRegistrationQRCode = async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;

    // Verify registration belongs to event
    const registration = await prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        eventId,
        status: 'CONFIRMED'
      }
    });

    if (!registration) {
      return errorResponse(res, 'Registration not found', 404);
    }

    // Generate QR code
    const qrResult = await QRCodeService.generateQRCode(registrationId);

    // Log admin activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'admin_qr_code_generated',
        details: {
          eventId,
          registrationId,
          targetUserId: registration.userId,
          isNew: qrResult.isNew
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, qrResult, 'QR code generated successfully');

  } catch (error) {
    console.error('Admin generate QR code error:', error);
    return errorResponse(res, 'Failed to generate QR code', 500);
  }
};

/**
 * @desc    Process check-in via QR code scan
 * @route   POST /api/events/:eventId/check-in
 * @access  Private (SUPER_ADMIN or EVENT_STAFF)
 */
const processCheckIn = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { qrCode, guestsCheckedIn, checkInLocation, notes, guestDetails } = req.body;

    if (!qrCode) {
      return errorResponse(res, 'QR code is required', 400);
    }

    // Process check-in
    const result = await CheckInService.processCheckIn(
      qrCode,
      { guestsCheckedIn, checkInLocation, notes, guestDetails },
      req.user.id
    );

    if (!result.success) {
      return errorResponse(res, result.error, result.isAlreadyCheckedIn ? 409 : 400);
    }

    return successResponse(res, {
      checkIn: {
        id: result.checkIn.id,
        checkedInAt: result.checkIn.checkedInAt,
        guestsCheckedIn: result.checkIn.guestsCheckedIn,
        totalGuests: result.checkIn.totalGuests,
        checkInLocation: result.checkIn.checkInLocation
      },
      user: result.qrData.user,
      event: result.qrData.event,
      summary: result.qrData.summary
    }, 'Check-in processed successfully');

  } catch (error) {
    console.error('Check-in processing error:', error);
    return errorResponse(res, error.message || 'Failed to process check-in', 500);
  }
};

/**
 * @desc    Get check-in statistics for an event
 * @route   GET /api/events/:eventId/check-in-stats
 * @access  Private (SUPER_ADMIN)
 */
const getCheckInStats = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, eventDate: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    const stats = await CheckInService.getEventCheckInStats(eventId);

    return successResponse(res, {
      event: {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate
      },
      stats
    }, 'Check-in statistics retrieved successfully');

  } catch (error) {
    console.error('Check-in stats error:', error);
    return errorResponse(res, 'Failed to retrieve check-in statistics', 500);
  }
};

/**
 * @desc    Get real-time check-in count
 * @route   GET /api/events/:eventId/live-checkin-count
 * @access  Private (SUPER_ADMIN)
 */
const getLiveCheckInCount = async (req, res) => {
  try {
    const { eventId } = req.params;

    const liveData = await CheckInService.getLiveCheckInCount(eventId);

    return successResponse(res, liveData, 'Live check-in count retrieved');

  } catch (error) {
    console.error('Live check-in count error:', error);
    return errorResponse(res, 'Failed to retrieve live count', 500);
  }
};

/**
 * @desc    Get check-in history for an event
 * @route   GET /api/events/:eventId/check-in-history
 * @access  Private (SUPER_ADMIN)
 */
const getCheckInHistory = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const history = await CheckInService.getCheckInHistory(
      eventId,
      parseInt(page),
      parseInt(limit)
    );

    return successResponse(res, history, 'Check-in history retrieved successfully');

  } catch (error) {
    console.error('Check-in history error:', error);
    return errorResponse(res, 'Failed to retrieve check-in history', 500);
  }
};

module.exports = {
  generateMyQRCode,
  generateRegistrationQRCode,
  processCheckIn,
  getCheckInStats,
  getLiveCheckInCount,
  getCheckInHistory
};