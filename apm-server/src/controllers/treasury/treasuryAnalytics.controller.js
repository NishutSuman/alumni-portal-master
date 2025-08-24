// src/controllers/treasury/treasuryAnalytics.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const TreasuryService = require('../../services/TreasuryService');

// ============================================
// COLLECTION ANALYTICS CONTROLLERS
// ============================================

/**
 * Get comprehensive collection analytics
 * GET /api/treasury/analytics/collections
 * Access: Public (Read-only for transparency)
 */
const getCollectionAnalytics = async (req, res) => {
  try {
    const { year, dateFrom, dateTo } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (year) {
      dateFilter = {
        from: `${year}-01-01`,
        to: `${year}-12-31`
      };
    } else if (dateFrom || dateTo) {
      if (dateFrom) dateFilter.from = dateFrom;
      if (dateTo) dateFilter.to = dateTo;
    }

    const [
      manualCollectionStats,
      onlineCollectionStats,
      modeBreakdown,
      categoryBreakdown,
      monthlyTrends,
      topCollections
    ] = await Promise.all([
      // Manual collection statistics
      TreasuryService.getTotalManualCollections(dateFilter),

      // Online collection statistics
      TreasuryService.getTotalOnlineCollections(dateFilter),

      // Collection mode breakdown
      getCollectionModeBreakdown(dateFilter),

      // Collection category breakdown
      getCollectionCategoryBreakdown(dateFilter),

      // Monthly trends
      getCollectionMonthlyTrends(year || new Date().getFullYear()),

      // Top collections
      getTopCollections(dateFilter, 10)
    ]);

    const totalCollections = manualCollectionStats.totalAmount + onlineCollectionStats.totalAmount;
    const totalCount = manualCollectionStats.collectionCount + onlineCollectionStats.transactionCount;

    const analytics = {
      summary: {
        totalAmount: totalCollections,
        totalCount,
        averageAmount: totalCount > 0 ? totalCollections / totalCount : 0,
        manual: {
          amount: manualCollectionStats.totalAmount,
          count: manualCollectionStats.collectionCount,
          percentage: totalCollections > 0 ? (manualCollectionStats.totalAmount / totalCollections * 100) : 0
        },
        online: {
          amount: onlineCollectionStats.totalAmount,
          count: onlineCollectionStats.transactionCount,
          percentage: totalCollections > 0 ? (onlineCollectionStats.totalAmount / totalCollections * 100) : 0
        }
      },

      breakdown: {
        bySource: [
          {
            source: 'Online Payments',
            amount: onlineCollectionStats.totalAmount,
            count: onlineCollectionStats.transactionCount,
            percentage: totalCollections > 0 ? (onlineCollectionStats.totalAmount / totalCollections * 100) : 0
          },
          {
            source: 'Manual Collections',
            amount: manualCollectionStats.totalAmount,
            count: manualCollectionStats.collectionCount,
            percentage: totalCollections > 0 ? (manualCollectionStats.totalAmount / totalCollections * 100) : 0
          }
        ],
        byMode: modeBreakdown,
        byCategory: categoryBreakdown
      },

      trends: {
        monthly: monthlyTrends,
        growth: calculateGrowthRate(monthlyTrends),
        bestMonth: getBestCollectionMonth(monthlyTrends),
        consistency: calculateConsistency(monthlyTrends.map(m => m.total))
      },

      topCollections,

      insights: {
        averageManualCollection: manualCollectionStats.collectionCount > 0 ? 
          manualCollectionStats.totalAmount / manualCollectionStats.collectionCount : 0,
        averageOnlinePayment: onlineCollectionStats.transactionCount > 0 ? 
          onlineCollectionStats.totalAmount / onlineCollectionStats.transactionCount : 0,
        preferredMode: modeBreakdown.length > 0 ? modeBreakdown[0].mode : null,
        diversityIndex: calculateCollectionDiversityIndex(modeBreakdown, categoryBreakdown)
      },

      period: {
        year: year || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      },

      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { analytics },
      'Collection analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Collection analytics error:', error);
    return errorResponse(res, 'Failed to retrieve collection analytics', 500);
  }
};

