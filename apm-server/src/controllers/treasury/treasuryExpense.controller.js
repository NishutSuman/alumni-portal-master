// src/controllers/treasury/treasuryExpense.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams } = require('../../utils/response');

// ============================================
// EXPENSE MANAGEMENT
// ============================================

/**
 * Get all expenses with filters and pagination
 * GET /api/treasury/expenses
 * Access: Public (Read-only for transparency)
 */
const getExpenses = async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      categoryId, 
      subcategoryId, 
      eventId, 
      dateFrom, 
      dateTo,
      isApproved,
      search,
      sortBy = 'expenseDate',
      sortOrder = 'desc'
    } = req.query;

    const { skip, take } = getPaginationParams(page, limit);

    // Build filters
    const whereClause = {};

    if (categoryId) whereClause.categoryId = categoryId;
    if (subcategoryId) whereClause.subcategoryId = subcategoryId;
    if (eventId) whereClause.linkedEventId = eventId;
    if (isApproved !== undefined) whereClause.isApproved = isApproved === 'true';

    // Date range filter
    if (dateFrom || dateTo) {
      whereClause.expenseDate = {};
      if (dateFrom) whereClause.expenseDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.expenseDate.lte = new Date(dateTo);
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Valid sort fields
    const validSortFields = ['expenseDate', 'amount', 'createdAt', 'updatedAt'];
    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'expenseDate';
    const finalSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where: whereClause,
        include: {
          category: {
            select: { id: true, name: true }
          },
          subcategory: {
            select: { id: true, name: true }
          },
          linkedEvent: {
            select: { id: true, title: true, eventDate: true }
          },
          creator: {
            select: { id: true, fullName: true }
          },
          approver: {
            select: { id: true, fullName: true }
          }
        },
        skip,
        take,
        orderBy: { [finalSortBy]: finalSortOrder }
      }),
      prisma.expense.count({ where: whereClause })
    ]);

    const formattedExpenses = expenses.map(expense => ({
      id: expense.id,
      amount: expense.amount,
      description: expense.description,
      expenseDate: expense.expenseDate,
      vendorName: expense.vendorName,
      vendorContact: expense.vendorContact,
      receiptUrl: expense.receiptUrl,
      isApproved: expense.isApproved,
      approvedAt: expense.approvedAt,
      category: expense.category,
      subcategory: expense.subcategory,
      linkedEvent: expense.linkedEvent,
      creator: expense.creator,
      approver: expense.approver,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt
    }));

    // Calculate total amount for current filters
    const totalAmount = await prisma.expense.aggregate({
      where: whereClause,
      _sum: { amount: true }
    });

    const responseData = {
      expenses: formattedExpenses,
      summary: {
        totalAmount: totalAmount._sum.amount || 0,
        totalCount,
        approvedCount: expenses.filter(e => e.isApproved).length,
        pendingCount: expenses.filter(e => !e.isApproved).length
      },
      filters: {
        categoryId,
        subcategoryId,
        eventId,
        dateFrom,
        dateTo,
        isApproved,
        search
      }
    };

    return paginatedResponse(res, responseData, totalCount, page, limit, 'Expenses retrieved successfully');
  } catch (error) {
    console.error('Get expenses error:', error);
    return errorResponse(res, 'Failed to retrieve expenses', 500);
  }
};

/**
 * Get single expense with detailed information
 * GET /api/treasury/expenses/:expenseId
 * Access: Public (Read-only for transparency)
 */
const getExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: {
          select: { id: true, name: true, description: true }
        },
        subcategory: {
          select: { id: true, name: true, description: true }
        },
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
        approver: {
          select: { 
            id: true, 
            fullName: true,
            role: true 
          }
        }
      }
    });

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    return successResponse(
      res,
      { expense },
      'Expense retrieved successfully'
    );
  } catch (error) {
    console.error('Get expense error:', error);
    return errorResponse(res, 'Failed to retrieve expense', 500);
  }
};

/**
 * Create new expense entry
 * POST /api/treasury/expenses
 * Access: SuperAdmin only
 */
