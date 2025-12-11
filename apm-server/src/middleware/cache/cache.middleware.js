// src/middleware/cache.middleware.js - COMPLETE VERSION
const { CacheService, CacheKeys } = require("../../config/redis");

// Generic cache middleware
const cache = (keyGenerator, expireInSeconds = 3600) => {
	return async (req, res, next) => {
		try {
			// Generate cache key based on request
			const cacheKey =
				typeof keyGenerator === "function" ? keyGenerator(req) : keyGenerator;

			// Try to get cached data
			const cachedData = await CacheService.get(cacheKey);

			if (cachedData) {
				// Cache hit - return cached data
				console.log(`🎯 Cache hit for: ${cacheKey}`);
				req.cacheHit = true;
				return res.json(cachedData);
			}

			// Cache miss - continue to controller
			console.log(`❌ Cache miss for: ${cacheKey}`);
			req.cacheHit = false;

			// Store original json method
			const originalJson = res.json;

			// Override json method to cache response
			res.json = function (data) {
				// Only cache successful responses
				if (res.statusCode === 200 && data.success) {
					CacheService.set(cacheKey, data, expireInSeconds).catch((err) =>
						console.error("Failed to cache response:", err)
					);
				}

				// Call original json method
				return originalJson.call(this, data);
			};

			// Attach cache key to request for manual cache invalidation
			req.cacheKey = cacheKey;

			next();
		} catch (error) {
			console.error("Cache middleware error:", error);
			// Don't let cache errors break the request
			req.cacheHit = false;
			next();
		}
	};
};

// Specific caching middleware for different endpoints

// Cache user profile (30 minutes)
const cacheUserProfile = cache(
	(req) => CacheKeys.userProfile(req.params.userId || req.user.id),
	30 * 60
);

// Cache batch statistics (2 hours)
const cacheBatchStats = cache(
	(req) => CacheKeys.batchStats(req.params.year),
	2 * 60 * 60
);

// Cache batch members list (1 hour)
const cacheBatchMembers = cache(
	(req) =>
		CacheKeys.batchMembers(req.params.year, req.query.page, req.query.limit),
	60 * 60
);

// Cache posts list (5 minutes for better real-time performance)
const cachePosts = cache((req) => {
	const { category, page, limit, search, status, isPublished, isArchived, sortBy, sortOrder, dateFrom, dateTo, tags } = req.query;

	// Handle both old status parameter and new isPublished/isArchived parameters
	let publishedState;
	if (isPublished !== undefined) {
		publishedState = isPublished === 'true' ? 'published' : 'unpublished';
	} else if (status) {
		publishedState = status;
	} else {
		publishedState = 'published'; // default
	}

	const archivedState = isArchived === 'true' ? 'archived' : 'notarchived';

	// Include user ID in cache key for user-specific data (userReactions)
	const userId = req.user?.id || 'anonymous';

	// Include tenant ID for multi-tenant isolation
	// FIXED: Use req.tenant?.id instead of req.tenantId (tenant middleware sets req.tenant, not req.tenantId)
	const tenantId = req.tenant?.id || 'global';

	// Include sort parameters in cache key
	const sortParams = `${sortBy || 'createdAt'}:${sortOrder || 'desc'}`;

	// Include date range parameters in cache key
	const dateParams = `${dateFrom || 'nostart'}:${dateTo || 'noend'}`;

	// Include tags in cache key (handle array of tags)
	const tagsParam = tags ? (Array.isArray(tags) ? tags.join(',') : tags) : 'notags';

	return `tenant:${tenantId}:posts:${category || "all"}:${publishedState}:${archivedState}:${search || "nosearch"}:user:${userId}:sort:${sortParams}:date:${dateParams}:tags:${tagsParam}:page:${page || 1}:limit:${limit || 10}`;
}, 5 * 60);

// Cache post details (30 minutes) - with tenant isolation
const cachePost = cache((req) => {
	const tenantId = req.tenant?.id || 'global';
	return `tenant:${tenantId}:post:${req.params.postId}`;
}, 30 * 60);

