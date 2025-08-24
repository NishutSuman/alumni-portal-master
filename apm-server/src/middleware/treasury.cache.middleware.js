// src/middleware/treasury.cache.middleware.js
const { CacheService } = require("../config/redis");

// ============================================
// TREASURY CACHE KEYS
// ============================================

const TreasuryCacheKeys = {
	// Dashboard and Analytics (Short-term cache due to frequent updates)
	DASHBOARD: "treasury:dashboard",
	DASHBOARD_YEAR: (year) => `treasury:dashboard:${year}`,
	ANALYTICS_COLLECTIONS: "treasury:analytics:collections",
	ANALYTICS_EXPENSES: "treasury:analytics:expenses",
	ANALYTICS_YEARLY_SUMMARY: (year) => `treasury:analytics:yearly:${year}`,
	ANALYTICS_TRENDS: "treasury:analytics:trends",

	// Categories and Structure (Longer cache - rarely changes)
	EXPENSE_CATEGORIES: "treasury:categories",
	EXPENSE_CATEGORY: (id) => `treasury:category:${id}`,
	EXPENSE_SUBCATEGORIES: (categoryId) => `treasury:subcategories:${categoryId}`,
	EXPENSE_SUBCATEGORY: (id) => `treasury:subcategory:${id}`,
	EXPENSE_STRUCTURE: "treasury:structure",

	// Yearly Balance (Medium-term cache)
	YEARLY_BALANCES: "treasury:yearly-balances",
	YEARLY_BALANCE: (year) => `treasury:yearly-balance:${year}`,

	// Account Balance (Short-term cache)
	ACCOUNT_BALANCE: "treasury:account-balance",
	BALANCE_HISTORY: "treasury:balance-history",

	// Lists with filters (Medium-term cache)
	EXPENSES_LIST: (filters) => `treasury:expenses:${generateFilterKey(filters)}`,
	COLLECTIONS_LIST: (filters) =>
		`treasury:collections:${generateFilterKey(filters)}`,

	// Individual entities (Long-term cache - detailed info doesn't change often)
	EXPENSE: (id) => `treasury:expense:${id}`,
	COLLECTION: (id) => `treasury:collection:${id}`,

	// Reports and Exports (Medium-term cache)
	FINANCIAL_REPORT: (year, format) => `treasury:report:${year}:${format}`,
	CATEGORY_REPORT: (categoryId) => `treasury:category-report:${categoryId}`,
	EXPORT_DATA: (type, params) =>
		`treasury:export:${type}:${generateFilterKey(params)}`,
};

// ============================================
// CACHE DURATIONS (in seconds)
// ============================================

