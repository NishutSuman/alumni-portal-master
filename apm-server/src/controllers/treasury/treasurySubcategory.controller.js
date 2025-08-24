// src/controllers/treasury/treasurySubcategory.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================
// EXPENSE SUBCATEGORY MANAGEMENT
// ============================================

/**
 * Get all subcategories for a category
 * GET /api/treasury/expense-categories/:categoryId/subcategories
 * Access: Public (Read-only for transparency)
 */
const getCategorySubcategories = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { includeInactive = false } = req.query;

    // Verify category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, isActive: true }
    });

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    const subcategories = await prisma.expenseSubcategory.findMany({
      where: {
        categoryId,
        ...(includeInactive === 'true' ? {} : { isActive: true })
      },
      include: {
        _count: {
          select: { expenses: true }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    // Calculate total amount for each subcategory
    const subcategoriesWithAmounts = await Promise.all(
      subcategories.map(async (subcategory) => {
        const totalExpenses = await prisma.expense.aggregate({
          where: { subcategoryId: subcategory.id },
          _sum: { amount: true }
        });

        return {
          id: subcategory.id,
          name: subcategory.name,
          description: subcategory.description,
          isActive: subcategory.isActive,
          displayOrder: subcategory.displayOrder,
          expenseCount: subcategory._count.expenses,
          totalAmount: totalExpenses._sum.amount || 0,
          createdAt: subcategory.createdAt,
          updatedAt: subcategory.updatedAt
        };
      })
    );

    return successResponse(
      res,
      {
        category: {
          id: category.id,
          name: category.name,
          isActive: category.isActive
        },
        subcategories: subcategoriesWithAmounts
      },
      'Subcategories retrieved successfully'
    );
  } catch (error) {
    console.error('Get category subcategories error:', error);
    return errorResponse(res, 'Failed to retrieve subcategories', 500);
  }
};

/**
 * Get single subcategory with detailed info
 * GET /api/treasury/expense-subcategories/:subcategoryId
 * Access: Public (Read-only for transparency)
 */
const getExpenseSubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;

    const subcategory = await prisma.expenseSubcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        category: {
          select: { id: true, name: true, isActive: true }
        },
        expenses: {
          select: {
            id: true,
            amount: true,
            description: true,
            expenseDate: true,
            vendorName: true,
            receiptUrl: true,
            isApproved: true,
            linkedEvent: {
              select: { id: true, title: true }
            },
            creator: {
              select: { id: true, fullName: true }
            }
          },
          orderBy: { expenseDate: 'desc' },
          take: 20 // Recent 20 expenses
        },
        _count: {
          select: { expenses: true }
        }
      }
    });

    if (!subcategory) {
      return errorResponse(res, 'Subcategory not found', 404);
    }

    // Calculate total expense amount
    const totalExpenses = await prisma.expense.aggregate({
      where: { subcategoryId },
      _sum: { amount: true }
    });

    const formattedSubcategory = {
      id: subcategory.id,
      name: subcategory.name,
      description: subcategory.description,
      isActive: subcategory.isActive,
      displayOrder: subcategory.displayOrder,
      category: subcategory.category,
      expenseCount: subcategory._count.expenses,
      totalAmount: totalExpenses._sum.amount || 0,
      expenses: subcategory.expenses,
      createdAt: subcategory.createdAt,
      updatedAt: subcategory.updatedAt
    };

    return successResponse(
      res,
      { subcategory: formattedSubcategory },
      'Subcategory retrieved successfully'
    );
  } catch (error) {
    console.error('Get expense subcategory error:', error);
    return errorResponse(res, 'Failed to retrieve subcategory', 500);
  }
};

/**
 * Create new subcategory under a category
 * POST /api/treasury/expense-categories/:categoryId/subcategories
 * Access: SuperAdmin only
 */
const createExpenseSubcategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, displayOrder } = req.body;

    // Verify category exists and is active
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, isActive: true }
    });

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    if (!category.isActive) {
      return errorResponse(res, 'Cannot add subcategory to inactive category', 400);
    }

    // Check if subcategory name already exists in this category
    const existingSubcategory = await prisma.expenseSubcategory.findFirst({
      where: {
        categoryId,
        name: name.trim()
      }
    });

    if (existingSubcategory) {
      return errorResponse(res, 'Subcategory name already exists in this category', 400);
    }

    // Get next display order if not provided
    let finalDisplayOrder = displayOrder;
    if (finalDisplayOrder === undefined) {
      const lastSubcategory = await prisma.expenseSubcategory.findFirst({
        where: { categoryId },
        orderBy: { displayOrder: 'desc' }
      });
      finalDisplayOrder = lastSubcategory ? lastSubcategory.displayOrder + 1 : 0;
    }

    const subcategory = await prisma.expenseSubcategory.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        categoryId,
        displayOrder: finalDisplayOrder
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        _count: {
          select: { expenses: true }
        }
      }
    });

    return successResponse(
      res,
      {
        subcategory: {
          id: subcategory.id,
          name: subcategory.name,
          description: subcategory.description,
          isActive: subcategory.isActive,
          displayOrder: subcategory.displayOrder,
          category: subcategory.category,
          expenseCount: subcategory._count.expenses,
          totalAmount: 0,
          createdAt: subcategory.createdAt,
          updatedAt: subcategory.updatedAt
        }
      },
      'Subcategory created successfully',
      201
    );
  } catch (error) {
    console.error('Create expense subcategory error:', error);
    return errorResponse(res, 'Failed to create subcategory', 500);
  }
};

