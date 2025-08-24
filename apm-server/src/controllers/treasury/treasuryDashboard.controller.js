// src/controllers/treasury/treasuryDashboard.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const TreasuryService = require('../../services/TreasuryService');

// ============================================
// MAIN DASHBOARD CONTROLLERS
// ============================================

/**
 * Get main treasury dashboard with real-time calculations
 * GET /api/treasury/dashboard
 * Access: Public (Read-only for transparency)
 */
const getMainDashboard = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Get current financial data
    const [
      accountBalance,
      yearToDateSummary,
      recentExpenses,
      recentCollections,
      categoryBreakdown,
      monthlyTrends
    ] = await Promise.all([
      // Current account balance
      prisma.accountBalance.findFirst({
        orderBy: { balanceDate: 'desc' },
        select: { 
          currentBalance: true, 
          balanceDate: true,
          updater: { 
            select: { fullName: true } 
          }
        }
      }),

      // Year-to-date summary
      TreasuryService.getDashboardSummary(currentYear),

      // Recent expenses (last 5)
      prisma.expense.findMany({
        take: 5,
        orderBy: { expenseDate: 'desc' },
        include: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } }
        }
      }),

      // Recent collections (last 5)
      prisma.manualCollection.findMany({
        take: 5,
        orderBy: { collectionDate: 'desc' }
      }),

      // Category-wise expense breakdown
      TreasuryService.getCategoryBreakdown({
        from: `${currentYear}-01-01`,
        to: `${currentYear}-12-31`
      }),

      // Monthly trends for current year
      getMonthlyTrends(currentYear)
    ]);

    // Calculate key metrics
    const totalCollections = yearToDateSummary?.collections?.online + yearToDateSummary?.collections?.manual || 0;
    const totalExpenses = yearToDateSummary?.expenses?.total || 0;
    const netMovement = totalCollections - totalExpenses;
    const currentBalance = accountBalance?.currentBalance || 0;

    const dashboardData = {
      // Financial Overview Cards
      overview: {
        currentBalance,
        balanceDate: accountBalance?.balanceDate,
        lastUpdatedBy: accountBalance?.updater?.fullName,
        totalCollections,
        totalExpenses,
        netMovement,
        surplusDeficit: netMovement,
        year: currentYear
      },

      // Collection breakdown
      collections: {
        total: totalCollections,
        online: {
          amount: yearToDateSummary?.collections?.online || 0,
          count: yearToDateSummary?.collections?.online_count || 0,
          percentage: totalCollections > 0 ? 
            ((yearToDateSummary?.collections?.online || 0) / totalCollections * 100) : 0
        },
        manual: {
          amount: yearToDateSummary?.collections?.manual || 0,
          count: yearToDateSummary?.collections?.manual_count || 0,
          percentage: totalCollections > 0 ? 
            ((yearToDateSummary?.collections?.manual || 0) / totalCollections * 100) : 0
        }
      },

      // Expense breakdown
      expenses: {
        total: totalExpenses,
        count: yearToDateSummary?.expenses?.count || 0,
        averageAmount: yearToDateSummary?.expenses?.count > 0 ? 
          totalExpenses / yearToDateSummary.expenses.count : 0,
        categoryBreakdown: categoryBreakdown.breakdown.slice(0, 5) // Top 5 categories
      },

      // Recent activity
      recentActivity: {
        expenses: recentExpenses.map(expense => ({
          id: expense.id,
          amount: expense.amount,
          description: expense.description.substring(0, 50) + (expense.description.length > 50 ? '...' : ''),
          date: expense.expenseDate,
          category: expense.category.name,
          subcategory: expense.subcategory?.name
        })),
        collections: recentCollections.map(collection => ({
          id: collection.id,
          amount: collection.amount,
          description: collection.description.substring(0, 50) + (collection.description.length > 50 ? '...' : ''),
          date: collection.collectionDate,
          mode: collection.collectionMode,
          category: collection.category
        }))
      },

      // Trends
      trends: {
        monthly: monthlyTrends,
        collectionTrend: calculateTrend(monthlyTrends.map(m => m.collections.total)),
        expenseTrend: calculateTrend(monthlyTrends.map(m => m.expenses.total))
      },

      // Summary stats
      summary: {
        totalCategories: categoryBreakdown.breakdown.length,
        activeCategoriesWithExpenses: categoryBreakdown.breakdown.filter(c => c.totalAmount > 0).length,
        averageExpensePerCategory: categoryBreakdown.breakdown.length > 0 ? 
          totalExpenses / categoryBreakdown.breakdown.length : 0,
        financialHealth: getFinancialHealthScore(netMovement, currentBalance, totalExpenses)
      },

      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { dashboard: dashboardData },
      'Treasury dashboard data retrieved successfully'
    );
  } catch (error) {
    console.error('Main dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve dashboard data', 500);
  }
};