/**
 * Get online collections analytics (PaymentTransaction data)
 * GET /api/treasury/analytics/collections/online
 * Access: Public (Read-only for transparency)
 */
const getOnlineCollectionAnalytics = async (req, res) => {
  try {
    const { year, dateFrom, dateTo } = req.query;
    
    // Build date filter for PaymentTransaction
    let whereClause = { status: 'COMPLETED' };
    if (year) {
      whereClause.createdAt = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`)
      };
    } else if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
    }

    const [
      overallStats,
      providerBreakdown,
      referenceTypeBreakdown,
      monthlyTrends,
      recentTransactions
    ] = await Promise.all([
      // Overall statistics
      prisma.paymentTransaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true }
      }),

      // Payment provider breakdown
      prisma.paymentTransaction.groupBy({
        by: ['paymentProvider'],
        where: whereClause,
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: { amount: 'desc' }
        }
      }),

      // Reference type breakdown (what the payments were for)
      prisma.paymentTransaction.groupBy({
        by: ['referenceType'],
        where: whereClause,
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: { amount: 'desc' }
        }
      }),

      // Monthly trends
      getOnlinePaymentMonthlyTrends(year || new Date().getFullYear()),

      // Recent large transactions
      prisma.paymentTransaction.findMany({
        where: whereClause,
        orderBy: { amount: 'desc' },
        take: 10,
        include: {
          user: {
            select: { fullName: true, email: true }
          }
        }
      })
    ]);

    const analytics = {
      summary: {
        totalAmount: overallStats._sum.amount || 0,
        transactionCount: overallStats._count,
        averageAmount: overallStats._avg.amount || 0
      },

      breakdown: {
        byProvider: providerBreakdown.map(provider => ({
          provider: provider.paymentProvider,
          amount: provider._sum.amount || 0,
          count: provider._count,
          percentage: overallStats._sum.amount > 0 ? 
            ((provider._sum.amount || 0) / overallStats._sum.amount * 100) : 0
        })),
        byPurpose: referenceTypeBreakdown.map(ref => ({
          purpose: ref.referenceType,
          amount: ref._sum.amount || 0,
          count: ref._count,
          percentage: overallStats._sum.amount > 0 ? 
            ((ref._sum.amount || 0) / overallStats._sum.amount * 100) : 0
        }))
      },

      trends: {
        monthly: monthlyTrends,
        growth: calculateGrowthRate(monthlyTrends),
        successRate: 100 // Only completed transactions in our data
      },

      topTransactions: recentTransactions.map(transaction => ({
        amount: transaction.amount,
        referenceType: transaction.referenceType,
        paymentProvider: transaction.paymentProvider,
        date: transaction.createdAt,
        user: transaction.user ? {
          name: transaction.user.fullName,
          email: transaction.user.email
        } : null
      })),

      insights: {
        mostUsedProvider: providerBreakdown.length > 0 ? providerBreakdown[0].paymentProvider : null,
        primaryPurpose: referenceTypeBreakdown.length > 0 ? referenceTypeBreakdown[0].referenceType : null,
        averageTransactionSize: overallStats._avg.amount || 0,
        totalRevenue: overallStats._sum.amount || 0
      },

      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { analytics },
      'Online collection analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Online collection analytics error:', error);
    return errorResponse(res, 'Failed to retrieve online collection analytics', 500);
  }
};

/**
 * Get manual collections analytics breakdown
 * GET /api/treasury/analytics/collections/manual
 * Access: Public (Read-only for transparency)
 */
const getManualCollectionAnalytics = async (req, res) => {
  try {
    const { year, dateFrom, dateTo } = req.query;
    
    // Build date filter
    let whereClause = {};
    if (year) {
      whereClause.collectionDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`)
      };
    } else if (dateFrom || dateTo) {
      whereClause.collectionDate = {};
      if (dateFrom) whereClause.collectionDate.gte = new Date(dateFrom);
      if (dateTo) whereClause.collectionDate.lte = new Date(dateTo);
    }

    const [
      overallStats,
      modeBreakdown,
      categoryBreakdown,
      monthlyTrends,
      topCollections,
      verificationStats
    ] = await Promise.all([
      // Overall statistics
      prisma.manualCollection.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true }
      }),

      // Collection mode breakdown
      prisma.manualCollection.groupBy({
        by: ['collectionMode'],
        where: whereClause,
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: { amount: 'desc' }
        }
      }),

      // Category breakdown
      prisma.manualCollection.groupBy({
        by: ['category'],
        where: whereClause,
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: { amount: 'desc' }
        }
      }),

      // Monthly trends
      getManualCollectionMonthlyTrends(year || new Date().getFullYear()),

      // Top collections
      prisma.manualCollection.findMany({
        where: whereClause,
        orderBy: { amount: 'desc' },
        take: 10
      }),

      // Verification statistics
      prisma.manualCollection.groupBy({
        by: ['isVerified'],
        where: whereClause,
        _sum: { amount: true },
        _count: true
      })
    ]);

    const analytics = {
      summary: {
        totalAmount: overallStats._sum.amount || 0,
        collectionCount: overallStats._count,
        averageAmount: overallStats._avg.amount || 0
      },

      breakdown: {
        byMode: modeBreakdown.map(mode => ({
          mode: mode.collectionMode,
          amount: mode._sum.amount || 0,
          count: mode._count,
          percentage: overallStats._sum.amount > 0 ? 
            ((mode._sum.amount || 0) / overallStats._sum.amount * 100) : 0
        })),
        byCategory: categoryBreakdown
          .filter(cat => cat.category) // Remove null categories
          .map(category => ({
            category: category.category,
            amount: category._sum.amount || 0,
            count: category._count,
            percentage: overallStats._sum.amount > 0 ? 
              ((category._sum.amount || 0) / overallStats._sum.amount * 100) : 0
          }))
      },

      verification: {
        verified: {
          amount: verificationStats.find(v => v.isVerified)?.amount || 0,
          count: verificationStats.find(v => v.isVerified)?._count || 0
        },
        unverified: {
          amount: verificationStats.find(v => !v.isVerified)?.amount || 0,
          count: verificationStats.find(v => !v.isVerified)?._count || 0
        },
        verificationRate: overallStats._count > 0 ? 
          ((verificationStats.find(v => v.isVerified)?._count || 0) / overallStats._count * 100) : 0
      },

      trends: {
        monthly: monthlyTrends,
        growth: calculateGrowthRate(monthlyTrends),
        seasonality: calculateSeasonality(monthlyTrends)
      },

      topCollections: topCollections.map(collection => ({
        amount: collection.amount,
        description: collection.description.substring(0, 100),
        mode: collection.collectionMode,
        category: collection.category,
        date: collection.collectionDate,
        isVerified: collection.isVerified
      })),

      insights: {
        preferredMode: modeBreakdown.length > 0 ? modeBreakdown[0].collectionMode : null,
        topCategory: categoryBreakdown.length > 0 ? categoryBreakdown[0].category : null,
        averageCollectionSize: overallStats._avg.amount || 0,
        collectionFrequency: calculateCollectionFrequency(monthlyTrends)
      },

      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { analytics },
      'Manual collection analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Manual collection analytics error:', error);
    return errorResponse(res, 'Failed to retrieve manual collection analytics', 500);
  }
};

