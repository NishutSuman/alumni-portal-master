// src/controllers/dashboard/RegistrationDashboardController.js
const { successResponse, errorResponse, paginatedResponse } = require('../../utils/response');
const RegistrationDashboardService = require('../../services/dashboard/RegistrationDashboardService');
const { prisma } = require('../../config/database');

/**
 * @desc    Get public registration dashboard
 * @route   GET /api/events/:eventId/registrations/public
 * @access  Public (No authentication required)
 */
const getPublicRegistrationDashboard = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists and is publicly viewable
    const event = await prisma.event.findFirst({
      where: { 
        id: eventId,
        status: { in: ['PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED'] }
      },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found or not publicly available', 404);
    }

    // Get public dashboard
    const dashboard = await RegistrationDashboardService.getPublicRegistrationDashboard(eventId);

    return successResponse(res, dashboard, 'Public registration dashboard retrieved successfully');

  } catch (error) {
    console.error('Public registration dashboard error:', error);
    
    if (error.message === 'Public dashboard is disabled for this event') {
      return errorResponse(res, 'Public registration view is not available for this event', 403);
    }
    
    return errorResponse(res, 'Failed to retrieve public registration dashboard', 500);
  }
};

/**
 * @desc    Get admin registration dashboard
 * @route   GET /api/events/:eventId/registrations/admin
 * @access  Private (SUPER_ADMIN)
 */
const getAdminRegistrationDashboard = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'registrationDate', 
      sortOrder = 'desc',
      search,
      batch,
      status = 'CONFIRMED'
    } = req.query;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Get admin dashboard
    const dashboard = await RegistrationDashboardService.getAdminRegistrationDashboard(eventId, {
      page, limit, sortBy, sortOrder, search, batch, status
    });

    // Log admin activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'view_admin_registration_dashboard',
        details: {
          eventId,
          eventTitle: event.title,
          filters: { search, batch, status },
          page: parseInt(page)
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, dashboard, 'Admin registration dashboard retrieved successfully');

  } catch (error) {
    console.error('Admin registration dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve admin registration dashboard', 500);
  }
};

/**
 * @desc    Get batch-wise registration breakdown
 * @route   GET /api/events/:eventId/registrations/batch-wise
 * @access  Private (SUPER_ADMIN)
 */
const getBatchWiseRegistrations = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Get batch-wise data
    const batchData = await RegistrationDashboardService.getBatchWiseRegistrations(eventId);

    // Log admin activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'view_batch_registrations',
        details: {
          eventId,
          eventTitle: event.title,
          batchCount: batchData.batchCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, batchData, 'Batch-wise registration data retrieved successfully');

  } catch (error) {
    console.error('Batch-wise registrations error:', error);
    return errorResponse(res, 'Failed to retrieve batch-wise registration data', 500);
  }
};

/**
 * @desc    Get privacy settings for an event
 * @route   GET /api/events/:eventId/privacy-settings
 * @access  Private (SUPER_ADMIN)
 */
const getPrivacySettings = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Get privacy settings
    const settings = await RegistrationDashboardService.getPrivacySettings(eventId);

    return successResponse(res, {
      eventId,
      eventTitle: event.title,
      settings
    }, 'Privacy settings retrieved successfully');

  } catch (error) {
    console.error('Get privacy settings error:', error);
    return errorResponse(res, 'Failed to retrieve privacy settings', 500);
  }
};

/**
 * @desc    Update privacy settings for an event
 * @route   PUT /api/events/:eventId/privacy-settings
 * @access  Private (SUPER_ADMIN)
 */
const updatePrivacySettings = async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Update privacy settings
    const settings = await RegistrationDashboardService.updatePrivacySettings(eventId, updates);

    // Log admin activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'update_privacy_settings',
        details: {
          eventId,
          eventTitle: event.title,
          updatedFields: Object.keys(updates),
          updates
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      eventId,
      eventTitle: event.title,
      settings
    }, 'Privacy settings updated successfully');

  } catch (error) {
    console.error('Update privacy settings error:', error);
    return errorResponse(res, 'Failed to update privacy settings', 500);
  }
};

/**
 * @desc    Toggle payment amount visibility for public dashboard
 * @route   POST /api/events/:eventId/toggle-payment-visibility
 * @access  Private (SUPER_ADMIN)
 */
const togglePaymentVisibility = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { showPaymentAmounts, showDonationAmounts } = req.body;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Update only payment visibility settings
    const settings = await RegistrationDashboardService.updatePrivacySettings(eventId, {
      ...(showPaymentAmounts !== undefined && { showPaymentAmounts: Boolean(showPaymentAmounts) }),
      ...(showDonationAmounts !== undefined && { showDonationAmounts: Boolean(showDonationAmounts) })
    });

    // Log admin activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'toggle_payment_visibility',
        details: {
          eventId,
          eventTitle: event.title,
          showPaymentAmounts: settings.showPaymentAmounts,
          showDonationAmounts: settings.showDonationAmounts
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      eventId,
      eventTitle: event.title,
      paymentVisibility: {
        showPaymentAmounts: settings.showPaymentAmounts,
        showDonationAmounts: settings.showDonationAmounts
      }
    }, 'Payment visibility settings updated successfully');

  } catch (error) {
    console.error('Toggle payment visibility error:', error);
    return errorResponse(res, 'Failed to update payment visibility', 500);
  }
};

module.exports = {
  getPublicRegistrationDashboard,
  getAdminRegistrationDashboard,
  getBatchWiseRegistrations,
  getPrivacySettings,
  updatePrivacySettings,
  togglePaymentVisibility
};