// Cache post comments (20 minutes) - with tenant isolation
const cachePostComments = cache(
	(req) => {
		const tenantId = req.tenant?.id || 'global';
		return `tenant:${tenantId}:post:comments:${req.params.postId}:page:${req.query.page || 1}:limit:${req.query.limit || 10}`;
	},
	20 * 60
);

// Cache post likes (15 minutes) - with tenant isolation
const cachePostLikes = cache(
	(req) => {
		const tenantId = req.tenant?.id || 'global';
		return `tenant:${tenantId}:post:likes:${req.params.postId}:page:${req.query.page || 1}:limit:${req.query.limit || 20}`;
	},
	15 * 60
);

// Cache alumni directory (20 minutes)
const cacheAlumniDirectory = cache((req) => {
	const searchParams = {
		search: req.query.search || "",
		batch: req.query.batch || "",
		employmentStatus: req.query.employmentStatus || "",
		city: req.query.city || "",
		page: req.query.page || 1,
		limit: req.query.limit || 20,
		sortBy: req.query.sortBy || "fullName",
		sortOrder: req.query.sortOrder || "asc",
	};
	return CacheKeys.alumniDirectory(searchParams);
}, 20 * 60);

// Cache alumni stats (4 hours)
const cacheAlumniStats = cache(() => CacheKeys.alumniStats(), 4 * 60 * 60);

// Cache invalidation helpers
class CacheInvalidator {
	// Invalidate user-related caches
	static async invalidateUser(userId) {
		await CacheService.delPattern(`user:${userId}*`);
		await CacheService.delPattern(`user:profile:${userId}*`);
		await CacheService.delPattern(`user:posts:${userId}*`);
		console.log(`🗑️ Invalidated user cache: ${userId}`);
	}

	// Invalidate post-related caches (including likes and comments) - tenant-aware
	static async invalidatePost(postId, tenantId = null) {
		await CacheService.del(CacheKeys.post(postId));
		if (tenantId) {
			// Tenant-specific cache invalidation
			await CacheService.delPattern(`tenant:${tenantId}:posts:*`);
			await CacheService.delPattern(`tenant:${tenantId}:post:${postId}*`);
			await CacheService.delPattern(`tenant:${tenantId}:post:comments:${postId}*`);
			await CacheService.delPattern(`tenant:${tenantId}:post:likes:${postId}*`);
		} else {
			// Global fallback - invalidate all tenant post caches
			await CacheService.delPattern("tenant:*:posts:*");
			await CacheService.delPattern(`*:post:${postId}*`);
		}
		await CacheService.delPattern("posts:*"); // Legacy non-tenant cache invalidation
		await CacheService.delPattern(`post:comments:${postId}*`);
		await CacheService.delPattern(`post:likes:${postId}*`);
		console.log(`🗑️ Invalidated post cache: ${postId} (tenant: ${tenantId || 'all'})`);
	}

	// Invalidate specific post interactions (likes, comments, replies) - tenant-aware
	static async invalidatePostInteractions(postId, tenantId = null) {
		if (tenantId) {
			// Tenant-specific cache invalidation
			await CacheService.delPattern(`tenant:${tenantId}:post:comments:${postId}*`);
			await CacheService.delPattern(`tenant:${tenantId}:post:likes:${postId}*`);
			await CacheService.delPattern(`tenant:${tenantId}:post:${postId}*`);
			await CacheService.delPattern(`tenant:${tenantId}:posts:*`);
		} else {
			// Global fallback
			await CacheService.delPattern(`*:post:comments:${postId}*`);
			await CacheService.delPattern(`*:post:likes:${postId}*`);
			await CacheService.delPattern(`*:post:${postId}*`);
			await CacheService.delPattern("tenant:*:posts:*");
		}
		// Legacy cache invalidation
		await CacheService.delPattern(`post:comments:${postId}*`);
		await CacheService.delPattern(`post:likes:${postId}*`);
		await CacheService.del(CacheKeys.post(postId));
		await CacheService.delPattern("posts:*");
		console.log(`🗑️ Invalidated post interactions cache: ${postId} (tenant: ${tenantId || 'all'})`);
	}