// ============================================
// EXPENSE ANALYTICS CONTROLLERS  
// ============================================

/**
 * Get comprehensive expense analytics
 * GET /api/treasury/analytics/expenses
 * Access: Public (Read-only for transparency)
 */
const getExpenseAnalytics = async (req, res) => {
  try {
    const { year, dateFrom, dateTo, categoryId, subcategoryId } = req.query;
    
    // Build date filter
    let dateFilter = {};
    if (year) {
      dateFilter = {
        from: `${year}-01-01`,
        to: `${year}-12-31`
      };
    } else if (dateFrom || dateTo) {
      if (dateFrom) dateFilter.from = dateFrom;
      if (dateTo) dateFilter.to = dateTo;
    }

    const [
      overallStats,
      categoryBreakdown,
      subcategoryBreakdown,
      monthlyTrends,
      topExpenses,
      vendorBreakdown,
      eventExpenses
    ] = await Promise.all([
      // Overall expense statistics
      getExpenseOverallStats(dateFilter, categoryId, subcategoryId),

      // Category breakdown
      TreasuryService.getCategoryBreakdown(dateFilter),

      // Subcategory breakdown (if category specified)
      categoryId ? getSubcategoryBreakdown(categoryId, dateFilter) : Promise.resolve([]),

      // Monthly trends
      getExpenseMonthlyTrends(year || new Date().getFullYear(), categoryId),

      // Top expenses
      getTopExpenses(dateFilter, 10, categoryId, subcategoryId),

      // Vendor breakdown
      getVendorBreakdown(dateFilter, 10),

      // Event-linked expenses
      getEventExpenses(dateFilter)
    ]);

    const analytics = {
      summary: overallStats,

      breakdown: {
        byCategory: categoryBreakdown.breakdown,
        bySubcategory: subcategoryBreakdown,
        byVendor: vendorBreakdown,
        byEvent: eventExpenses
      },

      trends: {
        monthly: monthlyTrends,
        growth: calculateGrowthRate(monthlyTrends),
        seasonality: calculateSeasonality(monthlyTrends),
        peakMonth: getPeakExpenseMonth(monthlyTrends)
      },

      topExpenses,

      insights: {
        mostExpensiveCategory: categoryBreakdown.breakdown.length > 0 ? categoryBreakdown.breakdown[0] : null,
        topVendor: vendorBreakdown.length > 0 ? vendorBreakdown[0] : null,
        averageExpenseSize: overallStats.averageAmount,
        expenseConcentration: calculateExpenseConcentration(categoryBreakdown.breakdown),
        spendingPattern: analyzeSpendingPattern(monthlyTrends)
      },

      filters: {
        year: year || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null
      },

      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { analytics },
      'Expense analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Expense analytics error:', error);
    return errorResponse(res, 'Failed to retrieve expense analytics', 500);
  }
};

