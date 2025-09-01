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

// Cache posts list (15 minutes)
const cachePosts = cache((req) => {
	const { category, page, limit, search, status } = req.query;
	return `posts:${category || "all"}:${status || "published"}:${search || "nosearch"}:page:${page || 1}:limit:${limit || 10}`;
}, 15 * 60);

// Cache post details (30 minutes)
const cachePost = cache((req) => CacheKeys.post(req.params.postId), 30 * 60);

// Cache post comments (20 minutes)
const cachePostComments = cache(
	(req) =>
		CacheKeys.postComments(req.params.postId, req.query.page, req.query.limit),
	20 * 60
);

// Cache post likes (15 minutes)
const cachePostLikes = cache(
	(req) =>
		`post:likes:${req.params.postId}:page:${req.query.page || 1}:limit:${req.query.limit || 20}`,
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

	// Invalidate post-related caches (including likes and comments)
	static async invalidatePost(postId) {
		await CacheService.del(CacheKeys.post(postId));
		await CacheService.delPattern("posts:*"); // Invalidate all post lists
		await CacheService.delPattern(`post:comments:${postId}*`); // Invalidate post comments
		await CacheService.delPattern(`post:likes:${postId}*`); // Invalidate post likes
		console.log(`🗑️ Invalidated post cache: ${postId}`);
	}

	// Invalidate specific post interactions (likes, comments, replies)
	static async invalidatePostInteractions(postId) {
		await CacheService.delPattern(`post:comments:${postId}*`); // Invalidate post comments
		await CacheService.delPattern(`post:likes:${postId}*`); // Invalidate post likes
		await CacheService.del(CacheKeys.post(postId)); // Invalidate post details (to update counts)
		console.log(`🗑️ Invalidated post interactions cache: ${postId}`);
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
	if (postId) {
		await CacheInvalidator.invalidatePost(postId);
	}

	// Also invalidate general posts cache for new posts
	await CacheService.delPattern("posts:*");
});

// Invalidate post interaction cache (likes, comments, replies)
const invalidatePostInteractionCache = invalidateCache(async (req) => {
	const postId = req.params.postId;
	if (postId) {
		await CacheInvalidator.invalidatePostInteractions(postId);
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
