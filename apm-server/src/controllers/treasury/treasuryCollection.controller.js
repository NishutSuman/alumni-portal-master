// src/controllers/treasury/treasuryCollection.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams } = require('../../utils/response');

// ============================================
// MANUAL COLLECTION MANAGEMENT
// ============================================

/**
 * Get all manual collections with filters and pagination
 * GET /api/treasury/manual-collections
 * Access: Public (Read-only for transparency)
 */
const getManualCollections = async (req, res) => {
  try {
    const {
      page,
      limit,
      collectionMode,
      category,
      eventId,
      dateFrom,
      dateTo,
      isVerified,
      search,
      sortBy = 'collectionDate',
      sortOrder = 'desc'
    } = req.query;

    const { skip, take } = getPaginationParams(page, limit);

    // Build filters
    const whereClause = {};

    if (collectionMode) whereClause.collectionMode = collectionMode;
    if (category) whereClause.category = category;
    if (eventId) whereClause.linkedEventId = eventId;
    if (isVerified !== undefined) whereClause.isVerified = isVerified === 'true';

    // Date range filter
    if (dateFrom || dateTo) {
      whereClause.collectionDate = {};
      if (dateFrom) whereClause.collectionDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.collectionDate.lte = new Date(dateTo);
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { donorName: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Valid sort fields
    const validSortFields = ['collectionDate', 'amount', 'createdAt', 'updatedAt'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'collectionDate';
    const finalSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [collections, totalCount] = await Promise.all([
      prisma.manualCollection.findMany({
        where: whereClause,
        include: {
          linkedEvent: {
            select: { id: true, title: true, eventDate: true }
          },
          creator: {
            select: { id: true, fullName: true }
          },
          verifier: {
            select: { id: true, fullName: true }
          }
        },
        skip,
        take,
        orderBy: { [finalSortBy]: finalSortOrder }
      }),
      prisma.manualCollection.count({ where: whereClause })
    ]);

    const formattedCollections = collections.map(collection => ({
      id: collection.id,
      amount: collection.amount,
      description: collection.description,
      collectionDate: collection.collectionDate,
      collectionMode: collection.collectionMode,
      category: collection.category,
      donorName: collection.donorName,
      donorContact: collection.donorContact,
      receiptUrl: collection.receiptUrl,
      isVerified: collection.isVerified,
      verifiedAt: collection.verifiedAt,
      linkedEvent: collection.linkedEvent,
      creator: collection.creator,
      verifier: collection.verifier,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt
    }));

    // Calculate total amount for current filters
    const totalAmount = await prisma.manualCollection.aggregate({
      where: whereClause,
      _sum: { amount: true }
    });

    // Get collection mode breakdown
    const modeBreakdown = await prisma.manualCollection.groupBy({
      by: ['collectionMode'],
      where: whereClause,
      _sum: { amount: true },
      _count: true
    });

    const responseData = {
      collections: formattedCollections,
      summary: {
        totalAmount: totalAmount._sum.amount || 0,
        totalCount,
        verifiedCount: collections.filter(c => c.isVerified).length,
        pendingCount: collections.filter(c => !c.isVerified).length,
        modeBreakdown: modeBreakdown.map(mode => ({
          mode: mode.collectionMode,
          count: mode._count,
          amount: mode._sum.amount || 0
        }))
      },
      filters: {
        collectionMode,
        category,
        eventId,
        dateFrom,
        dateTo,
        isVerified,
        search
      }
    };

    return paginatedResponse(res, responseData, totalCount, page, limit, 'Manual collections retrieved successfully');
  } catch (error) {
    console.error('Get manual collections error:', error);
    return errorResponse(res, 'Failed to retrieve manual collections', 500);
  }
};

/**
 * Get single manual collection with detailed information
 * GET /api/treasury/manual-collections/:collectionId
 * Access: Public (Read-only for transparency)
 */
const getManualCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await prisma.manualCollection.findUnique({
      where: { id: collectionId },
      include: {
        linkedEvent: {
          select: {
            id: true,
            title: true,
            eventDate: true,
            venue: true,
            eventMode: true
          }
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        },
        verifier: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      }
    });

    if (!collection) {
      return errorResponse(res, 'Manual collection not found', 404);
    }

    return successResponse(
      res,
      { collection },
      'Manual collection retrieved successfully'
    );
  } catch (error) {
    console.error('Get manual collection error:', error);
    return errorResponse(res, 'Failed to retrieve manual collection', 500);
  }
};

/**
 * Create new manual collection entry
 * POST /api/treasury/manual-collections
 * Access: SuperAdmin only
 */
const createManualCollection = async (req, res) => {
  try {
    const {
      amount,
      description,
      collectionDate,
      collectionMode,
      category,
      linkedEventId,
      donorName,
      donorContact
    } = req.body;

    const userId = req.user.id;

    // Verify event if provided
    if (linkedEventId) {
      const event = await prisma.event.findUnique({
        where: { id: linkedEventId },
        select: { id: true, title: true }
      });

      if (!event) {
        return errorResponse(res, 'Linked event not found', 404);
      }
    }

    const collection = await prisma.manualCollection.create({
      data: {
        amount,
        description: description.trim(),
        collectionDate: new Date(collectionDate),
        collectionMode,
        category: category?.trim(),
        linkedEventId,
        donorName: donorName?.trim(),
        donorContact: donorContact?.trim(),
        createdBy: userId,
        isVerified: true, // Auto-verify for SuperAdmin
        verifiedBy: userId,
        verifiedAt: new Date()
      },
      include: {
        linkedEvent: {
          select: { id: true, title: true }
        },
        creator: {
          select: { id: true, fullName: true }
        }
      }
    });

    return successResponse(
      res,
      {
        collection: {
          id: collection.id,
          amount: collection.amount,
          description: collection.description,
          collectionDate: collection.collectionDate,
          collectionMode: collection.collectionMode,
          category: collection.category,
          donorName: collection.donorName,
          donorContact: collection.donorContact,
          isVerified: collection.isVerified,
          linkedEvent: collection.linkedEvent,
          creator: collection.creator,
          createdAt: collection.createdAt
        }
      },
      'Manual collection created successfully',
      201
    );
  } catch (error) {
    console.error('Create manual collection error:', error);
    return errorResponse(res, 'Failed to create manual collection', 500);
  }
};

/**
 * Update manual collection entry
 * PUT /api/treasury/manual-collections/:collectionId
 * Access: SuperAdmin only
 */
const updateManualCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const {
      amount,
      description,
      collectionDate,
      collectionMode,
      category,
      linkedEventId,
      donorName,
      donorContact
    } = req.body;

    // Check if collection exists
    const existingCollection = await prisma.manualCollection.findUnique({
      where: { id: collectionId }
    });

    if (!existingCollection) {
      return errorResponse(res, 'Manual collection not found', 404);
    }

    // Prepare update data
    const updateData = {};
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description.trim();
    if (collectionDate !== undefined) updateData.collectionDate = new Date(collectionDate);
    if (collectionMode !== undefined) updateData.collectionMode = collectionMode;
    if (category !== undefined) updateData.category = category?.trim();
    if (donorName !== undefined) updateData.donorName = donorName?.trim();
    if (donorContact !== undefined) updateData.donorContact = donorContact?.trim();
    if (linkedEventId !== undefined) updateData.linkedEventId = linkedEventId;

    // Verify linked event if provided
    if (linkedEventId) {
      const event = await prisma.event.findUnique({
        where: { id: linkedEventId },
        select: { id: true }
      });

      if (!event) {
        return errorResponse(res, 'Linked event not found', 404);
      }
    }

    const updatedCollection = await prisma.manualCollection.update({
      where: { id: collectionId },
      data: updateData,
      include: {
        linkedEvent: {
          select: { id: true, title: true }
        },
        creator: {
          select: { id: true, fullName: true }
        },
        verifier: {
          select: { id: true, fullName: true }
        }
      }
    });

    return successResponse(
      res,
      { collection: updatedCollection },
      'Manual collection updated successfully'
    );
  } catch (error) {
    console.error('Update manual collection error:', error);
    return errorResponse(res, 'Failed to update manual collection', 500);
  }
};