/**
 * Get category-wise expense analytics
 * GET /api/treasury/analytics/expenses/by-category
 * Access: Public (Read-only for transparency)
 */
const getCategoryExpenseAnalytics = async (req, res) => {
  try {
    const { year, dateFrom, dateTo } = req.query;
    
    let dateFilter = {};
    if (year) {
      dateFilter = { from: `${year}-01-01`, to: `${year}-12-31` };
    } else if (dateFrom || dateTo) {
      if (dateFrom) dateFilter.from = dateFrom;
      if (dateTo) dateFilter.to = dateTo;
    }

    // Get all categories with their expenses
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    const categoryAnalytics = await Promise.all(
      categories.map(async (category) => {
        const [categoryStats, subcategoryStats, monthlyTrends] = await Promise.all([
          TreasuryService.getCategoryTotalExpenses(category.id, dateFilter),
          Promise.all(
            category.subcategories.map(async (subcategory) => {
              const stats = await TreasuryService.getSubcategoryTotalExpenses(subcategory.id, dateFilter);
              return {
                id: subcategory.id,
                name: subcategory.name,
                ...stats
              };
            })
          ),
          getCategoryMonthlyTrends(category.id, year || new Date().getFullYear())
        ]);

        return {
          category: {
            id: category.id,
            name: category.name,
            description: category.description
          },
          totals: categoryStats,
          subcategories: subcategoryStats.sort((a, b) => b.totalAmount - a.totalAmount),
          trends: {
            monthly: monthlyTrends,
            growth: calculateGrowthRate(monthlyTrends),
            consistency: calculateConsistency(monthlyTrends.map(m => m.amount))
          }
        };
      })
    );

    // Sort by total amount
    categoryAnalytics.sort((a, b) => b.totals.totalAmount - a.totals.totalAmount);

    const totalExpenses = categoryAnalytics.reduce((sum, cat) => sum + cat.totals.totalAmount, 0);

    // Add percentages
    categoryAnalytics.forEach(cat => {
      cat.percentage = totalExpenses > 0 ? (cat.totals.totalAmount / totalExpenses * 100) : 0;
    });

    return successResponse(
      res,
      { 
        categoryAnalytics,
        summary: {
          totalCategories: categoryAnalytics.length,
          totalExpenses,
          averagePerCategory: categoryAnalytics.length > 0 ? totalExpenses / categoryAnalytics.length : 0
        }
      },
      'Category-wise expense analytics retrieved successfully'
    );
  } catch (error) {
    console.error('Category expense analytics error:', error);
    return errorResponse(res, 'Failed to retrieve category expense analytics', 500);
  }
};