const CacheDurations = {
	DASHBOARD: 300, // 5 minutes - frequently updated
	ANALYTICS: 600, // 10 minutes - updated regularly
	CATEGORIES: 3600, // 1 hour - rarely changes
	STRUCTURE: 1800, // 30 minutes - moderate changes
	YEARLY_BALANCE: 1800, // 30 minutes - moderate changes
	ACCOUNT_BALANCE: 300, // 5 minutes - frequently updated
	LISTS: 600, // 10 minutes - moderate updates
	ENTITY: 1800, // 30 minutes - rarely changes once created
	REPORTS: 3600, // 1 hour - expensive to generate
	EXPORTS: 1800, // 30 minutes - expensive to generate
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate consistent filter key from filter object
 */
const generateFilterKey = (filters) => {
	if (!filters || typeof filters !== "object") return "default";

	const sortedKeys = Object.keys(filters).sort();
	const keyParts = sortedKeys.map((key) => `${key}:${filters[key]}`);
	return keyParts.join("|");
};

/**
 * Generate cache key with user context if needed
 */
const generateUserContextKey = (baseKey, req) => {
	// For treasury, most data is public to all users
	// Only role-specific caching might be needed
	if (req.user && req.user.role === "SUPER_ADMIN") {
		return `${baseKey}:admin`;
	}
	return `${baseKey}:public`;
};

// ============================================
// CACHE MIDDLEWARE FUNCTIONS
// ============================================

/**
 * Generic cache middleware factory
 */
const createCacheMiddleware = (keyGenerator, duration, options = {}) => {
	return async (req, res, next) => {
		try {
			const cacheKey =
				typeof keyGenerator === "function" ? keyGenerator(req) : keyGenerator;

			const userContextKey = options.useUserContext
				? generateUserContextKey(cacheKey, req)
				: cacheKey;

			const cachedData = await CacheService.get(userContextKey);

			if (cachedData) {
				return res.json(cachedData);
			}

			// Store original res.json to cache response
			const originalJson = res.json;
			res.json = function (data) {
				const result = originalJson.call(this, data);

				// Cache successful responses only
				if (data.success) {
					setImmediate(() => {
						CacheService.set(userContextKey, data, duration).catch((error) => {
							console.error("Cache set error:", error);
						});
					});
				}

				return result;
			};

			next();
		} catch (error) {
			console.error("Cache middleware error:", error);
			next(); // Continue without cache on error
		}
	};
};

// ============================================
// DASHBOARD AND ANALYTICS CACHE
// ============================================

const cacheDashboard = createCacheMiddleware(
	(req) =>
		req.params.year
			? TreasuryCacheKeys.DASHBOARD_YEAR(req.params.year)
			: TreasuryCacheKeys.DASHBOARD,
	CacheDurations.DASHBOARD
);

const cacheAnalyticsCollections = createCacheMiddleware(
	TreasuryCacheKeys.ANALYTICS_COLLECTIONS,
	CacheDurations.ANALYTICS
);

const cacheAnalyticsExpenses = createCacheMiddleware(
	TreasuryCacheKeys.ANALYTICS_EXPENSES,
	CacheDurations.ANALYTICS
);

const cacheYearlySummary = createCacheMiddleware(
	(req) => TreasuryCacheKeys.ANALYTICS_YEARLY_SUMMARY(req.params.year),
	CacheDurations.ANALYTICS
);

const cacheAnalyticsTrends = createCacheMiddleware(
	TreasuryCacheKeys.ANALYTICS_TRENDS,
	CacheDurations.ANALYTICS
);

// ============================================
// CATEGORIES AND STRUCTURE CACHE
// ============================================

const cacheExpenseCategories = createCacheMiddleware(
	TreasuryCacheKeys.EXPENSE_CATEGORIES,
	CacheDurations.CATEGORIES
);

const cacheExpenseCategory = createCacheMiddleware(
	(req) => TreasuryCacheKeys.EXPENSE_CATEGORY(req.params.categoryId),
	CacheDurations.CATEGORIES
);

const cacheExpenseSubcategories = createCacheMiddleware(
	(req) => TreasuryCacheKeys.EXPENSE_SUBCATEGORIES(req.params.categoryId),
	CacheDurations.CATEGORIES
);

const cacheExpenseSubcategory = createCacheMiddleware(
	(req) => TreasuryCacheKeys.EXPENSE_SUBCATEGORY(req.params.subcategoryId),
	CacheDurations.CATEGORIES
);

const cacheExpenseStructure = createCacheMiddleware(
	TreasuryCacheKeys.EXPENSE_STRUCTURE,
	CacheDurations.STRUCTURE
);

// ============================================
// BALANCE CACHE
// ============================================

const cacheYearlyBalances = createCacheMiddleware(
	TreasuryCacheKeys.YEARLY_BALANCES,
	CacheDurations.YEARLY_BALANCE
);

const cacheYearlyBalance = createCacheMiddleware(
	(req) => TreasuryCacheKeys.YEARLY_BALANCE(req.params.year),
	CacheDurations.YEARLY_BALANCE
);

const cacheAccountBalance = createCacheMiddleware(
	TreasuryCacheKeys.ACCOUNT_BALANCE,
	CacheDurations.ACCOUNT_BALANCE
);

const cacheBalanceHistory = createCacheMiddleware(
	TreasuryCacheKeys.BALANCE_HISTORY,
	CacheDurations.ACCOUNT_BALANCE
);

// ============================================
// LISTS CACHE
// ============================================

const cacheExpensesList = createCacheMiddleware(
	(req) => TreasuryCacheKeys.EXPENSES_LIST(req.query),
	CacheDurations.LISTS
);

const cacheCollectionsList = createCacheMiddleware(
	(req) => TreasuryCacheKeys.COLLECTIONS_LIST(req.query),
	CacheDurations.LISTS
);

// ============================================
// ENTITY CACHE
// ============================================

const cacheExpense = createCacheMiddleware(
	(req) => TreasuryCacheKeys.EXPENSE(req.params.expenseId),
	CacheDurations.ENTITY
);

const cacheCollection = createCacheMiddleware(
	(req) => TreasuryCacheKeys.COLLECTION(req.params.collectionId),
	CacheDurations.ENTITY
);

// ============================================
// REPORTS CACHE
// ============================================

const cacheFinancialReport = createCacheMiddleware(
	(req) =>
		TreasuryCacheKeys.FINANCIAL_REPORT(
			req.params.year,
			req.query.format || "json"
		),
	CacheDurations.REPORTS
);

const cacheCategoryReport = createCacheMiddleware(
	(req) => TreasuryCacheKeys.CATEGORY_REPORT(req.params.categoryId),
	CacheDurations.REPORTS
);

const cacheExportData = createCacheMiddleware(
	(req) => TreasuryCacheKeys.EXPORT_DATA(req.params.type, req.query),
	CacheDurations.EXPORTS
);

// ============================================
// CACHE INVALIDATION FUNCTIONS
// ============================================

/**
 * Invalidate dashboard and analytics cache
 */
const invalidateDashboardCache = async (year = null) => {
	try {
		const patterns = ["treasury:dashboard*", "treasury:analytics*"];

		if (year) {
			patterns.push(`treasury:dashboard:${year}`);
			patterns.push(`treasury:analytics:yearly:${year}`);
		}

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);
	} catch (error) {
		console.error("Dashboard cache invalidation error:", error);
	}
};