/**
 * Delete manual collection entry
 * DELETE /api/treasury/manual-collections/:collectionId
 * Access: SuperAdmin only
 */
const deleteManualCollection = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await prisma.manualCollection.findUnique({
      where: { id: collectionId },
      select: {
        id: true,
        amount: true,
        description: true,
        collectionMode: true,
        receiptUrl: true
      }
    });

    if (!collection) {
      return errorResponse(res, 'Manual collection not found', 404);
    }

    // Delete associated receipt file if exists
    if (collection.receiptUrl) {
      // Receipt deletion will be handled by receipt management endpoints
      // For now, we'll keep the file but note this in audit
    }

    await prisma.manualCollection.delete({
      where: { id: collectionId }
    });

    return successResponse(
      res,
      {
        deletedCollection: {
          id: collection.id,
          amount: collection.amount,
          description: collection.description.substring(0, 100),
          collectionMode: collection.collectionMode,
          hadReceipt: !!collection.receiptUrl
        }
      },
      'Manual collection deleted successfully'
    );
  } catch (error) {
    console.error('Delete manual collection error:', error);
    return errorResponse(res, 'Failed to delete manual collection', 500);
  }
};

/**
 * Get collections by mode
 * GET /api/treasury/manual-collections/by-mode/:mode
 * Access: Public (Read-only for transparency)
 */
