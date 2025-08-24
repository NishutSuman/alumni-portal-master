// src/controllers/treasury/treasuryBalance.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================
// YEARLY BALANCE MANAGEMENT
// ============================================

/**
 * Get all yearly balances
 * GET /api/treasury/yearly-balance
 * Access: Public (Read-only for transparency)
 */
const getYearlyBalances = async (req, res) => {
  try {
    const yearlyBalances = await prisma.yearlyBalance.findMany({
      include: {
        creator: {
          select: { id: true, fullName: true }
        }
      },
      orderBy: { year: 'desc' }
    });

    const formattedBalances = yearlyBalances.map(balance => ({
      id: balance.id,
      year: balance.year,
      openingBalance: balance.openingBalance,
      closingBalance: balance.closingBalance,
      notes: balance.notes,
      creator: balance.creator,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt
    }));

    return successResponse(
      res,
      {
        yearlyBalances: formattedBalances,
        summary: {
          totalYears: yearlyBalances.length,
          latestYear: yearlyBalances.length > 0 ? yearlyBalances[0].year : null,
          oldestYear: yearlyBalances.length > 0 ? yearlyBalances[yearlyBalances.length - 1].year : null
        }
      },
      'Yearly balances retrieved successfully'
    );
  } catch (error) {
    console.error('Get yearly balances error:', error);
    return errorResponse(res, 'Failed to retrieve yearly balances', 500);
  }
};

/**
 * Get yearly balance for specific year
 * GET /api/treasury/yearly-balance/:year
 * Access: Public (Read-only for transparency)
 */
const getYearlyBalance = async (req, res) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year);

    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2050) {
      return errorResponse(res, 'Invalid year parameter', 400);
    }

    const yearlyBalance = await prisma.yearlyBalance.findUnique({
      where: { year: yearInt },
      include: {
        creator: {
          select: { id: true, fullName: true, role: true }
        }
      }
    });

    if (!yearlyBalance) {
      return errorResponse(res, 'Yearly balance not found for this year', 404);
    }

    // Get financial summary for this year
    const [expenseStats, collectionStats] = await Promise.all([
      prisma.expense.aggregate({
        where: {
          expenseDate: {
            gte: new Date(`${yearInt}-01-01`),
            lte: new Date(`${yearInt}-12-31`)
          }
        },
        _sum: { amount: true },
        _count: true
      }),
      prisma.manualCollection.aggregate({
        where: {
          collectionDate: {
            gte: new Date(`${yearInt}-01-01`),
            lte: new Date(`${yearInt}-12-31`)
          }
        },
        _sum: { amount: true },
        _count: true
      })
    ]);

    // Calculate theoretical closing balance
    const totalExpenses = expenseStats._sum.amount || 0;
    const totalCollections = collectionStats._sum.amount || 0;
    const theoreticalClosing = parseFloat(yearlyBalance.openingBalance) + totalCollections - totalExpenses;

    const responseData = {
      yearlyBalance: {
        id: yearlyBalance.id,
        year: yearlyBalance.year,
        openingBalance: yearlyBalance.openingBalance,
        closingBalance: yearlyBalance.closingBalance,
        notes: yearlyBalance.notes,
        creator: yearlyBalance.creator,
        createdAt: yearlyBalance.createdAt,
        updatedAt: yearlyBalance.updatedAt
      },
      yearSummary: {
        totalExpenses,
        expenseCount: expenseStats._count,
        totalCollections,
        collectionCount: collectionStats._count,
        netMovement: totalCollections - totalExpenses,
        theoreticalClosingBalance: theoreticalClosing,
        closingBalanceSet: !!yearlyBalance.closingBalance,
        balanceDifference: yearlyBalance.closingBalance 
          ? parseFloat(yearlyBalance.closingBalance) - theoreticalClosing 
          : null
      }
    };

    return successResponse(
      res,
      responseData,
      'Yearly balance retrieved successfully'
    );
  } catch (error) {
    console.error('Get yearly balance error:', error);
    return errorResponse(res, 'Failed to retrieve yearly balance', 500);
  }
};

/**
 * Create yearly balance
 * POST /api/treasury/yearly-balance
 * Access: SuperAdmin only
 */
const createYearlyBalance = async (req, res) => {
  try {
    const { year, openingBalance, notes } = req.body;
    const userId = req.user.id;

    // Check if year already exists
    const existingBalance = await prisma.yearlyBalance.findUnique({
      where: { year }
    });

    if (existingBalance) {
      return errorResponse(res, 'Yearly balance already exists for this year', 400);
    }

    const yearlyBalance = await prisma.yearlyBalance.create({
      data: {
        year,
        openingBalance,
        notes: notes?.trim(),
        createdBy: userId
      },
      include: {
        creator: {
          select: { id: true, fullName: true }
        }
      }
    });

    return successResponse(
      res,
      {
        yearlyBalance: {
          id: yearlyBalance.id,
          year: yearlyBalance.year,
          openingBalance: yearlyBalance.openingBalance,
          closingBalance: yearlyBalance.closingBalance,
          notes: yearlyBalance.notes,
          creator: yearlyBalance.creator,
          createdAt: yearlyBalance.createdAt,
          updatedAt: yearlyBalance.updatedAt
        }
      },
      'Yearly balance created successfully',
      201
    );
  } catch (error) {
    console.error('Create yearly balance error:', error);
    return errorResponse(res, 'Failed to create yearly balance', 500);
  }
};

