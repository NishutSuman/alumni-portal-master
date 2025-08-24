// src/controllers/treasury/treasuryCategory.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams } = require('../../utils/response');

// ============================================
// EXPENSE CATEGORY MANAGEMENT
// ============================================

/**
 * Get all expense categories with subcategories
 * GET /api/treasury/expense-categories
 * Access: Public (Read-only for transparency)
 */
const getExpenseCategories = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    
    const categories = await prisma.expenseCategory.findMany({
      where: includeInactive === 'true' ? {} : { isActive: true },
      include: {
        subcategories: {
          where: includeInactive === 'true' ? {} : { isActive: true },
          orderBy: { displayOrder: 'asc' }
        },
        _count: {
          select: {
            expenses: true,
            subcategories: true
          }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    const formattedCategories = categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      displayOrder: category.displayOrder,
      subcategoryCount: category._count.subcategories,
      expenseCount: category._count.expenses,
      subcategories: category.subcategories.map(sub => ({
        id: sub.id,
        name: sub.name,
        description: sub.description,
        isActive: sub.isActive,
        displayOrder: sub.displayOrder
      })),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    }));

    return successResponse(
      res,
      { categories: formattedCategories },
      'Expense categories retrieved successfully'
    );
  } catch (error) {
    console.error('Get expense categories error:', error);
    return errorResponse(res, 'Failed to retrieve expense categories', 500);
  }
};

/**
 * Get single expense category with detailed info
 * GET /api/treasury/expense-categories/:categoryId
 * Access: Public (Read-only for transparency)
 */
const getExpenseCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      include: {
        subcategories: {
          include: {
            _count: {
              select: { expenses: true }
            }
          },
          orderBy: { displayOrder: 'asc' }
        },
        expenses: {
          select: {
            id: true,
            amount: true,
            description: true,
            expenseDate: true,
            vendorName: true,
            isApproved: true,
            subcategory: {
              select: { id: true, name: true }
            },
            linkedEvent: {
              select: { id: true, title: true }
            }
          },
          orderBy: { expenseDate: 'desc' },
          take: 10 // Recent 10 expenses
        },
        _count: {
          select: {
            expenses: true,
            subcategories: true
          }
        }
      }
    });

    if (!category) {
      return errorResponse(res, 'Expense category not found', 404);
    }

    // Calculate total expense amount
    const totalExpenses = await prisma.expense.aggregate({
      where: { categoryId },
      _sum: { amount: true }
    });

    const formattedCategory = {
      id: category.id,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      displayOrder: category.displayOrder,
      subcategoryCount: category._count.subcategories,
      expenseCount: category._count.expenses,
      totalAmount: totalExpenses._sum.amount || 0,
      subcategories: category.subcategories.map(sub => ({
        id: sub.id,
        name: sub.name,
        description: sub.description,
        isActive: sub.isActive,
        displayOrder: sub.displayOrder,
        expenseCount: sub._count.expenses
      })),
      recentExpenses: category.expenses,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };

    return successResponse(
      res,
      { category: formattedCategory },
      'Expense category retrieved successfully'
    );
  } catch (error) {
    console.error('Get expense category error:', error);
    return errorResponse(res, 'Failed to retrieve expense category', 500);
  }
};

/**
 * Create new expense category
 * POST /api/treasury/expense-categories
 * Access: SuperAdmin only
 */
const createExpenseCategory = async (req, res) => {
  try {
    const { name, description, displayOrder } = req.body;

    // Check if category name already exists
    const existingCategory = await prisma.expenseCategory.findUnique({
      where: { name }
    });

    if (existingCategory) {
      return errorResponse(res, 'Category name already exists', 400);
    }

    // Get next display order if not provided
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const lastCategory = await prisma.expenseCategory.findFirst({
        orderBy: { displayOrder: 'desc' }
      });
      finalDisplayOrder = lastCategory ? lastCategory.displayOrder + 1 : 0;
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        displayOrder: finalDisplayOrder
      },
      include: {
        _count: {
          select: {
            expenses: true,
            subcategories: true
          }
        }
      }
    });

    return successResponse(
      res,
      {
        category: {
          id: category.id,
          name: category.name,
          description: category.description,
          isActive: category.isActive,
          displayOrder: category.displayOrder,
          subcategoryCount: category._count.subcategories,
          expenseCount: category._count.expenses,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        }
      },
      'Expense category created successfully',
      201
    );
  } catch (error) {
    console.error('Create expense category error:', error);
    return errorResponse(res, 'Failed to create expense category', 500);
  }
};

