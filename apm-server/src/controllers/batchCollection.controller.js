// src/controllers/eventControllers/batchCollection.controller.js
const BatchCollectionService = require('../services/batchCollection.service');
const MembershipService = require('../services/membership.service');
const PaymentService = require('../services/payment/PaymentService');
const { prisma } = require('../config/database');
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPaginationParams,
  calculatePagination
} = require('../utils/response');
const { CacheService } = require('../config/redis');

/**
 * Create batch collection for an event
 * POST /api/admin/events/:eventId/batch-collections/:batchYear
 * Access: SUPER_ADMIN only
 */
const createBatchCollection = async (req, res) => {
  try {
    const { eventId, batchYear } = req.params;
    const { targetAmount, description } = req.body;
    const createdBy = req.user.id;

    const batchCollection = await BatchCollectionService.createBatchCollection(
      eventId,
      parseInt(batchYear),
      targetAmount,
      description,
      createdBy
    );

    return successResponse(res, {
      batchCollection
    }, `Batch collection created successfully for batch ${batchYear}`);

  } catch (error) {
    console.error('Create batch collection error:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('not found') || error.message.includes('No active batch admins')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return errorResponse(res, 'Failed to create batch collection', 500);
  }
};

/**
 * Get batch collection status and progress
 * GET /api/events/:eventId/batch-collections/:batchYear/status
 * Access: Authenticated users
 */
const getBatchCollectionStatus = async (req, res) => {
  try {
    const { eventId, batchYear } = req.params;
    
    const status = await BatchCollectionService.getBatchCollectionStatus(
      eventId, 
      parseInt(batchYear)
    );

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Batch collection not found for this event and batch',
        eventId,
        batchYear: parseInt(batchYear)
      });
    }

    return successResponse(res, {
      status
    }, 'Batch collection status retrieved successfully');

  } catch (error) {
    console.error('Get batch collection status error:', error);
    return errorResponse(res, 'Failed to retrieve batch collection status', 500);
  }
};

/**
 * Initiate batch admin payment
 * POST /api/events/:eventId/batch-collections/:batchYear/pay
 * Access: BATCH_ADMIN for the specific batch
 */