/**
 * Update yearly balance
 * PUT /api/treasury/yearly-balance/:year
 * Access: SuperAdmin only
 */
const updateYearlyBalance = async (req, res) => {
  try {
    const { year } = req.params;
    const { openingBalance, closingBalance, notes } = req.body;
    const yearInt = parseInt(year);

    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2050) {
      return errorResponse(res, 'Invalid year parameter', 400);
    }

    const existingBalance = await prisma.yearlyBalance.findUnique({
      where: { year: yearInt }
    });

    if (!existingBalance) {
      return errorResponse(res, 'Yearly balance not found for this year', 404);
    }

    // Prepare update data
    const updateData = {};
    if (openingBalance !== undefined) updateData.openingBalance = openingBalance;
    if (closingBalance !== undefined) updateData.closingBalance = closingBalance;
    if (notes !== undefined) updateData.notes = notes?.trim();

    const updatedBalance = await prisma.yearlyBalance.update({
      where: { year: yearInt },
      data: updateData,
      include: {
        creator: {
          select: { id: true, fullName: true }
        }
      }
    });

    return successResponse(
      res,
      {
        yearlyBalance: {
          id: updatedBalance.id,
          year: updatedBalance.year,
          openingBalance: updatedBalance.openingBalance,
          closingBalance: updatedBalance.closingBalance,
          notes: updatedBalance.notes,
          creator: updatedBalance.creator,
          createdAt: updatedBalance.createdAt,
          updatedAt: updatedBalance.updatedAt
        }
      },
      'Yearly balance updated successfully'
    );
  } catch (error) {
    console.error('Update yearly balance error:', error);
    return errorResponse(res, 'Failed to update yearly balance', 500);
  }
};

/**
 * Delete yearly balance
 * DELETE /api/treasury/yearly-balance/:year
 * Access: SuperAdmin only
 */
const deleteYearlyBalance = async (req, res) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year);

    if (isNaN(yearInt) || yearInt < 2000 || yearInt > 2050) {
      return errorResponse(res, 'Invalid year parameter', 400);
    }

    const yearlyBalance = await prisma.yearlyBalance.findUnique({
      where: { year: yearInt }
    });

    if (!yearlyBalance) {
      return errorResponse(res, 'Yearly balance not found for this year', 404);
    }

    // Check if there are any transactions for this year
    const [expenseCount, collectionCount] = await Promise.all([
      prisma.expense.count({
        where: {
          expenseDate: {
            gte: new Date(`${yearInt}-01-01`),
            lte: new Date(`${yearInt}-12-31`)
          }
        }
      }),
      prisma.manualCollection.count({
        where: {
          collectionDate: {
            gte: new Date(`${yearInt}-01-01`),
            lte: new Date(`${yearInt}-12-31`)
          }
        }
      })
    ]);

    if (expenseCount > 0 || collectionCount > 0) {
      return errorResponse(
        res,
        `Cannot delete yearly balance for ${yearInt}. There are ${expenseCount} expenses and ${collectionCount} collections for this year.`,
        400
      );
    }

    await prisma.yearlyBalance.delete({
      where: { year: yearInt }
    });

    return successResponse(
      res,
      {
        deletedBalance: {
          year: yearInt,
          openingBalance: yearlyBalance.openingBalance
        }
      },
      'Yearly balance deleted successfully'
    );
  } catch (error) {
    console.error('Delete yearly balance error:', error);
    return errorResponse(res, 'Failed to delete yearly balance', 500);
  }
};

// ============================================
// ACCOUNT BALANCE MANAGEMENT
// ============================================

/**
 * Get current account balance
 * GET /api/treasury/account-balance
 * Access: Public (Read-only for transparency)
 */
const getCurrentAccountBalance = async (req, res) => {
  try {
    const latestBalance = await prisma.accountBalance.findFirst({
      include: {
        updater: {
          select: { id: true, fullName: true, role: true }
        }
      },
      orderBy: { balanceDate: 'desc' }
    });

    if (!latestBalance) {
      return successResponse(
        res,
        {
          currentBalance: null,
          message: 'No account balance records found'
        },
        'No account balance found'
      );
    }

    return successResponse(
      res,
      {
        currentBalance: {
          id: latestBalance.id,
          currentBalance: latestBalance.currentBalance,
          balanceDate: latestBalance.balanceDate,
          notes: latestBalance.notes,
          bankStatementUrl: latestBalance.bankStatementUrl,
          updater: latestBalance.updater,
          createdAt: latestBalance.createdAt
        }
      },
      'Current account balance retrieved successfully'
    );
  } catch (error) {
    console.error('Get current account balance error:', error);
    return errorResponse(res, 'Failed to retrieve current account balance', 500);
  }
};