const createExpense = async (req, res) => {
  try {
    const {
      amount,
      description,
      expenseDate,
      categoryId,
      subcategoryId,
      linkedEventId,
      vendorName,
      vendorContact
    } = req.body;

    const userId = req.user.id;

    // Verify category exists and is active
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, isActive: true }
    });

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    if (!category.isActive) {
      return errorResponse(res, 'Cannot add expense to inactive category', 400);
    }

    // Verify subcategory if provided
    if (subcategoryId) {
      const subcategory = await prisma.expenseSubcategory.findUnique({
        where: { id: subcategoryId },
        select: { id: true, name: true, categoryId: true, isActive: true }
      });

      if (!subcategory) {
        return errorResponse(res, 'Subcategory not found', 404);
      }

      if (subcategory.categoryId !== categoryId) {
        return errorResponse(res, 'Subcategory does not belong to the specified category', 400);
      }

      if (!subcategory.isActive) {
        return errorResponse(res, 'Cannot add expense to inactive subcategory', 400);
      }
    }

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

    const expense = await prisma.expense.create({
      data: {
        amount,
        description: description.trim(),
        expenseDate: new Date(expenseDate),
        categoryId,
        subcategoryId,
        linkedEventId,
        vendorName: vendorName?.trim(),
        vendorContact: vendorContact?.trim(),
        createdBy: userId,
        isApproved: true, // Auto-approve for SuperAdmin
        approvedBy: userId,
        approvedAt: new Date()
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        subcategory: {
          select: { id: true, name: true }
        },
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
        expense: {
          id: expense.id,
          amount: expense.amount,
          description: expense.description,
          expenseDate: expense.expenseDate,
          vendorName: expense.vendorName,
          vendorContact: expense.vendorContact,
          isApproved: expense.isApproved,
          category: expense.category,
          subcategory: expense.subcategory,
          linkedEvent: expense.linkedEvent,
          creator: expense.creator,
          createdAt: expense.createdAt
        }
      },
      'Expense created successfully',
      201
    );
  } catch (error) {
    console.error('Create expense error:', error);
    return errorResponse(res, 'Failed to create expense', 500);
  }
};

/**
 * Update expense entry
 * PUT /api/treasury/expenses/:expenseId
 * Access: SuperAdmin only
 */
const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const {
      amount,
      description,
      expenseDate,
      subcategoryId,
      linkedEventId,
      vendorName,
      vendorContact
    } = req.body;

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: { select: { id: true, isActive: true } },
        subcategory: { select: { id: true, isActive: true } }
      }
    });

    if (!existingExpense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    // Prepare update data
    const updateData = {};
    if (amount !== undefined) updateData.amount = amount;
    if (description !== undefined) updateData.description = description.trim();
    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate);
    if (vendorName !== undefined) updateData.vendorName = vendorName?.trim();
    if (vendorContact !== undefined) updateData.vendorContact = vendorContact?.trim();
    if (linkedEventId !== undefined) updateData.linkedEventId = linkedEventId;

    // Handle subcategory change
    if (subcategoryId !== undefined) {
      if (subcategoryId) {
        const subcategory = await prisma.expenseSubcategory.findUnique({
          where: { id: subcategoryId },
          select: { id: true, categoryId: true, isActive: true }
        });

        if (!subcategory) {
          return errorResponse(res, 'Subcategory not found', 404);
        }

        if (subcategory.categoryId !== existingExpense.categoryId) {
          return errorResponse(res, 'Subcategory must belong to the same category', 400);
        }

        if (!subcategory.isActive) {
          return errorResponse(res, 'Cannot assign expense to inactive subcategory', 400);
        }
      }
      updateData.subcategoryId = subcategoryId;
    }

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

    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true }
        },
        subcategory: {
          select: { id: true, name: true }
        },
        linkedEvent: {
          select: { id: true, title: true }
        },
        creator: {
          select: { id: true, fullName: true }
        },
        approver: {
          select: { id: true, fullName: true }
        }
      }
    });

    return successResponse(
      res,
      { expense: updatedExpense },
      'Expense updated successfully'
    );
  } catch (error) {
    console.error('Update expense error:', error);
    return errorResponse(res, 'Failed to update expense', 500);
  }
};

/**
 * Delete expense entry
 * DELETE /api/treasury/expenses/:expenseId
 * Access: SuperAdmin only
 */