/**
 * Update expense category
 * PUT /api/treasury/expense-categories/:categoryId
 * Access: SuperAdmin only
 */
const updateExpenseCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, isActive, displayOrder } = req.body;

    // Check if category exists
    const existingCategory = await prisma.expenseCategory.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      return errorResponse(res, 'Expense category not found', 404);
    }

    // Check if new name already exists (if name is being changed)
    if (name && name !== existingCategory.name) {
      const nameExists = await prisma.expenseCategory.findUnique({
        where: { name: name.trim() }
      });

      if (nameExists) {
        return errorResponse(res, 'Category name already exists', 400);
      }
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    const updatedCategory = await prisma.expenseCategory.update({
      where: { id: categoryId },
      data: updateData,
      include: {
        _count: {
          select: {
            expenses: true,
            subcategories: true
          }
        }
      }
    });

    return successResponse(
      res,
      {
        category: {
          id: updatedCategory.id,
          name: updatedCategory.name,
          description: updatedCategory.description,
          isActive: updatedCategory.isActive,
          displayOrder: updatedCategory.displayOrder,
          subcategoryCount: updatedCategory._count.subcategories,
          expenseCount: updatedCategory._count.expenses,
          createdAt: updatedCategory.createdAt,
          updatedAt: updatedCategory.updatedAt
        }
      },
      'Expense category updated successfully'
    );
  } catch (error) {
    console.error('Update expense category error:', error);
    return errorResponse(res, 'Failed to update expense category', 500);
  }
};

/**
 * Delete expense category
 * DELETE /api/treasury/expense-categories/:categoryId
 * Access: SuperAdmin only
 */
const deleteExpenseCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Check if category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: {
            expenses: true,
            subcategories: true
          }
        }
      }
    });

    if (!category) {
      return errorResponse(res, 'Expense category not found', 404);
    }

    // Check if category has expenses
    if (category._count.expenses > 0) {
      return errorResponse(
        res,
        'Cannot delete category with existing expenses. Please move or delete expenses first.',
        400
      );
    }

    // Check if category has subcategories
    if (category._count.subcategories > 0) {
      return errorResponse(
        res,
        'Cannot delete category with existing subcategories. Please delete subcategories first.',
        400
      );
    }

    // Delete category
    await prisma.expenseCategory.delete({
      where: { id: categoryId }
    });

    return successResponse(
      res,
      {
        deletedCategory: {
          id: category.id,
          name: category.name
        }
      },
      'Expense category deleted successfully'
    );
  } catch (error) {
    console.error('Delete expense category error:', error);
    return errorResponse(res, 'Failed to delete expense category', 500);
  }
};

/**
 * Reorder expense categories
 * POST /api/treasury/expense-categories/reorder
 * Access: SuperAdmin only
 */
const reorderExpenseCategories = async (req, res) => {
  try {
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return errorResponse(res, 'Category IDs array is required', 400);
    }

    // Verify all categories exist
    const categories = await prisma.expenseCategory.findMany({
      where: {
        id: { in: categoryIds }
      },
      select: { id: true }
    });

    if (categories.length !== categoryIds.length) {
      return errorResponse(res, 'Some categories not found', 404);
    }

    // Update display order for each category
    const updatePromises = categoryIds.map((categoryId, index) =>
      prisma.expenseCategory.update({
        where: { id: categoryId },
        data: { displayOrder: index }
      })
    );

    await Promise.all(updatePromises);

    // Get updated categories
    const updatedCategories = await prisma.expenseCategory.findMany({
      where: {
        id: { in: categoryIds }
      },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayOrder: true
      }
    });

    return successResponse(
      res,
      { categories: updatedCategories },
      'Categories reordered successfully'
    );
  } catch (error) {
    console.error('Reorder categories error:', error);
    return errorResponse(res, 'Failed to reorder categories', 500);
  }
};

module.exports = {
  getExpenseCategories,
  getExpenseCategory,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  reorderExpenseCategories
};