// ============================================
// FINANCIAL SUMMARY CONTROLLERS
// ============================================

/**
 * Get yearly financial summary with comprehensive analytics
 * GET /api/treasury/analytics/yearly-summary/:year
 * Access: Public (Read-only for transparency)
 */
const getYearlyFinancialSummary = async (req, res) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year);

    if (isNaN(yearInt) || yearInt < 2020 || yearInt > 2030) {
      return errorResponse(res, 'Invalid year parameter', 400);
    }

    const summary = await TreasuryService.getYearlyFinancialSummary(yearInt);
    
    if (!summary) {
      return errorResponse(res, 'No financial data found for this year', 404);
    }

    // Get additional analytics
    const [
      monthlyBreakdown,
      quarterlyBreakdown,
      categoryPerformance,
      collectionAnalysis
    ] = await Promise.all([
      getYearlyMonthlyBreakdown(yearInt),
      getQuarterlyBreakdown(yearInt),
      getCategoryPerformance(yearInt),
      getYearlyCollectionAnalysis(yearInt)
    ]);

    const enhancedSummary = {
      ...summary,
      breakdown: {
        monthly: monthlyBreakdown,
        quarterly: quarterlyBreakdown,
        categories: categoryPerformance
      },
      collectionAnalysis,
      insights: {
        profitableMonths: monthlyBreakdown.filter(m => m.netMovement > 0).length,
        biggestExpenseMonth: monthlyBreakdown.reduce((max, month) => 
          month.expenses > (max?.expenses || 0) ? month : max, null),
        bestCollectionMonth: monthlyBreakdown.reduce((max, month) => 
          month.collections > (max?.collections || 0) ? month : max, null),
        consistency: {
          expenses: calculateConsistency(monthlyBreakdown.map(m => m.expenses)),
          collections: calculateConsistency(monthlyBreakdown.map(m => m.collections))
        }
      }
    };

    return successResponse(
      res,
      { yearlySummary: enhancedSummary },
      `Yearly financial summary for ${year} retrieved successfully`
    );
  } catch (error) {
    console.error('Yearly financial summary error:', error);
    return errorResponse(res, 'Failed to retrieve yearly financial summary', 500);
  }
};

/**
 * Get current surplus/deficit calculation
 * GET /api/treasury/analytics/surplus-deficit
 * Access: Public (Read-only for transparency)
 */
