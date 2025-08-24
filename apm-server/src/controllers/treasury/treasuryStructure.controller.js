// src/controllers/treasury/treasuryStructure.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');

// ============================================
// TREASURY STRUCTURE MANAGEMENT
// ============================================

/**
 * Get complete expense structure (categories -> subcategories)
 * GET /api/treasury/expense-structure
 * Access: Public (Read-only for transparency)
 */
const getExpenseStructure = async (req, res) => {
  try {
    const { includeInactive = false, includeAmounts = true } = req.query;

    const categories = await prisma.expenseCategory.findMany({
      where: includeInactive === 'true' ? {} : { isActive: true },
      include: {
        subcategories: {
          where: includeInactive === 'true' ? {} : { isActive: true },
          orderBy: { displayOrder: 'asc' }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    let structure;

    if (includeAmounts === 'true') {
      // Include expense amounts and counts (more expensive query)
      structure = await Promise.all(
        categories.map(async (category) => {
          // Get category totals
          const categoryTotals = await prisma.expense.aggregate({
            where: { categoryId: category.id },
            _sum: { amount: true },
            _count: true
          });

          // Get subcategory details with amounts
          const subcategoriesWithAmounts = await Promise.all(
            category.subcategories.map(async (subcategory) => {
              const subcategoryTotals = await prisma.expense.aggregate({
                where: { subcategoryId: subcategory.id },
                _sum: { amount: true },
                _count: true
              });

              return {
                id: subcategory.id,
                name: subcategory.name,
                description: subcategory.description,
                isActive: subcategory.isActive,
                displayOrder: subcategory.displayOrder,
                expenseCount: subcategoryTotals._count,
                totalAmount: subcategoryTotals._sum.amount || 0,
                createdAt: subcategory.createdAt,
                updatedAt: subcategory.updatedAt
              };
            })
          );

          return {
            id: category.id,
            name: category.name,
            description: category.description,
            isActive: category.isActive,
            displayOrder: category.displayOrder,
            expenseCount: categoryTotals._count,
            totalAmount: categoryTotals._sum.amount || 0,
            subcategoryCount: category.subcategories.length,
            subcategories: subcategoriesWithAmounts,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt
          };
        })
      );
    } else {
      // Simple structure without amounts (faster)
      structure = categories.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        isActive: category.isActive,
        displayOrder: category.displayOrder,
        subcategoryCount: category.subcategories.length,
        subcategories: category.subcategories.map(subcategory => ({
          id: subcategory.id,
          name: subcategory.name,
          description: subcategory.description,
          isActive: subcategory.isActive,
          displayOrder: subcategory.displayOrder,
          createdAt: subcategory.createdAt,
          updatedAt: subcategory.updatedAt
        })),
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      }));
    }

    // Calculate overall statistics
    const overallStats = includeAmounts === 'true' ? {
      totalCategories: structure.length,
      activeCategories: structure.filter(cat => cat.isActive).length,
      totalSubcategories: structure.reduce((sum, cat) => sum + cat.subcategories.length, 0),
      activeSubcategories: structure.reduce((sum, cat) => 
        sum + cat.subcategories.filter(sub => sub.isActive).length, 0
      ),
      totalExpenses: structure.reduce((sum, cat) => sum + (cat.expenseCount || 0), 0),
      totalAmount: structure.reduce((sum, cat) => sum + (cat.totalAmount || 0), 0)
    } : {
      totalCategories: structure.length,
      activeCategories: structure.filter(cat => cat.isActive).length,
      totalSubcategories: structure.reduce((sum, cat) => sum + cat.subcategories.length, 0),
      activeSubcategories: structure.reduce((sum, cat) => 
        sum + cat.subcategories.filter(sub => sub.isActive).length, 0
      )
    };

    return successResponse(
      res,
      {
        structure,
        statistics: overallStats,
        metadata: {
          includeInactive: includeInactive === 'true',
          includeAmounts: includeAmounts === 'true',
          generatedAt: new Date().toISOString()
        }
      },
      'Expense structure retrieved successfully'
    );
  } catch (error) {
    console.error('Get expense structure error:', error);
    return errorResponse(res, 'Failed to retrieve expense structure', 500);
  }
};

/**
 * Get structure for a specific category
 * GET /api/treasury/expense-structure/:categoryId
 * Access: Public (Read-only for transparency)
 */
const getCategoryStructure = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { includeAmounts = true } = req.query;

    const category = await prisma.expenseCategory.findUnique({
      where: { id: categoryId },
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' }
        }
      }
    });

    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }

    let categoryStructure;

    if (includeAmounts === 'true') {
      // Get category totals
      const categoryTotals = await prisma.expense.aggregate({
        where: { categoryId },
        _sum: { amount: true },
        _count: true
      });

      // Get subcategory details with amounts
      const subcategoriesWithAmounts = await Promise.all(
        category.subcategories.map(async (subcategory) => {
          const subcategoryTotals = await prisma.expense.aggregate({
            where: { subcategoryId: subcategory.id },
            _sum: { amount: true },
            _count: true
          });

          // Get recent expenses for this subcategory
          const recentExpenses = await prisma.expense.findMany({
            where: { subcategoryId: subcategory.id },
            select: {
              id: true,
              amount: true,
              description: true,
              expenseDate: true,
              isApproved: true,
              creator: {
                select: { id: true, fullName: true }
              }
            },
            orderBy: { expenseDate: 'desc' },
            take: 5
          });

          return {
            id: subcategory.id,
            name: subcategory.name,
            description: subcategory.description,
            isActive: subcategory.isActive,
            displayOrder: subcategory.displayOrder,
            expenseCount: subcategoryTotals._count,
            totalAmount: subcategoryTotals._sum.amount || 0,
            recentExpenses,
            createdAt: subcategory.createdAt,
            updatedAt: subcategory.updatedAt
          };
        })
      );

      categoryStructure = {
        id: category.id,
        name: category.name,
        description: category.description,
        isActive: category.isActive,
        displayOrder: category.displayOrder,
        expenseCount: categoryTotals._count,
        totalAmount: categoryTotals._sum.amount || 0,
        subcategoryCount: category.subcategories.length,
        subcategories: subcategoriesWithAmounts,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      };
    } else {
      // Simple structure without amounts
      categoryStructure = {
        id: category.id,
        name: category.name,
        description: category.description,
        isActive: category.isActive,
        displayOrder: category.displayOrder,
        subcategoryCount: category.subcategories.length,
        subcategories: category.subcategories.map(subcategory => ({
          id: subcategory.id,
          name: subcategory.name,
          description: subcategory.description,
          isActive: subcategory.isActive,
          displayOrder: subcategory.displayOrder,
          createdAt: subcategory.createdAt,
          updatedAt: subcategory.updatedAt
        })),
        createdAt: category.createdAt,
        updatedAt: category.updatedAt
      };
    }

    return successResponse(
      res,
      {
        category: categoryStructure,
        metadata: {
          includeAmounts: includeAmounts === 'true',
          generatedAt: new Date().toISOString()
        }
      },
      'Category structure retrieved successfully'
    );
  } catch (error) {
    console.error('Get category structure error:', error);
    return errorResponse(res, 'Failed to retrieve category structure', 500);
  }
};