/**
 * Invalidate categories cache
 */
const invalidateCategoriesCache = async (categoryId = null) => {
	try {
		const patterns = [
			"treasury:categories",
			"treasury:structure",
			"treasury:subcategories*",
		];

		if (categoryId) {
			patterns.push(`treasury:category:${categoryId}`);
			patterns.push(`treasury:subcategories:${categoryId}`);
		}

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);

		// Also invalidate dashboard as category changes affect analytics
		await invalidateDashboardCache();
	} catch (error) {
		console.error("Categories cache invalidation error:", error);
	}
};

/**
 * Invalidate subcategories cache
 */
const invalidateSubcategoriesCache = async (
	categoryId,
	subcategoryId = null
) => {
	try {
		const patterns = [
			`treasury:subcategories:${categoryId}`,
			"treasury:structure",
		];

		if (subcategoryId) {
			patterns.push(`treasury:subcategory:${subcategoryId}`);
		}

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);

		// Also invalidate dashboard
		await invalidateDashboardCache();
	} catch (error) {
		console.error("Subcategories cache invalidation error:", error);
	}
};

/**
 * Invalidate expenses cache
 */
const invalidateExpensesCache = async (expenseId = null) => {
	try {
		const patterns = ["treasury:expenses*"];

		if (expenseId) {
			patterns.push(`treasury:expense:${expenseId}`);
		}

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);

		// Invalidate dashboard and reports
		await invalidateDashboardCache();
		await CacheService.delPattern("treasury:report*");
	} catch (error) {
		console.error("Expenses cache invalidation error:", error);
	}
};

/**
 * Invalidate collections cache
 */
const invalidateCollectionsCache = async (collectionId = null) => {
	try {
		const patterns = ["treasury:collections*"];

		if (collectionId) {
			patterns.push(`treasury:collection:${collectionId}`);
		}

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);

		// Invalidate dashboard and reports
		await invalidateDashboardCache();
		await CacheService.delPattern("treasury:report*");
	} catch (error) {
		console.error("Collections cache invalidation error:", error);
	}
};

/**
 * Invalidate balance cache
 */
const invalidateBalanceCache = async (year = null) => {
	try {
		const patterns = [
			"treasury:account-balance",
			"treasury:balance-history",
			"treasury:yearly-balances",
		];

		if (year) {
			patterns.push(`treasury:yearly-balance:${year}`);
		}

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);

		// Invalidate dashboard
		await invalidateDashboardCache(year);
	} catch (error) {
		console.error("Balance cache invalidation error:", error);
	}
};

/**
 * Invalidate all treasury cache
 */