/**
 * Update expense subcategory
 * PUT /api/treasury/expense-subcategories/:subcategoryId
 * Access: SuperAdmin only
 */
const updateExpenseSubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { name, description, isActive, displayOrder } = req.body;

    // Check if subcategory exists
    const existingSubcategory = await prisma.expenseSubcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        category: {
          select: { id: true, name: true, isActive: true }
        }
      }
    });

    if (!existingSubcategory) {
      return errorResponse(res, 'Subcategory not found', 404);
    }

    // Check if new name already exists in the same category (if name is being changed)
    if (name && name.trim() !== existingSubcategory.name) {
      const nameExists = await prisma.expenseSubcategory.findFirst({
        where: {
          categoryId: existingSubcategory.categoryId,
          name: name.trim(),
          id: { not: subcategoryId }
        }
      });

      if (nameExists) {
        return errorResponse(res, 'Subcategory name already exists in this category', 400);
      }
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (isActive !== undefined) updateData.isActive = isActive;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    const updatedSubcategory = await prisma.expenseSubcategory.update({
      where: { id: subcategoryId },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true }
        },
        _count: {
          select: { expenses: true }
        }
      }
    });

    // Calculate total amount
    const totalExpenses = await prisma.expense.aggregate({
      where: { subcategoryId },
      _sum: { amount: true }
    });

    return successResponse(
      res,
      {
        subcategory: {
          id: updatedSubcategory.id,
          name: updatedSubcategory.name,
          description: updatedSubcategory.description,
          isActive: updatedSubcategory.isActive,
          displayOrder: updatedSubcategory.displayOrder,
          category: updatedSubcategory.category,
          expenseCount: updatedSubcategory._count.expenses,
          totalAmount: totalExpenses._sum.amount || 0,
          createdAt: updatedSubcategory.createdAt,
          updatedAt: updatedSubcategory.updatedAt
        }
      },
      'Subcategory updated successfully'
    );
  } catch (error) {
    console.error('Update expense subcategory error:', error);
    return errorResponse(res, 'Failed to update subcategory', 500);
  }
};

/**
 * Delete expense subcategory
 * DELETE /api/treasury/expense-subcategories/:subcategoryId
 * Access: SuperAdmin only
 */
const deleteExpenseSubcategory = async (req, res) => {
  try {
    const { subcategoryId } = req.params;

    // Check if subcategory exists
    const subcategory = await prisma.expenseSubcategory.findUnique({
      where: { id: subcategoryId },
      include: {
        category: {
          select: { id: true, name: true }
        },
        _count: {
          select: { expenses: true }
        }
      }
    });

    if (!subcategory) {
      return errorResponse(res, 'Subcategory not found', 404);
    }

    // Check if subcategory has expenses
    if (subcategory._count.expenses > 0) {
      return errorResponse(
        res,
        'Cannot delete subcategory with existing expenses. Please move or delete expenses first.',
        400
      );
    }

    // Delete subcategory
    await prisma.expenseSubcategory.delete({
      where: { id: subcategoryId }
    });

    return successResponse(
      res,
      {
        deletedSubcategory: {
          id: subcategory.id,
          name: subcategory.name,
          category: subcategory.category
        }
      },
      'Subcategory deleted successfully'
    );
  } catch (error) {
    console.error('Delete expense subcategory error:', error);
    return errorResponse(res, 'Failed to delete subcategory', 500);
  }
};

/**
 * Reorder subcategories within a category
 * POST /api/treasury/expense-categories/:categoryId/subcategories/reorder
 * Access: SuperAdmin only
 */
const reorderSubcategories = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { subcategoryIds } = req.body;

    if (!Array.isArray(subcategoryIds) || subcategoryIds.length === 0) {
      return errorResponse(res, 'Subcategory IDs array is required', 400);
    }

    // Verify category exists
    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true }
    });

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    // Verify all subcategories exist and belong to this category
    const subcategories = await prisma.expenseSubcategory.findMany({
      where: {
        id: { in: subcategoryIds },
        categoryId
      },
      select: { id: true }
    });

    if (subcategories.length !== subcategoryIds.length) {
      return errorResponse(res, 'Some subcategories not found or do not belong to this category', 404);
    }

    // Update display order for each subcategory
    const updatePromises = subcategoryIds.map((subcategoryId, index) =>
      prisma.expenseSubcategory.update({
        where: { id: subcategoryId },
        data: { displayOrder: index }
      })
    );

    await Promise.all(updatePromises);

    // Get updated subcategories
    const updatedSubcategories = await prisma.expenseSubcategory.findMany({
      where: {
        id: { in: subcategoryIds }
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
      {
        category: { id: category.id, name: category.name },
        subcategories: updatedSubcategories
      },
      'Subcategories reordered successfully'
    );
  } catch (error) {
    console.error('Reorder subcategories error:', error);
    return errorResponse(res, 'Failed to reorder subcategories', 500);
  }
};

module.exports = {
  getCategorySubcategories,
  getExpenseSubcategory,
  createExpenseSubcategory,
  updateExpenseSubcategory,
  deleteExpenseSubcategory,
  reorderSubcategories
};