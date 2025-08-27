// src/middleware/registrationMode.middleware.js
// Middleware to enforce batch collection registration mode logic

const BatchCollectionService = require('../services/batchCollection.service');
const { prisma } = require('../config/database');

/**
 * Check registration mode and enforce batch collection rules
 * This middleware should be applied to event registration routes
 */
const checkRegistrationMode = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;
    
    // Get user's batch year
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { batch: true, role: true }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const userBatchYear = user.batch;

    // Get registration mode for this user's batch
    const registrationMode = await BatchCollectionService.getRegistrationMode(eventId, userBatchYear);

    // Handle different registration modes
    switch (registrationMode.mode) {
      case 'INDIVIDUAL':
        // Normal individual registration allowed
        req.registrationMode = 'INDIVIDUAL';
        return next();

      case 'BATCH_AUTO_REGISTERED':
        // User already registered via batch payment
        const existingRegistration = await prisma.eventRegistration.findFirst({
          where: {
            eventId,
            userId
          },
          select: { 
            id: true, 
            registrationMode: true,
            status: true
          }
        });

        if (existingRegistration) {
          return res.status(400).json({
            success: false,
            message: 'You are already registered for this event via batch payment. You can modify your registration to add guests or update preferences.',
            registrationId: existingRegistration.id,
            registrationMode: existingRegistration.registrationMode,
            allowModification: true,
            modificationUrl: `/events/${eventId}/registration/${existingRegistration.id}/modify`
          });
        } else {
          // Something went wrong - should be registered but isn't
          return res.status(500).json({
            success: false,
            message: 'Registration error. Please contact support.',
            errorCode: 'BATCH_REGISTRATION_MISSING'
          });
        }

      case 'BATCH_PENDING':
        // Batch collection is active but not completed
        const progress = await BatchCollectionService.getBatchCollectionStatus(eventId, userBatchYear);
        
        return res.status(400).json({
          success: false,
          message: 'Batch collection mode is active for your batch. Individual registration is not allowed.',
          batchProgress: {
            targetAmount: progress.targetAmount,
            collectedAmount: progress.collectedAmount,
            progressPercentage: progress.progressPercentage,
            remainingAmount: progress.remainingAmount,
            isTargetMet: progress.isTargetMet,
            batchYear: userBatchYear
          },
          suggestion: user.role === 'BATCH_ADMIN' 
            ? 'As a batch admin, you can contribute to the batch collection.'
            : 'Please wait for your batch admins to complete the collection, or contact them for updates.',
          batchAdminAction: user.role === 'BATCH_ADMIN',
          paymentUrl: user.role === 'BATCH_ADMIN' ? `/events/${eventId}/batch-collections/${userBatchYear}/pay` : null,
          progressUrl: `/events/${eventId}/batch-progress/${userBatchYear}`
        });

      default:
        return res.status(400).json({
          success: false,
          message: 'Registration not available for this event',
          reason: registrationMode.reason
        });
    }

  } catch (error) {
    console.error('Check registration mode error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to determine registration mode'
    });
  }
};

/**
 * Allow registration modification for batch-registered users
 * This middleware allows users to modify their auto-created registrations
 */