const getCollectionsByMode = async (req, res) => {
  try {
    const { mode } = req.params;
    const { page, limit, dateFrom, dateTo } = req.query;

    // Validate collection mode
    const validModes = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI_OFFLINE', 'OTHER'];
    if (!validModes.includes(mode)) {
      return errorResponse(res, 'Invalid collection mode', 400);
    }

    const { skip, take } = getPaginationParams(page, limit);

    // Build filters
    const whereClause = { collectionMode: mode };

    if (dateFrom || dateTo) {
      whereClause.collectionDate = {};
      if (dateFrom) whereClause.collectionDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.collectionDate.lte = new Date(dateTo);
    }

    const [collections, totalCount] = await Promise.all([
      prisma.manualCollection.findMany({
        where: whereClause,
        include: {
          linkedEvent: {
            select: { id: true, title: true }
          },
          creator: {
            select: { id: true, fullName: true }
          }
        },
        skip,
        take,
        orderBy: { collectionDate: 'desc' }
      }),
      prisma.manualCollection.count({ where: whereClause })
    ]);

    // Calculate total amount
    const totalAmount = await prisma.manualCollection.aggregate({
      where: whereClause,
      _sum: { amount: true }
    });

    const responseData = {
      collectionMode: mode,
      collections,
      summary: {
        totalAmount: totalAmount._sum.amount || 0,
        totalCount,
        averageAmount: totalCount > 0 ? (totalAmount._sum.amount || 0) / totalCount : 0
      }
    };

    return paginatedResponse(res, responseData, totalCount, page, limit, 'Collections by mode retrieved successfully');
  } catch (error) {
    console.error('Get collections by mode error:', error);
    return errorResponse(res, 'Failed to retrieve collections by mode', 500);
  }
};

/**
 * Get collections by category
 * GET /api/treasury/manual-collections/by-category/:category
 * Access: Public (Read-only for transparency)
 */
const getCollectionsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page, limit, dateFrom, dateTo } = req.query;

    const { skip, take } = getPaginationParams(page, limit);

    // Build filters
    const whereClause = { category };

    if (dateFrom || dateTo) {
      whereClause.collectionDate = {};
      if (dateFrom) whereClause.collectionDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.collectionDate.lte = new Date(dateTo);
    }

    const [collections, totalCount] = await Promise.all([
      prisma.manualCollection.findMany({
        where: whereClause,
        include: {
          linkedEvent: {
            select: { id: true, title: true }
          },
          creator: {
            select: { id: true, fullName: true }
          }
        },
        skip,
        take,
        orderBy: { collectionDate: 'desc' }
      }),
      prisma.manualCollection.count({ where: whereClause })
    ]);

    // Calculate total amount
    const totalAmount = await prisma.manualCollection.aggregate({
      where: whereClause,
      _sum: { amount: true }
    });

    const responseData = {
      category,
      collections,
      summary: {
        totalAmount: totalAmount._sum.amount || 0,
        totalCount,
        averageAmount: totalCount > 0 ? (totalAmount._sum.amount || 0) / totalCount : 0
      }
    };

    return paginatedResponse(res, responseData, totalCount, page, limit, 'Collections by category retrieved successfully');
  } catch (error) {
    console.error('Get collections by category error:', error);
    return errorResponse(res, 'Failed to retrieve collections by category', 500);
  }
};

/**
 * Get collection statistics
 * GET /api/treasury/manual-collections/statistics
 * Access: Public (Read-only for transparency)
 */
const getCollectionStatistics = async (req, res) => {
  try {
    const { year, dateFrom, dateTo } = req.query;

    // Build date filter
    let dateFilter = {};
    if (year) {
      dateFilter = {
        collectionDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        }
      };
    } else if (dateFrom || dateTo) {
      dateFilter.collectionDate = {};
      if (dateFrom) dateFilter.collectionDate.gte = new Date(dateFrom);
      if (dateTo) dateFilter.collectionDate.lte = new Date(dateTo);
    }

    const [
      overallStats,
      modeBreakdown,
      categoryBreakdown,
      monthlyTrends
    ] = await Promise.all([
      // Overall statistics
      prisma.manualCollection.aggregate({
        where: dateFilter,
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true }
      }),
      // Mode-wise breakdown
      prisma.manualCollection.groupBy({
        by: ['collectionMode'],
        where: dateFilter,
        _sum: { amount: true },
        _count: true
      }),
      // Category-wise breakdown
      prisma.manualCollection.groupBy({
        by: ['category'],
        where: dateFilter,
        _sum: { amount: true },
        _count: true
      }),
      // Monthly trends (if year specified)
      year ? prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM collection_date) as month,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM manual_collections 
        WHERE collection_date >= ${new Date(`${year}-01-01`)} 
          AND collection_date <= ${new Date(`${year}-12-31`)}
        GROUP BY EXTRACT(MONTH FROM collection_date)
        ORDER BY month
      ` : []
    ]);

    const statistics = {
      overall: {
        totalAmount: overallStats._sum.amount || 0,
        totalCount: overallStats._count,
        averageAmount: overallStats._avg.amount || 0
      },
      breakdown: {
        byMode: modeBreakdown.map(mode => ({
          mode: mode.collectionMode,
          count: mode._count,
          amount: mode._sum.amount || 0,
          percentage: overallStats._sum.amount > 0 
            ? ((mode._sum.amount || 0) / overallStats._sum.amount * 100) 
            : 0
        })),
        byCategory: categoryBreakdown
          .filter(cat => cat.category)
          .map(category => ({
            category: category.category,
            count: category._count,
            amount: category._sum.amount || 0,
            percentage: overallStats._sum.amount > 0 
              ? ((category._sum.amount || 0) / overallStats._sum.amount * 100) 
              : 0
          }))
      },
      trends: {
        monthly: monthlyTrends.map(month => ({
          month: parseInt(month.month),
          monthName: new Date(2024, month.month - 1).toLocaleString('default', { month: 'long' }),
          count: parseInt(month.count),
          amount: parseFloat(month.total_amount) || 0
        }))
      },
      filters: {
        year: year || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      },
      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { statistics },
      'Collection statistics retrieved successfully'
    );
  } catch (error) {
    console.error('Get collection statistics error:', error);
    return errorResponse(res, 'Failed to retrieve collection statistics', 500);
  }
};

module.exports = {
  getManualCollections,
  getManualCollection,
  createManualCollection,
  updateManualCollection,
  deleteManualCollection,
  getCollectionsByMode,
  getCollectionsByCategory,
  getCollectionStatistics
};