const initiateBatchAdminPayment = async (req, res) => {
  try {
    const { eventId, batchYear } = req.params;
    const { amount, notes } = req.body;
    const adminId = req.user.id;

    // Verify user is batch admin for this batch
    const isAuthorized = await MembershipService.isBatchAdmin(adminId, parseInt(batchYear));
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized as batch admin for this batch'
      });
    }

    // Get batch collection details
    const collectionStatus = await BatchCollectionService.getBatchCollectionStatus(
      eventId, 
      parseInt(batchYear)
    );

    if (!collectionStatus) {
      return res.status(404).json({
        success: false,
        message: 'Batch collection not found'
      });
    }

    if (collectionStatus.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Batch collection is not accepting payments'
      });
    }

    if (collectionStatus.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Batch collection is already completed and approved'
      });
    }

    // Validate payment amount
    const remainingAmount = collectionStatus.remainingAmount;
    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (₹${amount}) exceeds remaining target (₹${remainingAmount})`,
        maxAmount: remainingAmount
      });
    }

    // Create payment transaction
    const paymentData = {
      userId: adminId,
      referenceType: 'BATCH_ADMIN_PAYMENT',
      referenceId: collectionStatus.id,
      amount: amount,
      description: `Batch collection payment - ${collectionStatus.event.title} (Batch ${batchYear})`,
      metadata: {
        eventId,
        batchYear: parseInt(batchYear),
        batchCollectionId: collectionStatus.id,
        eventTitle: collectionStatus.event.title,
        notes
      }
    };

    const transaction = await PaymentService.initiatePayment(paymentData);

    return successResponse(res, {
      transaction,
      batchCollection: {
        id: collectionStatus.id,
        eventTitle: collectionStatus.event.title,
        targetAmount: collectionStatus.targetAmount,
        collectedAmount: collectionStatus.collectedAmount,
        remainingAmount: remainingAmount - amount // Expected remaining after this payment
      },
      paymentAmount: amount
    }, 'Batch admin payment initiated successfully');

  } catch (error) {
    console.error('Initiate batch admin payment error:', error);
    return errorResponse(res, 'Failed to initiate batch admin payment', 500);
  }
};

/**
 * Get all payments for a batch collection
 * GET /api/events/:eventId/batch-collections/:batchYear/payments
 * Access: BATCH_ADMIN for the batch or SUPER_ADMIN
 */
const getBatchCollectionPayments = async (req, res) => {
  try {
    const { eventId, batchYear } = req.params;
    const { page, limit, skip } = getPaginationParams(req.query, 20);

    // Check access - either batch admin for this batch or super admin
    const userRole = req.user.role;
    if (userRole !== 'SUPER_ADMIN') {
      const isAuthorized = await MembershipService.isBatchAdmin(req.user.id, parseInt(batchYear));
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get batch collection
    const collection = await prisma.batchEventCollection.findUnique({
      where: {
        eventId_batchYear: { eventId, batchYear: parseInt(batchYear) }
      }
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Batch collection not found'
      });
    }

    // Get payments with pagination
    const [total, payments] = await Promise.all([
      prisma.batchAdminPayment.count({
        where: { batchCollectionId: collection.id }
      }),
      prisma.batchAdminPayment.findMany({
        where: { batchCollectionId: collection.id },
        include: {
          admin: {
            select: { 
              id: true, 
              fullName: true, 
              email: true,
              profileImage: true
            }
          },
          paymentTransaction: {
            select: {
              id: true,
              transactionNumber: true,
              razorpayOrderId: true,
              razorpayPaymentId: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(res, payments, pagination, 'Batch collection payments retrieved successfully');

  } catch (error) {
    console.error('Get batch collection payments error:', error);
    return errorResponse(res, 'Failed to retrieve batch collection payments', 500);
  }
};

/**
 * Get all batch collections for an event (admin view)
 * GET /api/admin/events/:eventId/batch-collections
 * Access: SUPER_ADMIN only
 */
const getEventBatchCollections = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, slug: true }
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const collections = await BatchCollectionService.getEventBatchCollections(eventId);

    return successResponse(res, {
      event,
      collections,
      totalCollections: collections.length,
      activeCollections: collections.filter(c => c.status === 'ACTIVE').length,
      completedCollections: collections.filter(c => c.isApproved).length
    }, 'Event batch collections retrieved successfully');

  } catch (error) {
    console.error('Get event batch collections error:', error);
    return errorResponse(res, 'Failed to retrieve event batch collections', 500);
  }
};

/**
 * Approve batch collection and trigger bulk registration
 * POST /api/admin/events/:eventId/batch-collections/:batchYear/approve
 * Access: SUPER_ADMIN only
 */
const approveBatchCollection = async (req, res) => {
  try {
    const { eventId, batchYear } = req.params;
    const { reason } = req.body;
    const approvedBy = req.user.id;

    // Get batch collection
    const collection = await prisma.batchEventCollection.findUnique({
      where: {
        eventId_batchYear: { eventId, batchYear: parseInt(batchYear) }
      },
      include: {
        event: { select: { title: true } },
        batch: { select: { name: true } }
      }
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Batch collection not found'
      });
    }

    const result = await BatchCollectionService.approveBatchCollection(
      collection.id,
      approvedBy
    );

    // Send confirmation emails to batch members
    // This would be implemented with email templates
    console.log(`📧 Batch registration approved: ${result.registeredCount} members registered`);

    return successResponse(res, {
      collection: result.collection,
      bulkRegistration: {
        registeredCount: result.registeredCount,
        totalMembers: result.totalMembers,
        skippedCount: result.totalMembers - result.registeredCount
      },
      approvedBy: req.user.fullName,
      approvalReason: reason
    }, `Batch collection approved successfully. ${result.registeredCount} members have been registered.`);

  } catch (error) {
    console.error('Approve batch collection error:', error);
    
    if (error.message.includes('target amount not met')) {
      return res.status(400).json({
        success: false,
        message: 'Cannot approve - target amount not yet met'
      });
    }

    if (error.message.includes('already approved')) {
      return res.status(409).json({
        success: false,
        message: 'Batch collection is already approved'
      });
    }

    return errorResponse(res, 'Failed to approve batch collection', 500);
  }
};

/**
 * Reject batch collection
 * POST /api/admin/events/:eventId/batch-collections/:batchYear/reject
 * Access: SUPER_ADMIN only
 */
const rejectBatchCollection = async (req, res) => {
  try {
    const { eventId, batchYear } = req.params;
    const { reason } = req.body;
    const rejectedBy = req.user.id;

    const collection = await prisma.batchEventCollection.findUnique({
      where: {
        eventId_batchYear: { eventId, batchYear: parseInt(batchYear) }
      }
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Batch collection not found'
      });
    }

    if (collection.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an already approved collection'
      });
    }

    // Update collection status
    const rejectedCollection = await prisma.batchEventCollection.update({
      where: { id: collection.id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });

    // Log rejection
    await prisma.activityLog.create({
      data: {
        userId: rejectedBy,
        action: 'batch_collection_rejected',
        details: {
          batchCollectionId: collection.id,
          eventId,
          batchYear: parseInt(batchYear),
          reason: reason || 'No reason provided',
          collectedAmount: collection.collectedAmount.toString(),
          targetAmount: collection.targetAmount.toString()
        }
      }
    });

    // Clear caches
    await BatchCollectionService.clearBatchCollectionCaches(eventId, parseInt(batchYear));

    return successResponse(res, {
      collection: rejectedCollection,
      rejectedBy: req.user.fullName,
      rejectionReason: reason
    }, 'Batch collection rejected successfully');

  } catch (error) {
    console.error('Reject batch collection error:', error);
    return errorResponse(res, 'Failed to reject batch collection', 500);
  }
};

/**
 * Get batch collection progress for public viewing
 * GET /api/events/:eventId/batch-collections/:batchYear/progress
 * Access: Public (no auth required)
 */
const getBatchCollectionProgress = async (req, res) => {
  try {
    const { eventId, batchYear } = req.params;

    const status = await BatchCollectionService.getBatchCollectionStatus(
      eventId,
      parseInt(batchYear)
    );

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Batch collection not found'
      });
    }

    // Return limited public information
    const publicProgress = {
      eventTitle: status.event.title,
      batchName: status.batch.name,
      targetAmount: status.targetAmount,
      collectedAmount: status.collectedAmount,
      progressPercentage: status.progressPercentage,
      isTargetMet: status.isTargetMet,
      isApproved: status.isApproved,
      status: status.status,
      paymentCount: status.paymentCount,
      description: status.description
    };

    return successResponse(res, {
      progress: publicProgress
    }, 'Batch collection progress retrieved successfully');

  } catch (error) {
    console.error('Get batch collection progress error:', error);
    return errorResponse(res, 'Failed to retrieve batch collection progress', 500);
  }
};

module.exports = {
  createBatchCollection,
  getBatchCollectionStatus,
  initiateBatchAdminPayment,
  getBatchCollectionPayments,
  getEventBatchCollections,
  approveBatchCollection,
  rejectBatchCollection,
  getBatchCollectionProgress
};