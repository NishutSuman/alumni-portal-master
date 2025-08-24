// src/services/TreasuryService.js
const { prisma } = require('../config/database');

// ============================================
// TREASURY BUSINESS LOGIC SERVICE
// ============================================

class TreasuryService {
  
  // ============================================
  // CATEGORY MANAGEMENT UTILITIES
  // ============================================

  /**
   * Check if category name is unique
   */
  static async isCategoryNameUnique(name, excludeCategoryId = null) {
    try {
      const whereClause = { name: name.trim() };
      if (excludeCategoryId) {
        whereClause.id = { not: excludeCategoryId };
      }

      const existingCategory = await prisma.expenseCategory.findUnique({
        where: { name: name.trim() }
      });

      return !existingCategory || (excludeCategoryId && existingCategory.id === excludeCategoryId);
    } catch (error) {
      console.error('Category name uniqueness check error:', error);
      return false;
    }
  }

  /**
   * Check if subcategory name is unique within category
   */
  static async isSubcategoryNameUnique(categoryId, name, excludeSubcategoryId = null) {
    try {
      const whereClause = { 
        categoryId,
        name: name.trim()
      };
      
      if (excludeSubcategoryId) {
        whereClause.id = { not: excludeSubcategoryId };
      }

      const existingSubcategory = await prisma.expenseSubcategory.findFirst({
        where: whereClause
      });

      return !existingSubcategory;
    } catch (error) {
      console.error('Subcategory name uniqueness check error:', error);
      return false;
    }
  }