/**
 * Get account balance history
 * GET /api/treasury/balance-history
 * Access: Public (Read-only for transparency)
 */
const getAccountBalanceHistory = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const limitInt = Math.min(parseInt(limit) || 50, 100); // Max 100 records

    const balanceHistory = await prisma.accountBalance.findMany({
      include: {
        updater: {
          select: { id: true, fullName: true }
        }
      },
      orderBy: { balanceDate: 'desc' },
      take: limitInt
    });

    const formattedHistory = balanceHistory.map((balance, index) => {
      const previousBalance = index < balanceHistory.length - 1 ? balanceHistory[index + 1] : null;
      const balanceChange = previousBalance 
        ? parseFloat(balance.currentBalance) - parseFloat(previousBalance.currentBalance)
        : null;

      return {
        id: balance.id,
        currentBalance: balance.currentBalance,
        balanceDate: balance.balanceDate,
        notes: balance.notes,
        bankStatementUrl: balance.bankStatementUrl,
        updater: balance.updater,
        balanceChange,
        createdAt: balance.createdAt
      };
    });

    return successResponse(
      res,
      {
        balanceHistory: formattedHistory,
        summary: {
          totalRecords: balanceHistory.length,
          latestBalance: balanceHistory.length > 0 ? balanceHistory[0].currentBalance : null,
          oldestBalance: balanceHistory.length > 0 ? balanceHistory[balanceHistory.length - 1].currentBalance : null,
          dateRange: {
            from: balanceHistory.length > 0 ? balanceHistory[balanceHistory.length - 1].balanceDate : null,
            to: balanceHistory.length > 0 ? balanceHistory[0].balanceDate : null
          }
        }
      },
      'Account balance history retrieved successfully'
    );
  } catch (error) {
    console.error('Get account balance history error:', error);
    return errorResponse(res, 'Failed to retrieve account balance history', 500);
  }
};

/**
 * Update account balance
 * POST /api/treasury/account-balance
 * Access: SuperAdmin only
 */
const updateAccountBalance = async (req, res) => {
  try {
    const { currentBalance, balanceDate, notes } = req.body;
    const userId = req.user.id;

    // Check if balance for this date already exists
    const existingBalance = await prisma.accountBalance.findFirst({
      where: {
        balanceDate: new Date(balanceDate)
      }
    });

    if (existingBalance) {
      return errorResponse(res, 'Account balance already exists for this date. Please update the existing record.', 400);
    }

    const accountBalance = await prisma.accountBalance.create({
      data: {
        currentBalance,
        balanceDate: new Date(balanceDate),
        notes: notes?.trim(),
        updatedBy: userId
      },
      include: {
        updater: {
          select: { id: true, fullName: true }
        }
      }
    });

    return successResponse(
      res,
      {
        accountBalance: {
          id: accountBalance.id,
          currentBalance: accountBalance.currentBalance,
          balanceDate: accountBalance.balanceDate,
          notes: accountBalance.notes,
          bankStatementUrl: accountBalance.bankStatementUrl,
          updater: accountBalance.updater,
          createdAt: accountBalance.createdAt
        }
      },
      'Account balance updated successfully',
      201
    );
  } catch (error) {
    console.error('Update account balance error:', error);
    return errorResponse(res, 'Failed to update account balance', 500);
  }
};

/**
 * Upload bank statement
 * POST /api/treasury/account-balance/:balanceId/statement
 * Access: SuperAdmin only
 */
const uploadBankStatement = async (req, res) => {
  try {
    const { balanceId } = req.params;

    if (!req.file) {
      return errorResponse(res, 'Bank statement file is required', 400);
    }

    const accountBalance = await prisma.accountBalance.findUnique({
      where: { id: balanceId }
    });

    if (!accountBalance) {
      return errorResponse(res, 'Account balance record not found', 404);
    }

    // Generate file URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/documents/${req.file.filename}`;

    const updatedBalance = await prisma.accountBalance.update({
      where: { id: balanceId },
      data: { bankStatementUrl: fileUrl },
      include: {
        updater: {
          select: { id: true, fullName: true }
        }
      }
    });

    return successResponse(
      res,
      {
        accountBalance: {
          id: updatedBalance.id,
          currentBalance: updatedBalance.currentBalance,
          balanceDate: updatedBalance.balanceDate,
          bankStatementUrl: updatedBalance.bankStatementUrl,
          updater: updatedBalance.updater
        },
        uploadedFile: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          url: fileUrl
        }
      },
      'Bank statement uploaded successfully'
    );
  } catch (error) {
    console.error('Upload bank statement error:', error);
    return errorResponse(res, 'Failed to upload bank statement', 500);
  }
};

module.exports = {
  // Yearly Balance
  getYearlyBalances,
  getYearlyBalance,
  createYearlyBalance,
  updateYearlyBalance,
  deleteYearlyBalance,
  
  // Account Balance
  getCurrentAccountBalance,
  getAccountBalanceHistory,
  updateAccountBalance,
  uploadBankStatement
};