/**
 * Get year-specific dashboard
 * GET /api/treasury/dashboard/:year
 * Access: Public (Read-only for transparency)
 */
const getYearlyDashboard = async (req, res) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year);

    if (isNaN(yearInt) || yearInt < 2020 || yearInt > 2030) {
      return errorResponse(res, 'Invalid year parameter', 400);
    }

    const [
      yearlyBalance,
      yearSummary,
      monthlyTrends,
      categoryBreakdown,
      topExpenses,
      topCollections
    ] = await Promise.all([
      // Yearly balance
      prisma.yearlyBalance.findUnique({
        where: { year: yearInt },
        include: {
          creator: { select: { fullName: true } }
        }
      }),

      // Year summary
      TreasuryService.getYearlyFinancialSummary(yearInt),

      // Monthly trends
      getMonthlyTrends(yearInt),

      // Category breakdown for the year
      TreasuryService.getCategoryBreakdown({
        from: `${yearInt}-01-01`,
        to: `${yearInt}-12-31`
      }),

      // Top expenses for the year
      prisma.expense.findMany({
        where: {
          expenseDate: {
            gte: new Date(`${yearInt}-01-01`),
            lte: new Date(`${yearInt}-12-31`)
          }
        },
        take: 10,
        orderBy: { amount: 'desc' },
        include: {
          category: { select: { name: true } },
          subcategory: { select: { name: true } }
        }
      }),

      // Top collections for the year
      prisma.manualCollection.findMany({
        where: {
          collectionDate: {
            gte: new Date(`${yearInt}-01-01`),
            lte: new Date(`${yearInt}-12-31`)
          }
        },
        take: 10,
        orderBy: { amount: 'desc' }
      })
    ]);

    const yearlyDashboard = {
      year: yearInt,
      yearlyBalance: yearlyBalance ? {
        openingBalance: yearlyBalance.openingBalance,
        closingBalance: yearlyBalance.closingBalance,
        isClosingSet: !!yearlyBalance.closingBalance,
        notes: yearlyBalance.notes,
        createdBy: yearlyBalance.creator.fullName
      } : null,

      financialSummary: yearSummary ? {
        collections: yearSummary.collections,
        expenses: yearSummary.expenses,
        netMovement: yearSummary.netMovement,
        theoreticalClosingBalance: yearSummary.theoreticalClosingBalance,
        balanceDifference: yearSummary.balanceDifference
      } : null,

      trends: {
        monthly: monthlyTrends,
        quarterlyPerformance: calculateQuarterlyPerformance(monthlyTrends)
      },

      breakdowns: {
        categoryExpenses: categoryBreakdown.breakdown,
        topExpenses: topExpenses.map(expense => ({
          amount: expense.amount,
          description: expense.description.substring(0, 100),
          date: expense.expenseDate,
          category: expense.category.name,
          subcategory: expense.subcategory?.name
        })),
        topCollections: topCollections.map(collection => ({
          amount: collection.amount,
          description: collection.description.substring(0, 100),
          date: collection.collectionDate,
          mode: collection.collectionMode,
          category: collection.category
        }))
      },

      insights: {
        mostExpensiveCategory: categoryBreakdown.breakdown[0] || null,
        averageMonthlyExpense: monthlyTrends.length > 0 ? 
          monthlyTrends.reduce((sum, month) => sum + month.expenses.total, 0) / monthlyTrends.length : 0,
        averageMonthlyCollection: monthlyTrends.length > 0 ? 
          monthlyTrends.reduce((sum, month) => sum + month.collections.total, 0) / monthlyTrends.length : 0,
        bestPerformingMonth: getBestPerformingMonth(monthlyTrends),
        expenseDistribution: calculateExpenseDistribution(categoryBreakdown.breakdown)
      },

      generatedAt: new Date().toISOString()
    };

    return successResponse(
      res,
      { yearlyDashboard },
      `Dashboard data for ${year} retrieved successfully`
    );
  } catch (error) {
    console.error('Yearly dashboard error:', error);
    return errorResponse(res, 'Failed to retrieve yearly dashboard data', 500);
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get monthly trends for a year
 */
async function getMonthlyTrends(year) {
  try {
    const [monthlyExpenses, monthlyManualCollections, monthlyOnlineCollections] = await Promise.all([
      // Monthly expenses
      prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM expense_date) as month,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM expenses 
        WHERE EXTRACT(YEAR FROM expense_date) = ${year}
        GROUP BY EXTRACT(MONTH FROM expense_date)
        ORDER BY month
      `,

      // Monthly manual collections
      prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM collection_date) as month,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM manual_collections 
        WHERE EXTRACT(YEAR FROM collection_date) = ${year}
        GROUP BY EXTRACT(MONTH FROM collection_date)
        ORDER BY month
      `,

      // Monthly online collections (from PaymentTransaction)
      prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM created_at) as month,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM payment_transactions 
        WHERE EXTRACT(YEAR FROM created_at) = ${year}
          AND status = 'COMPLETED'
        GROUP BY EXTRACT(MONTH FROM created_at)
        ORDER BY month
      `
    ]);

    // Create 12-month array with data
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const expenseData = monthlyExpenses.find(e => parseInt(e.month) === monthNum);
      const manualData = monthlyManualCollections.find(c => parseInt(c.month) === monthNum);
      const onlineData = monthlyOnlineCollections.find(o => parseInt(o.month) === monthNum);

      const expenseAmount = expenseData ? parseFloat(expenseData.total_amount) : 0;
      const manualAmount = manualData ? parseFloat(manualData.total_amount) : 0;
      const onlineAmount = onlineData ? parseFloat(onlineData.total_amount) : 0;
      const totalCollections = manualAmount + onlineAmount;

      return {
        month: monthNum,
        monthName: new Date(year, i).toLocaleString('default', { month: 'long' }),
        expenses: {
          total: expenseAmount,
          count: expenseData ? parseInt(expenseData.count) : 0
        },
        collections: {
          total: totalCollections,
          manual: manualAmount,
          online: onlineAmount,
          manualCount: manualData ? parseInt(manualData.count) : 0,
          onlineCount: onlineData ? parseInt(onlineData.count) : 0
        },
        netMovement: totalCollections - expenseAmount,
        balance: totalCollections - expenseAmount // Running balance would need additional calculation
      };
    });
  } catch (error) {
    console.error('Monthly trends error:', error);
    return [];
  }
}

/**
 * Calculate trend direction (positive/negative/stable)
 */
function calculateTrend(values) {
  if (values.length < 2) return 'stable';
  
  const recent = values.slice(-3); // Last 3 values
  const older = values.slice(-6, -3); // Previous 3 values
  
  if (recent.length === 0 || older.length === 0) return 'stable';
  
  const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
  
  const changePercentage = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg * 100) : 0;
  
  if (changePercentage > 5) return 'increasing';
  if (changePercentage < -5) return 'decreasing';
  return 'stable';
}

/**
 * Calculate financial health score (0-100)
 */
function getFinancialHealthScore(netMovement, currentBalance, totalExpenses) {
  let score = 50; // Base score
  
  // Positive net movement adds to score
  if (netMovement > 0) {
    score += 20;
  } else if (netMovement < 0) {
    score -= 20;
  }
  
  // Current balance relative to yearly expenses
  if (totalExpenses > 0) {
    const balanceRatio = parseFloat(currentBalance) / totalExpenses;
    if (balanceRatio > 1) score += 20;
    else if (balanceRatio > 0.5) score += 10;
    else if (balanceRatio < 0.1) score -= 20;
  }
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate quarterly performance
 */
function calculateQuarterlyPerformance(monthlyData) {
  const quarters = [
    { name: 'Q1', months: [1, 2, 3] },
    { name: 'Q2', months: [4, 5, 6] },
    { name: 'Q3', months: [7, 8, 9] },
    { name: 'Q4', months: [10, 11, 12] }
  ];

  return quarters.map(quarter => {
    const quarterData = monthlyData.filter(month => quarter.months.includes(month.month));
    
    const totalExpenses = quarterData.reduce((sum, month) => sum + month.expenses.total, 0);
    const totalCollections = quarterData.reduce((sum, month) => sum + month.collections.total, 0);
    
    return {
      quarter: quarter.name,
      expenses: totalExpenses,
      collections: totalCollections,
      netMovement: totalCollections - totalExpenses,
      monthCount: quarterData.length
    };
  });
}

/**
 * Get best performing month (highest net movement)
 */
function getBestPerformingMonth(monthlyData) {
  if (monthlyData.length === 0) return null;
  
  return monthlyData.reduce((best, current) => 
    current.netMovement > (best?.netMovement || -Infinity) ? current : best
  );
}

/**
 * Calculate expense distribution (high/medium/low spending categories)
 */
function calculateExpenseDistribution(categoryBreakdown) {
  if (categoryBreakdown.length === 0) return { high: 0, medium: 0, low: 0 };
  
  const amounts = categoryBreakdown.map(cat => cat.totalAmount).sort((a, b) => b - a);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  
  if (total === 0) return { high: 0, medium: 0, low: 0 };
  
  const top20Percent = amounts.slice(0, Math.max(1, Math.ceil(amounts.length * 0.2)));
  const middle60Percent = amounts.slice(top20Percent.length, Math.ceil(amounts.length * 0.8));
  const bottom20Percent = amounts.slice(Math.ceil(amounts.length * 0.8));
  
  return {
    high: top20Percent.reduce((sum, amount) => sum + amount, 0) / total * 100,
    medium: middle60Percent.reduce((sum, amount) => sum + amount, 0) / total * 100,
    low: bottom20Percent.reduce((sum, amount) => sum + amount, 0) / total * 100
  };
}

module.exports = {
  getMainDashboard,
  getYearlyDashboard
};