/**
 * Reorder complete structure (categories and their subcategories)
 * POST /api/treasury/expense-structure/reorder
 * Access: SuperAdmin only
 */
const reorderExpenseStructure = async (req, res) => {
  try {
    const { structure } = req.body;

    if (!Array.isArray(structure) || structure.length === 0) {
      return errorResponse(res, 'Structure array is required', 400);
    }

    // Validate structure format
    for (let i = 0; i < structure.length; i++) {
      const categoryItem = structure[i];
      
      if (!categoryItem.categoryId) {
        return errorResponse(res, `Category ID is required for item ${i}`, 400);
      }

      if (categoryItem.subcategoryIds && !Array.isArray(categoryItem.subcategoryIds)) {
        return errorResponse(res, `Subcategory IDs must be an array for item ${i}`, 400);
      }
    }

    const updatePromises = [];

    // Process each category
    for (let categoryIndex = 0; categoryIndex < structure.length; categoryIndex++) {
      const categoryItem = structure[categoryIndex];
      
      // Update category display order
      updatePromises.push(
        prisma.expenseCategory.update({
          where: { id: categoryItem.categoryId },
          data: { displayOrder: categoryIndex }
        })
      );

      // Update subcategories display order if provided
      if (categoryItem.subcategoryIds && categoryItem.subcategoryIds.length > 0) {
        for (let subcategoryIndex = 0; subcategoryIndex < categoryItem.subcategoryIds.length; subcategoryIndex++) {
          const subcategoryId = categoryItem.subcategoryIds[subcategoryIndex];
          
          updatePromises.push(
            prisma.expenseSubcategory.update({
              where: { id: subcategoryId },
              data: { displayOrder: subcategoryIndex }
            })
          );
        }
      }
    }

    // Execute all updates
    await Promise.all(updatePromises);

    // Get updated structure
    const updatedStructure = await prisma.expenseCategory.findMany({
      include: {
        subcategories: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            displayOrder: true
          }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    const formattedStructure = updatedStructure.map(category => ({
      id: category.id,
      name: category.name,
      displayOrder: category.displayOrder,
      subcategories: category.subcategories
    }));

    return successResponse(
      res,
      {
        structure: formattedStructure,
        reorderedAt: new Date().toISOString()
      },
      'Expense structure reordered successfully'
    );
  } catch (error) {
    console.error('Reorder expense structure error:', error);
    return errorResponse(res, 'Failed to reorder expense structure', 500);
  }
};

/**
 * Get structure statistics
 * GET /api/treasury/expense-structure/statistics
 * Access: Public (Read-only for transparency)
 */
const getStructureStatistics = async (req, res) => {
  try {
    const { year, dateFrom, dateTo } = req.query;

    // Build date filter
    let dateFilter = {};
    if (year) {
      dateFilter = {
        expenseDate: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        }
      };
    } else if (dateFrom || dateTo) {
      dateFilter.expenseDate = {};
      if (dateFrom) dateFilter.expenseDate.gte = new Date(dateFrom);
      if (dateTo) dateFilter.expenseDate.lte = new Date(dateTo);
    }

    // Get basic structure statistics
    const [
      totalCategories,
      activeCategories,
      totalSubcategories,
      activeSubcategories,
      expenseStats
    ] = await Promise.all([
      prisma.expenseCategory.count(),
      prisma.expenseCategory.count({ where: { isActive: true } }),
      prisma.expenseSubcategory.count(),
      prisma.expenseSubcategory.count({ where: { isActive: true } }),
      prisma.expense.aggregate({
        where: dateFilter,
        _sum: { amount: true },
        _count: true
      })
    ]);

    // Get category-wise breakdown
    const categoryBreakdown = await prisma.expenseCategory.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            subcategories: true,
            expenses: {
              where: dateFilter
            }
          }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    // Calculate amounts for each category
    const categoryBreakdownWithAmounts = await Promise.all(
      categoryBreakdown.map(async (category) => {
        const categoryExpenses = await prisma.expense.aggregate({
          where: {
            categoryId: category.id,
            ...dateFilter
          },
          _sum: { amount: true }
        });

        return {
          id: category.id,
          name: category.name,
          isActive: category.isActive,
          subcategoryCount: category._count.subcategories,
          expenseCount: category._count.expenses,
          totalAmount: categoryExpenses._sum.amount || 0
        };
      })
    );

    const statistics = {
      structure: {
        totalCategories,
        activeCategories,
        inactiveCategories: totalCategories - activeCategories,
        totalSubcategories,
        activeSubcategories,
        inactiveSubcategories: totalSubcategories - activeSubcategories
      },
      expenses: {
        totalExpenses: expenseStats._count,
        totalAmount: expenseStats._sum.amount || 0,
        averageExpenseAmount: expenseStats._count > 0 
          ? (expenseStats._sum.amount || 0) / expenseStats._count 
          : 0
      },
      breakdown: categoryBreakdownWithAmounts,
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
      'Structure statistics retrieved successfully'
    );
  } catch (error) {
    console.error('Get structure statistics error:', error);
    return errorResponse(res, 'Failed to retrieve structure statistics', 500);
  }
};

module.exports = {
  getExpenseStructure,
  getCategoryStructure,
  reorderExpenseStructure,
  getStructureStatistics
};