const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { 
        id: true, 
        amount: true, 
        description: true,
        receiptUrl: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } }
      }
    });

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    // Delete associated receipt file if exists
    if (expense.receiptUrl) {
      // Receipt deletion will be handled by receipt management endpoints
      // For now, we'll keep the file but note this in audit
    }

    await prisma.expense.delete({
      where: { id: expenseId }
    });

    return successResponse(
      res,
      {
        deletedExpense: {
          id: expense.id,
          amount: expense.amount,
          description: expense.description.substring(0, 100),
          category: expense.category.name,
          subcategory: expense.subcategory?.name,
          hadReceipt: !!expense.receiptUrl
        }
      },
      'Expense deleted successfully'
    );
  } catch (error) {
    console.error('Delete expense error:', error);
    return errorResponse(res, 'Failed to delete expense', 500);
  }
};

/**
 * Get expenses by category
 * GET /api/treasury/expenses/by-category/:categoryId
 * Access: Public (Read-only for transparency)
 */
const getExpensesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { 
      page, 
      limit, 
      dateFrom, 
      dateTo,
      subcategoryId
    } = req.query;

    const { skip, take } = getPaginationParams(page, limit);

    // Verify category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true }
    });

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    // Build filters
    const whereClause = { categoryId };
    
    if (subcategoryId) whereClause.subcategoryId = subcategoryId;
    
    if (dateFrom || dateTo) {
      whereClause.expenseDate = {};
      if (dateFrom) whereClause.expenseDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.expenseDate.lte = new Date(dateTo);
    }

    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where: whereClause,
        include: {
          subcategory: {
            select: { id: true, name: true }
          },
          linkedEvent: {
            select: { id: true, title: true }
          },
          creator: {
            select: { id: true, fullName: true }
          }
        },
        skip,
        take,
        orderBy: { expenseDate: 'desc' }
      }),
      prisma.expense.count({ where: whereClause })
    ]);

    // Calculate total amount
    const totalAmount = await prisma.expense.aggregate({
      where: whereClause,
      _sum: { amount: true }
    });

    const responseData = {
      category,
      expenses,
      summary: {
        totalAmount: totalAmount._sum.amount || 0,
        totalCount,
        averageAmount: totalCount > 0 ? (totalAmount._sum.amount || 0) / totalCount : 0
      }
    };

    return paginatedResponse(res, responseData, totalCount, page, limit, 'Category expenses retrieved successfully');
  } catch (error) {
    console.error('Get expenses by category error:', error);
    return errorResponse(res, 'Failed to retrieve category expenses', 500);
  }
};

/**
 * Get expenses by subcategory
 * GET /api/treasury/expenses/by-subcategory/:subcategoryId
 * Access: Public (Read-only for transparency)
 */
const getExpensesBySubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { page, limit, dateFrom, dateTo } = req.query;

    const { skip, take } = getPaginationParams(page, limit);

    // Verify subcategory exists
    const subcategory = await prisma.expenseSubcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    if (!subcategory) {
      return errorResponse(res, 'Subcategory not found', 404);
    }

    // Build filters
    const whereClause = { subcategoryId };
    
    if (dateFrom || dateTo) {
      whereClause.expenseDate = {};
      if (dateFrom) whereClause.expenseDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.expenseDate.lte = new Date(dateTo);
    }

    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
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
        orderBy: { expenseDate: 'desc' }
      }),
      prisma.expense.count({ where: whereClause })
    ]);

    // Calculate total amount
    const totalAmount = await prisma.expense.aggregate({
      where: whereClause,
      _sum: { amount: true }
    });

    const responseData = {
      subcategory: {
        id: subcategory.id,
        name: subcategory.name,
        description: subcategory.description,
        category: subcategory.category
      },
      expenses,
      summary: {
        totalAmount: totalAmount._sum.amount || 0,
        totalCount,
        averageAmount: totalCount > 0 ? (totalAmount._sum.amount || 0) / totalCount : 0
      }
    };

    return paginatedResponse(res, responseData, totalCount, page, limit, 'Subcategory expenses retrieved successfully');
  } catch (error) {
    console.error('Get expenses by subcategory error:', error);
    return errorResponse(res, 'Failed to retrieve subcategory expenses', 500);
  }
};

module.exports = {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesByCategory,
  getExpensesBySubcategory
};