	// Invalidate batch-related caches
	static async invalidateBatch(year) {
		await CacheService.delPattern(`batch:${year}*`);
		await CacheService.delPattern(`batch:members:${year}*`);
		await CacheService.delPattern(`batch:stats:${year}*`);
		console.log(`🗑️ Invalidated batch cache: ${year}`);
	}

	// Invalidate alumni directory
	static async invalidateAlumniDirectory() {
		await CacheService.delPattern("alumni:*");
		console.log("🗑️ Invalidated alumni directory cache");
	}

	// Invalidate all caches (use sparingly)
	static async invalidateAll() {
		await CacheService.delPattern("*");
		console.log("🗑️ Invalidated ALL caches");
	}

	// Invalidate event-related caches
	static async invalidateEvents() {
		await CacheService.delPattern("event:*");
		await CacheService.delPattern("events:*");
		console.log("🗑️ Invalidated event caches");
	}

	// Invalidate specific event
	static async invalidateEvent(eventId, slug = null) {
		await CacheService.del(`event:${eventId}`);
		if (slug) {
			await CacheService.del(`event:slug:${slug}`);
		}
		await CacheService.delPattern(`event:${eventId}:*`);
		console.log(`🗑️ Invalidated event cache: ${eventId}`);
	}
}

// Middleware to invalidate cache after mutations
const invalidateCache = (invalidationFunction) => {
	return async (req, res, next) => {
		// Store original json method
		const originalJson = res.json;

		// Override json method to invalidate cache after successful response
		res.json = function (data) {
			// Only invalidate on successful operations
			if (res.statusCode < 300 && data.success) {
				invalidationFunction(req, res).catch((err) =>
					console.error("Cache invalidation error:", err)
				);
			}

			// Call original json method
			return originalJson.call(this, data);
		};

		next();
	};
};

// Specific cache invalidation middleware

// Invalidate user cache after profile updates
const invalidateUserCache = invalidateCache(async (req) => {
	const userId = req.user.id;
	await CacheInvalidator.invalidateUser(userId);
	await CacheInvalidator.invalidateAlumniDirectory(); // User might appear in directory
});

// Invalidate post cache after post operations (create, update, delete, approve)
const invalidatePostCache = invalidateCache(async (req) => {
	const postId = req.params.postId;
	// FIXED: Use req.tenant?.id instead of req.tenantId
	const tenantId = req.tenant?.id || null;
	if (postId) {
		await CacheInvalidator.invalidatePost(postId, tenantId);
	}

	// Also invalidate general posts cache for new posts
	if (tenantId) {
		await CacheService.delPattern(`tenant:${tenantId}:posts:*`);
	}
	await CacheService.delPattern("posts:*");
});

// Invalidate post interaction cache (likes, comments, replies)
const invalidatePostInteractionCache = invalidateCache(async (req) => {
	const postId = req.params.postId;
	// FIXED: Use req.tenant?.id instead of req.tenantId
	const tenantId = req.tenant?.id || null;
	if (postId) {
		await CacheInvalidator.invalidatePostInteractions(postId, tenantId);
	}
});

// Invalidate batch cache after batch operations
const invalidateBatchCache = invalidateCache(async (req) => {
	const year = req.params.year;
	if (year) {
		await CacheInvalidator.invalidateBatch(year);
	}
});

module.exports = {
	cache,
	cacheUserProfile,
	cacheBatchStats,
	cacheBatchMembers,
	cachePosts,
	cachePost,
	cachePostComments,
	cachePostLikes,
	cacheAlumniDirectory,
	cacheAlumniStats,
	CacheInvalidator,
	invalidateUserCache,
	invalidatePostCache,
	invalidatePostInteractionCache,
	invalidateBatchCache,
};