const allowBatchRegistrationModification = async (req, res, next) => {
  try {
    const { eventId, registrationId } = req.params;
    const userId = req.user.id;

    // Get registration details
    const registration = await prisma.eventRegistration.findFirst({
      where: {
        id: registrationId,
        eventId,
        userId
      },
      select: {
        id: true,
        registrationMode: true,
        status: true,
        formResponses: true
      }
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    if (registration.registrationMode !== 'BATCH_AUTO_REGISTERED') {
      // Normal registration, use standard validation
      return next();
    }

    // For batch-registered users, allow modifications
    req.batchRegistrationModification = true;
    req.existingRegistration = registration;
    return next();

  } catch (error) {
    console.error('Allow batch registration modification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate registration modification'
    });
  }
};

/**
 * Get registration status for user's batch
 * Helper middleware to add registration context to requests
 */
const addRegistrationContext = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Get user batch
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { batch: true, role: true }
    });

    if (!user) {
      return next();
    }

    // Get registration mode and status
    const [registrationMode, batchStatus, existingRegistration] = await Promise.all([
      BatchCollectionService.getRegistrationMode(eventId, user.batch),
      BatchCollectionService.getBatchCollectionStatus(eventId, user.batch),
      prisma.eventRegistration.findFirst({
        where: { eventId, userId },
        select: { id: true, status: true, registrationMode: true }
      })
    ]);

    // Add context to request
    req.registrationContext = {
      userBatch: user.batch,
      userRole: user.role,
      registrationMode: registrationMode.mode,
      batchStatus,
      existingRegistration,
      canRegister: registrationMode.mode === 'INDIVIDUAL',
      canModify: registrationMode.mode === 'BATCH_AUTO_REGISTERED' && existingRegistration,
      canContribute: user.role === 'BATCH_ADMIN' && registrationMode.mode === 'BATCH_PENDING'
    };

    next();

  } catch (error) {
    console.error('Add registration context error:', error);
    next(); // Continue without context if there's an error
  }
};

/**
 * Prevent duplicate individual registrations when batch collection exists
 */
const preventDuplicateRegistration = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check for existing registration
    const existingRegistration = await prisma.eventRegistration.findFirst({
      where: {
        eventId,
        userId
      },
      select: {
        id: true,
        registrationMode: true,
        status: true
      }
    });

    if (existingRegistration) {
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this event',
        existingRegistration: {
          id: existingRegistration.id,
          mode: existingRegistration.registrationMode,
          status: existingRegistration.status
        },
        suggestion: 'Use the modify registration endpoint to update your details'
      });
    }

    next();

  } catch (error) {
    console.error('Prevent duplicate registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check for duplicate registration'
    });
  }
};

/**
 * Check if event supports the requested registration mode
 */
const validateEventRegistrationMode = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { 
        defaultRegistrationMode: true,
        registrationStartsAt: true,
        registrationEndsAt: true,
        status: true
      }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const now = new Date();

    // Check event status
    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: 'Event registration is not open'
      });
    }

    // Check registration period
    if (event.registrationStartsAt && now < new Date(event.registrationStartsAt)) {
      return res.status(400).json({
        success: false,
        message: 'Registration has not started yet',
        startsAt: event.registrationStartsAt
      });
    }

    if (event.registrationEndsAt && now > new Date(event.registrationEndsAt)) {
      return res.status(400).json({
        success: false,
        message: 'Registration period has ended',
        endedAt: event.registrationEndsAt
      });
    }

    req.event = event;
    next();

  } catch (error) {
    console.error('Validate event registration mode error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate event registration'
    });
  }
};

module.exports = {
  checkRegistrationMode,
  allowBatchRegistrationModification,
  addRegistrationContext,
  preventDuplicateRegistration,
  validateEventRegistrationMode
};

// =============================================
// INTEGRATION INSTRUCTIONS:
// =============================================
/*

Apply these middleware to your existing event registration routes:

1. For new registrations:
app.post('/api/events/:eventId/register', [
  authenticateToken,
  validateEventRegistrationMode,
  checkRegistrationMode,  // <- Add this
  preventDuplicateRegistration,  // <- Add this
  // ... existing validation middleware
], eventRegistrationController.registerForEvent);

2. For registration modifications:
app.put('/api/events/:eventId/registrations/:registrationId', [
  authenticateToken,
  allowBatchRegistrationModification,  // <- Add this
  // ... existing validation middleware
], eventRegistrationController.updateRegistration);

3. For registration status pages:
app.get('/api/events/:eventId/registration-status', [
  authenticateToken,
  addRegistrationContext,  // <- Add this
], eventRegistrationController.getRegistrationStatus);

*/