  /**
   * Get next display order for category
   */
  static async getNextCategoryDisplayOrder() {
    try {
      const lastCategory = await prisma.expenseCategory.findFirst({
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true }
      });

      return lastCategory ? lastCategory.displayOrder + 1 : 0;
    } catch (error) {
      console.error('Get next category display order error:', error);
      return 0;
    }
  }

  /**
   * Get next display order for subcategory within category
   */
  static async getNextSubcategoryDisplayOrder(categoryId) {
    try {
      const lastSubcategory = await prisma.expenseSubcategory.findFirst({
        where: { categoryId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true }
      });

      return lastSubcategory ? lastSubcategory.displayOrder + 1 : 0;
    } catch (error) {
      console.error('Get next subcategory display order error:', error);
      return 0;
    }
  }

  /**
   * Check if category can be deleted (no expenses, no subcategories)
   */
  static async canDeleteCategory(categoryId) {
    try {
      const categoryWithCounts = await prisma.expenseCategory.findUnique({
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

      if (!categoryWithCounts) {
        return { canDelete: false, reason: 'Category not found' };
      }

      if (categoryWithCounts._count.expenses > 0) {
        return { 
          canDelete: false, 
          reason: 'Category has expenses',
          expenseCount: categoryWithCounts._count.expenses
        };
      }

      if (categoryWithCounts._count.subcategories > 0) {
        return { 
          canDelete: false, 
          reason: 'Category has subcategories',
          subcategoryCount: categoryWithCounts._count.subcategories
        };
      }

      return { canDelete: true };
    } catch (error) {
      console.error('Category deletion check error:', error);
      return { canDelete: false, reason: 'Error checking category' };
    }
  }

  /**
   * Check if subcategory can be deleted (no expenses)
   */
  static async canDeleteSubcategory(subcategoryId) {
    try {
      const subcategoryWithCount = await prisma.expenseSubcategory.findUnique({
        where: { id: subcategoryId },
        include: {
          _count: {
            select: { expenses: true }
          }
        }
      });

      if (!subcategoryWithCount) {
        return { canDelete: false, reason: 'Subcategory not found' };
      }

      if (subcategoryWithCount._count.expenses > 0) {
        return { 
          canDelete: false, 
          reason: 'Subcategory has expenses',
          expenseCount: subcategoryWithCount._count.expenses
        };
      }

      return { canDelete: true };
    } catch (error) {
      console.error('Subcategory deletion check error:', error);
      return { canDelete: false, reason: 'Error checking subcategory' };
    }
  }

  // ============================================
  // EXPENSE MANAGEMENT UTILITIES (PHASE 3)
  // ============================================

  /**
   * Validate expense data and relationships
   */
  static async validateExpenseData(expenseData) {
    try {
      const errors = [];

      // Validate category exists and is active
      if (expenseData.categoryId) {
        const category = await prisma.expenseCategory.findUnique({
          where: { id: expenseData.categoryId },
          select: { id: true, name: true, isActive: true }
        });

        if (!category) {
          errors.push('Category not found');
        } else if (!category.isActive) {
          errors.push('Category is inactive');
        }
      }

      // Validate subcategory exists, is active, and belongs to category
      if (expenseData.subcategoryId) {
        const subcategory = await prisma.expenseSubcategory.findUnique({
          where: { id: expenseData.subcategoryId },
          select: { id: true, name: true, categoryId: true, isActive: true }
        });

        if (!subcategory) {
          errors.push('Subcategory not found');
        } else {
          if (!subcategory.isActive) {
            errors.push('Subcategory is inactive');
          }
          if (expenseData.categoryId && subcategory.categoryId !== expenseData.categoryId) {
            errors.push('Subcategory does not belong to specified category');
          }
        }
      }

      // Validate linked event exists
      if (expenseData.linkedEventId) {
        const event = await prisma.event.findUnique({
          where: { id: expenseData.linkedEventId },
          select: { id: true, title: true }
        });

        if (!event) {
          errors.push('Linked event not found');
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Expense validation error:', error);
      return {
        isValid: false,
        errors: ['Error validating expense data']
      };
    }
  }

  /**
   * Check if expense can be deleted
   */
  static async canDeleteExpense(expenseId) {
    try {
      const expense = await prisma.expense.findUnique({
        where: { id: expenseId },
        select: { 
          id: true, 
          amount: true,
          receiptUrl: true,
          isApproved: true
        }
      });

      if (!expense) {
        return { canDelete: false, reason: 'Expense not found' };
      }

      // In this system, all expenses can be deleted by SuperAdmin
      // But note if there's a receipt that needs cleanup
      return { 
        canDelete: true,
        hasReceipt: !!expense.receiptUrl,
        isApproved: expense.isApproved
      };
    } catch (error) {
      console.error('Expense deletion check error:', error);
      return { canDelete: false, reason: 'Error checking expense' };
    }
  }

  // ============================================
  // COLLECTION MANAGEMENT UTILITIES (PHASE 3)
  // ============================================

  /**
   * Validate manual collection data
   */
  static async validateCollectionData(collectionData) {
    try {
      const errors = [];

      // Validate collection mode
      const validModes = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI_OFFLINE', 'OTHER'];
      if (collectionData.collectionMode && !validModes.includes(collectionData.collectionMode)) {
        errors.push('Invalid collection mode');
      }

      // Validate linked event exists
      if (collectionData.linkedEventId) {
        const event = await prisma.event.findUnique({
          where: { id: collectionData.linkedEventId },
          select: { id: true, title: true }
        });

        if (!event) {
          errors.push('Linked event not found');
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Collection validation error:', error);
      return {
        isValid: false,
        errors: ['Error validating collection data']
      };
    }
  }

  /**
   * Check if manual collection can be deleted
   */
  static async canDeleteCollection(collectionId) {
    try {
      const collection = await prisma.manualCollection.findUnique({
        where: { id: collectionId },
        select: { 
          id: true, 
          amount: true,
          receiptUrl: true,
          isVerified: true
        }
      });

      if (!collection) {
        return { canDelete: false, reason: 'Collection not found' };
      }

      // In this system, all collections can be deleted by SuperAdmin
      return { 
        canDelete: true,
        hasReceipt: !!collection.receiptUrl,
        isVerified: collection.isVerified
      };
    } catch (error) {
      console.error('Collection deletion check error:', error);
      return { canDelete: false, reason: 'Error checking collection' };
    }
  }

  // ============================================
  // FINANCIAL CALCULATIONS
  // ============================================

  /**
   * Calculate total expenses for category
   */
  static async getCategoryTotalExpenses(categoryId, dateFilter = {}) {
    try {
      const whereClause = { categoryId };
      if (dateFilter.from || dateFilter.to) {
        whereClause.expenseDate = {};
        if (dateFilter.from) whereClause.expenseDate.gte = new Date(dateFilter.from);
        if (dateFilter.to) whereClause.expenseDate.lte = new Date(dateFilter.to);
      }

      const result = await prisma.expense.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true
      });

      return {
        totalAmount: result._sum.amount || 0,
        expenseCount: result._count
      };
    } catch (error) {
      console.error('Category total expenses calculation error:', error);
      return { totalAmount: 0, expenseCount: 0 };
    }
  }

  /**
   * Calculate total expenses for subcategory
   */
  static async getSubcategoryTotalExpenses(subcategoryId, dateFilter = {}) {
    try {
      const whereClause = { subcategoryId };
      if (dateFilter.from || dateFilter.to) {
        whereClause.expenseDate = {};
        if (dateFilter.from) whereClause.expenseDate.gte = new Date(dateFilter.from);
        if (dateFilter.to) whereClause.expenseDate.lte = new Date(dateFilter.to);
      }

      const result = await prisma.expense.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true
      });

      return {
        totalAmount: result._sum.amount || 0,
        expenseCount: result._count
      };
    } catch (error) {
      console.error('Subcategory total expenses calculation error:', error);
      return { totalAmount: 0, expenseCount: 0 };
    }
  }

  /**
   * Calculate total manual collections
   */
  static async getTotalManualCollections(dateFilter = {}) {
    try {
      const whereClause = {};
      if (dateFilter.from || dateFilter.to) {
        whereClause.collectionDate = {};
        if (dateFilter.from) whereClause.collectionDate.gte = new Date(dateFilter.from);
        if (dateFilter.to) whereClause.collectionDate.lte = new Date(dateFilter.to);
      }

      const result = await prisma.manualCollection.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true
      });

      return {
        totalAmount: result._sum.amount || 0,
        collectionCount: result._count
      };
    } catch (error) {
      console.error('Total manual collections calculation error:', error);
      return { totalAmount: 0, collectionCount: 0 };
    }
  }

  /**
   * Calculate online collections (from existing PaymentTransaction)
   */
  static async getTotalOnlineCollections(dateFilter = {}) {
    try {
      const whereClause = { status: 'COMPLETED' };
      if (dateFilter.from || dateFilter.to) {
        whereClause.createdAt = {};
        if (dateFilter.from) whereClause.createdAt.gte = new Date(dateFilter.from);
        if (dateFilter.to) whereClause.createdAt.lte = new Date(dateFilter.to);
      }

      const result = await prisma.paymentTransaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true
      });

      return {
        totalAmount: result._sum.amount || 0,
        transactionCount: result._count
      };
    } catch (error) {
      console.error('Total online collections calculation error:', error);
      return { totalAmount: 0, transactionCount: 0 };
    }
  }

  /**
   * Get category breakdown with percentages
   */
  static async getCategoryBreakdown(dateFilter = {}) {
    try {
      // Get all categories
      const categories = await prisma.expenseCategory.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' }
      });

      // Calculate totals for each category
      const breakdown = await Promise.all(
        categories.map(async (category) => {
          const totals = await this.getCategoryTotalExpenses(category.id, dateFilter);
          return {
            id: category.id,
            name: category.name,
            totalAmount: totals.totalAmount,
            expenseCount: totals.expenseCount
          };
        })
      );

      // Calculate overall total
      const overallTotal = breakdown.reduce((sum, cat) => sum + cat.totalAmount, 0);

      // Add percentages
      const breakdownWithPercentages = breakdown.map(category => ({
        ...category,
        percentage: overallTotal > 0 ? (category.totalAmount / overallTotal * 100) : 0
      }));

      return {
        breakdown: breakdownWithPercentages,
        overallTotal,
        dateFilter
      };
    } catch (error) {
      console.error('Category breakdown calculation error:', error);
      return { breakdown: [], overallTotal: 0, dateFilter };
    }
  }

  /**
   * Get financial summary for a year
   */
  static async getYearlyFinancialSummary(year) {
    try {
      const dateFilter = {
        from: `${year}-01-01`,
        to: `${year}-12-31`
      };

      const [
        expenseTotals,
        manualCollectionTotals,
        onlineCollectionTotals,
        yearlyBalance
      ] = await Promise.all([
        this.getCategoryTotalExpenses(null, dateFilter), // All expenses for year
        this.getTotalManualCollections(dateFilter),
        this.getTotalOnlineCollections(dateFilter),
        prisma.yearlyBalance.findUnique({ where: { year: parseInt(year) } })
      ]);

      const totalCollections = manualCollectionTotals.totalAmount + onlineCollectionTotals.totalAmount;
      const totalExpenses = expenseTotals.totalAmount;
      const netMovement = totalCollections - totalExpenses;
      const openingBalance = yearlyBalance?.openingBalance || 0;
      const theoreticalClosing = parseFloat(openingBalance) + netMovement;

      return {
        year: parseInt(year),
        openingBalance,
        closingBalance: yearlyBalance?.closingBalance || null,
        collections: {
          online: onlineCollectionTotals.totalAmount,
          manual: manualCollectionTotals.totalAmount,
          total: totalCollections
        },
        expenses: {
          total: totalExpenses,
          count: expenseTotals.expenseCount
        },
        netMovement,
        theoreticalClosingBalance: theoreticalClosing,
        balanceDifference: yearlyBalance?.closingBalance 
          ? parseFloat(yearlyBalance.closingBalance) - theoreticalClosing 
          : null
      };
    } catch (error) {
      console.error('Yearly financial summary error:', error);
      return null;
    }
  }

  // ============================================
  // VALIDATION UTILITIES
  // ============================================

  /**
   * Validate category hierarchy for reordering
   */
  static async validateCategoryHierarchy(structure) {
    try {
      const errors = [];

      // Check if all category IDs exist
      const categoryIds = structure.map(item => item.categoryId);
      const existingCategories = await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true }
      });

      const existingCategoryIds = existingCategories.map(cat => cat.id);
      const missingCategoryIds = categoryIds.filter(id => !existingCategoryIds.includes(id));

      if (missingCategoryIds.length > 0) {
        errors.push(`Categories not found: ${missingCategoryIds.join(', ')}`);
      }

      // Check if all subcategory IDs exist and belong to their categories
      for (const item of structure) {
        if (item.subcategoryIds && item.subcategoryIds.length > 0) {
          const subcategories = await prisma.expenseSubcategory.findMany({
            where: {
              id: { in: item.subcategoryIds },
              categoryId: item.categoryId
            },
            select: { id: true }
          });

          const foundSubcategoryIds = subcategories.map(sub => sub.id);
          const missingSubcategoryIds = item.subcategoryIds.filter(id => 
            !foundSubcategoryIds.includes(id)
          );

          if (missingSubcategoryIds.length > 0) {
            errors.push(
              `Subcategories not found or don't belong to category ${item.categoryId}: ${missingSubcategoryIds.join(', ')}`
            );
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Category hierarchy validation error:', error);
      return {
        isValid: false,
        errors: ['Error validating category hierarchy']
      };
    }
  }

  /**
   * Validate year parameter
   */
  static validateYear(year) {
    const yearInt = parseInt(year);
    return !isNaN(yearInt) && yearInt >= 2000 && yearInt <= 2050;
  }

  // ============================================
  // SEARCH AND FILTERING UTILITIES
  // ============================================

  /**
   * Build search filters for categories
   */
  static buildCategorySearchFilters(query) {
    const filters = {};

    if (query.search) {
      filters.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    if (query.isActive !== undefined) {
      filters.isActive = query.isActive === 'true';
    }

    return filters;
  }

  /**
   * Build search filters for subcategories
   */
  static buildSubcategorySearchFilters(query, categoryId = null) {
    const filters = {};

    if (categoryId) {
      filters.categoryId = categoryId;
    }

    if (query.search) {
      filters.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    if (query.isActive !== undefined) {
      filters.isActive = query.isActive === 'true';
    }

    return filters;
  }

  /**
   * Build search filters for expenses
   */
  static buildExpenseSearchFilters(query) {
    const filters = {};

    if (query.categoryId) filters.categoryId = query.categoryId;
    if (query.subcategoryId) filters.subcategoryId = query.subcategoryId;
    if (query.eventId) filters.linkedEventId = query.eventId;
    if (query.isApproved !== undefined) filters.isApproved = query.isApproved === 'true';

    if (query.dateFrom || query.dateTo) {
      filters.expenseDate = {};
      if (query.dateFrom) filters.expenseDate.gte = new Date(query.dateFrom);
      if (query.dateTo) filters.expenseDate.lte = new Date(query.dateTo);
    }

    if (query.search) {
      filters.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { vendorName: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    return filters;
  }

  /**
   * Build search filters for manual collections
   */
  static buildCollectionSearchFilters(query) {
    const filters = {};

    if (query.collectionMode) filters.collectionMode = query.collectionMode;
    if (query.category) filters.category = query.category;
    if (query.eventId) filters.linkedEventId = query.eventId;
    if (query.isVerified !== undefined) filters.isVerified = query.isVerified === 'true';

    if (query.dateFrom || query.dateTo) {
      filters.collectionDate = {};
      if (query.dateFrom) filters.collectionDate.gte = new Date(query.dateFrom);
      if (query.dateTo) filters.collectionDate.lte = new Date(query.dateTo);
    }

    if (query.search) {
      filters.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { donorName: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    return filters;
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Format amount for display
   */
  static formatAmount(amount) {
    if (!amount) return '₹0';
    
    // Convert to number if it's a string
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Format with Indian numbering system
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(numAmount);
  }

  /**
   * Generate category summary
   */
  static async getCategorySummary(categoryId) {
    try {
      const category = await prisma.expenseCategory.findUnique({
        where: { id: categoryId },
        include: {
          subcategories: {
            where: { isActive: true },
            select: { id: true, name: true }
          },
          _count: {
            select: {
              expenses: true,
              subcategories: true
            }
          }
        }
      });

      if (!category) return null;

      const totals = await this.getCategoryTotalExpenses(categoryId);

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        isActive: category.isActive,
        totalAmount: totals.totalAmount,
        expenseCount: totals.expenseCount,
        subcategoryCount: category._count.subcategories,
        formattedAmount: this.formatAmount(totals.totalAmount),
        subcategories: category.subcategories
      };
    } catch (error) {
      console.error('Category summary error:', error);
      return null;
    }
  }

  /**
   * Generate expense structure tree for frontend
   */
  static async getStructureTree() {
    try {
      const categories = await prisma.expenseCategory.findMany({
        where: { isActive: true },
        include: {
          subcategories: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            select: {
              id: true,
              name: true,
              description: true,
              displayOrder: true
            }
          }
        },
        orderBy: { displayOrder: 'asc' }
      });

      return categories.map(category => ({
        value: category.id,
        label: category.name,
        description: category.description,
        children: category.subcategories.map(subcategory => ({
          value: subcategory.id,
          label: subcategory.name,
          description: subcategory.description,
          parentId: category.id
        }))
      }));
    } catch (error) {
      console.error('Structure tree generation error:', error);
      return [];
    }
  }

  /**
   * Generate financial dashboard summary
   */
  static async getDashboardSummary(year = null) {
    try {
      const dateFilter = year ? {
        from: `${year}-01-01`,
        to: `${year}-12-31`
      } : {};

      const [
        expenseTotals,
        manualCollectionTotals,
        onlineCollectionTotals,
        categoryBreakdown,
        accountBalance
      ] = await Promise.all([
        this.getCategoryTotalExpenses(null, dateFilter),
        this.getTotalManualCollections(dateFilter),
        this.getTotalOnlineCollections(dateFilter),
        this.getCategoryBreakdown(dateFilter),
        prisma.accountBalance.findFirst({
          orderBy: { balanceDate: 'desc' },
          select: { currentBalance: true, balanceDate: true }
        })
      ]);

      const totalCollections = manualCollectionTotals.totalAmount + onlineCollectionTotals.totalAmount;
      const totalExpenses = expenseTotals.totalAmount;

      return {
        summary: {
          totalCollections,
          totalExpenses,
          netMovement: totalCollections - totalExpenses,
          currentBalance: accountBalance?.currentBalance || 0,
          balanceDate: accountBalance?.balanceDate || null
        },
        collections: {
          online: {
            amount: onlineCollectionTotals.totalAmount,
            count: onlineCollectionTotals.transactionCount
          },
          manual: {
            amount: manualCollectionTotals.totalAmount,
            count: manualCollectionTotals.collectionCount
          }
        },
        expenses: {
          total: totalExpenses,
          count: expenseTotals.expenseCount,
          breakdown: categoryBreakdown.breakdown
        },
        period: year ? `Year ${year}` : 'All Time',
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Dashboard summary error:', error);
      return null;
    }
  }
}

module.exports = TreasuryService;