const invalidateAllTreasuryCache = async () => {
	try {
		await CacheService.delPattern("treasury:*");
	} catch (error) {
		console.error("All treasury cache invalidation error:", error);
	}
};

// ============================================
// AUTO-INVALIDATION MIDDLEWARE
// ============================================

/**
 * Auto-invalidate cache after successful operations
 */
const autoInvalidateTreasuryCache = (invalidateFunction, ...args) => {
	return async (req, res, next) => {
		const originalJson = res.json;

		res.json = function (data) {
			const result = originalJson.call(this, data);

			if (data.success) {
				setImmediate(async () => {
					try {
						await invalidateFunction(
							...args.map((arg) =>
								typeof arg === "function" ? arg(req, data) : arg
							)
						);
					} catch (error) {
						console.error("Auto cache invalidation error:", error);
					}
				});
			}

			return result;
		};

		next();
	};
};

// Pre-configured auto-invalidation middlewares
const autoInvalidateCategoriesCache = autoInvalidateTreasuryCache(
	invalidateCategoriesCache,
	(req) => req.params.categoryId
);

const autoInvalidateSubcategoriesCache = autoInvalidateTreasuryCache(
	invalidateSubcategoriesCache,
	(req) => req.params.categoryId,
	(req) => req.params.subcategoryId
);

const autoInvalidateExpensesCache = autoInvalidateTreasuryCache(
	invalidateExpensesCache,
	(req) => req.params.expenseId
);

const autoInvalidateCollectionsCache = autoInvalidateTreasuryCache(
	invalidateCollectionsCache,
	(req) => req.params.collectionId
);

const autoInvalidateBalanceCache = autoInvalidateTreasuryCache(
	invalidateBalanceCache,
	(req) => req.params.year
);

const autoInvalidateDashboardCache = autoInvalidateTreasuryCache(
	invalidateDashboardCache,
	(req) => req.params.year
);

// ============================================
// CACHE WARMING FUNCTIONS
// ============================================

/**
 * Warm up treasury cache with frequently accessed data
 */
const warmUpTreasuryCache = async () => {
	try {
		// This would typically be called during server startup
		// or scheduled to run periodically

		console.log("Treasury cache warm-up completed");
	} catch (error) {
		console.error("Treasury cache warm-up error:", error);
	}
};

// ============================================
// PHASE 4: ADDITIONAL CACHE MIDDLEWARE NEEDED
// ============================================

// Add these cache middleware functions to treasury.cache.middleware.js:

const cacheDashboardYear = createCacheMiddleware(
	(req) => TreasuryCacheKeys.DASHBOARD_YEAR(req.params.year),
	CacheDurations.DASHBOARD
);

// ============================================
// EXPORTS
// ============================================

module.exports = {
	// Cache keys
	TreasuryCacheKeys,
	CacheDurations,

	// Cache middleware
	cacheDashboard,
	cacheAnalyticsCollections,
	cacheAnalyticsExpenses,
	cacheYearlySummary,
	cacheAnalyticsTrends,
	cacheExpenseCategories,
	cacheExpenseCategory,
	cacheExpenseSubcategories,
	cacheExpenseSubcategory,
	cacheExpenseStructure,
	cacheYearlyBalances,
	cacheYearlyBalance,
	cacheAccountBalance,
	cacheBalanceHistory,
	cacheExpensesList,
	cacheCollectionsList,
	cacheExpense,
	cacheCollection,
	cacheFinancialReport,
	cacheCategoryReport,
	cacheExportData,
	cacheDashboardYear,

	// Cache invalidation
	invalidateDashboardCache,
	invalidateCategoriesCache,
	invalidateSubcategoriesCache,
	invalidateExpensesCache,
	invalidateCollectionsCache,
	invalidateBalanceCache,
	invalidateAllTreasuryCache,

	// Auto-invalidation middleware
	autoInvalidateCategoriesCache,
	autoInvalidateSubcategoriesCache,
	autoInvalidateExpensesCache,
	autoInvalidateCollectionsCache,
	autoInvalidateBalanceCache,
	autoInvalidateDashboardCache,

	// Utility functions
	createCacheMiddleware,
	generateFilterKey,
	generateUserContextKey,
	warmUpTreasuryCache,
};