const getSurplusDeficitAnalysis = async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const [
      currentYearData,
      historicalData,
      projectedData
    ] = await Promise.all([
      TreasuryService.getDashboardSummary(currentYear),
      getHistoricalSurplusDeficit(currentYear - 3, currentYear - 1), // Last 3 years
      getProjectedSurplusDeficit(currentYear)
    ]);

    const analysis = {
      current: {
        year: currentYear,
        surplus: currentYearData?.summary?.netMovement || 0,
        totalCollections: currentYearData?.collections?.online + currentYearData?.collections?.manual || 0,
        totalExpenses: currentYearData?.expenses?.total || 0,
        status: (currentYearData?.summary?.netMovement || 0) > 0 ? 'surplus' : 'deficit'
      },
      historical: historicalData,
      projected: projectedData,
      trends: {
        improving: calculateSurplusDeficitTrend(historicalData, currentYearData?.summary?.netMovement || 0),
        averageHistorical: historicalData.length > 0 ? 
          historicalData.reduce((sum, year) => sum + year.surplus, 0) / historicalData.length : 0
      },
      insights: {
        bestYear: historicalData.reduce((best, current) => 
          current.surplus > (best?.surplus || -Infinity) ? current : best, null),
        worstYear: historicalData.reduce((worst, current) => 
          current.surplus < (worst?.surplus || Infinity) ? current : worst, null),
        volatility: calculateVolatility(historicalData.map(y => y.surplus))
      },
      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { surplusDeficitAnalysis: analysis },
      'Surplus/deficit analysis retrieved successfully'
    );
  } catch (error) {
    console.error('Surplus/deficit analysis error:', error);
    return errorResponse(res, 'Failed to retrieve surplus/deficit analysis', 500);
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getCollectionModeBreakdown(dateFilter) {
  // Implementation for manual collection mode breakdown
  const whereClause = {};
  if (dateFilter.from || dateFilter.to) {
    whereClause.collectionDate = {};
    if (dateFilter.from) whereClause.collectionDate.gte = new Date(dateFilter.from);
    if (dateFilter.to) whereClause.collectionDate.lte = new Date(dateFilter.to);
  }

  return await prisma.manualCollection.groupBy({
    by: ['collectionMode'],
    where: whereClause,
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } }
  });
}

async function getCollectionCategoryBreakdown(dateFilter) {
  const whereClause = {};
  if (dateFilter.from || dateFilter.to) {
    whereClause.collectionDate = {};
    if (dateFilter.from) whereClause.collectionDate.gte = new Date(dateFilter.from);
    if (dateFilter.to) whereClause.collectionDate.lte = new Date(dateFilter.to);
  }

  return await prisma.manualCollection.groupBy({
    by: ['category'],
    where: whereClause,
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } }
  });
}

async function getTopCollections(dateFilter, limit) {
  const whereClause = {};
  if (dateFilter.from || dateFilter.to) {
    whereClause.collectionDate = {};
    if (dateFilter.from) whereClause.collectionDate.gte = new Date(dateFilter.from);
    if (dateFilter.to) whereClause.collectionDate.lte = new Date(dateFilter.to);
  }

  return await prisma.manualCollection.findMany({
    where: whereClause,
    orderBy: { amount: 'desc' },
    take: limit,
    select: {
      amount: true,
      description: true,
      collectionMode: true,
      category: true,
      collectionDate: true,
      isVerified: true
    }
  });
}

function calculateGrowthRate(monthlyData) {
  if (monthlyData.length < 2) return 0;
  
  const firstHalf = monthlyData.slice(0, Math.floor(monthlyData.length / 2));
  const secondHalf = monthlyData.slice(Math.floor(monthlyData.length / 2));
  
  const firstHalfAvg = firstHalf.reduce((sum, month) => sum + (month.total || month.amount || 0), 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, month) => sum + (month.total || month.amount || 0), 0) / secondHalf.length;
  
  return firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100) : 0;
}

function calculateConsistency(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return mean > 0 ? (1 - (stdDev / mean)) * 100 : 0; // Coefficient of variation as consistency
}

// Export all controller functions
module.exports = {
  getCollectionAnalytics,
  getOnlineCollectionAnalytics,
  getManualCollectionAnalytics,
  getExpenseAnalytics,
  getCategoryExpenseAnalytics,
  getYearlyFinancialSummary,
  getSurplusDeficitAnalysis
};