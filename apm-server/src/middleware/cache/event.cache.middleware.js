// src/middleware/event.cache.middleware.js
const { CacheService } = require("../../config/redis");

// Event-specific cache keys
class EventCacheKeys {
	// Event category cache keys
	static eventCategories(includeInactive = false) {
		return `event:categories:${includeInactive ? "all" : "active"}`;
	}

	static eventCategory(categoryId) {
		return `event:category:${categoryId}`;
	}

	static categoryEvents(categoryId, page = 1, limit = 10) {
		return `event:category:${categoryId}:events:page:${page}:limit:${limit}`;
	}

	// Event cache keys
	static events(filters = {}) {
		const filterString = Object.keys(filters)
			.sort()
			.map((key) => `${key}:${filters[key] || "all"}`)
			.join(":");
		return `events:list:${filterString}`;
	}

	static event(eventId) {
		return `event:${eventId}`;
	}

	static eventBySlug(slug) {
		return `event:slug:${slug}`;
	}

	// Event sections cache keys
	static eventSections(eventId, includeHidden = false) {
		return `event:${eventId}:sections:${includeHidden ? "all" : "visible"}`;
	}

	static eventSection(eventId, sectionId) {
		return `event:${eventId}:section:${sectionId}`;
	}

	// Event statistics cache keys
	static eventStats(eventId) {
		return `event:${eventId}:stats`;
	}

	static eventRegistrationCount(eventId) {
		return `event:${eventId}:registration:count`;
	}

	// Admin dashboard cache keys
	static adminEventsList(status = "all") {
		return `admin:events:${status}`;
	}

	static eventDashboardStats() {
		return "admin:events:dashboard:stats";
	}

	// Event form cache keys
	static eventForm(eventId) {
		return `event:${eventId}:form`;
	}

	static eventFormFields(eventId) {
		return `event:${eventId}:form:fields`;
	}

	// Registration statistics cache keys (expensive calculations)
	static eventRegistrationStats(eventId) {
		return `event:${eventId}:registration:stats`;
	}

	static eventRegistrationSummary(eventId) {
		return `event:${eventId}:registration:summary`;
	}

	// Admin registration dashboard cache
	static adminRegistrationsList(eventId, filters = {}) {
		const filterString = Object.keys(filters)
			.sort()
			.map((key) => `${key}:${filters[key] || "all"}`)
			.join(":");
		return `admin:event:${eventId}:registrations:${filterString}`;
	}

	// Guest statistics cache keys (expensive calculations)
	static eventGuestStats(eventId) {
		return `event:${eventId}:guest:stats`;
	}

	static eventGuestSummary(eventId) {
		return `event:${eventId}:guest:summary`;
	}

	// Registration guest summary (for specific registration)
	static registrationGuestSummary(registrationId) {
		return `registration:${registrationId}:guest:summary`;
	}

	// Admin guest dashboard cache
	static adminGuestsList(eventId, filters = {}) {
		const filterString = Object.keys(filters)
			.sort()
			.map((key) => `${key}:${filters[key] || "all"}`)
			.join(":");
		return `admin:event:${eventId}:guests:${filterString}`;
	}

	// Combined event statistics (registration + guest stats)
	static eventCombinedStats(eventId) {
		return `event:${eventId}:combined:stats`;
	}

	// Get all cache keys that need invalidation when event form changes
	static getFormRelatedKeys(eventId) {
		return [
			this.eventForm(eventId),
			this.eventFormFields(eventId),
			this.event(eventId), // Event details include form info
		];
	}

	// Get all cache keys that need invalidation when registration changes
	static getRegistrationRelatedKeys(eventId) {
		return [
			this.eventRegistrationStats(eventId),
			this.eventRegistrationSummary(eventId),
			this.eventStats(eventId),
			this.event(eventId), // Event includes registration count
			this.eventCombinedStats(eventId),
		];
	}

	// Get all cache keys that need invalidation when guest changes
	static getGuestRelatedKeys(eventId, registrationId = null) {
		const keys = [
			this.eventGuestStats(eventId),
			this.eventGuestSummary(eventId),
			this.eventStats(eventId),
			this.eventRegistrationStats(eventId),
			this.eventCombinedStats(eventId),
		];

		if (registrationId) {
			keys.push(this.registrationGuestSummary(registrationId));
		}

		return keys;
	}

	// Get all admin dashboard cache keys for an event
	static getAdminDashboardKeys(eventId) {
		return [
			this.adminEventsList(),
			this.eventDashboardStats(),
			this.adminRegistrationsList(eventId),
			this.adminGuestsList(eventId),
		];
	}

	// Merchandise cache keys
	static eventMerchandise(eventId, includeInactive = false) {
		return `event:${eventId}:merchandise:${includeInactive ? "all" : "active"}`;
	}

	static merchandiseItem(eventId, itemId) {
		return `event:${eventId}:merchandise:${itemId}`;
	}

	static userCart(registrationId) {
		return `registration:${registrationId}:cart`;
	}

	static userOrders(registrationId) {
		return `registration:${registrationId}:orders`;
	}

	static merchandiseStats(eventId) {
		return `event:${eventId}:merchandise:stats`;
	}

	static adminMerchandiseOrders(eventId, page = 1, search = "") {
		return `admin:event:${eventId}:orders:page:${page}:search:${search}`;
	}
}

// Generic event cache middleware
const cacheEvent = (keyGenerator, expireInSeconds = 1800) => {
	// 30 minutes default
	return async (req, res, next) => {
		try {
			// Generate cache key based on request
			const cacheKey =
				typeof keyGenerator === "function" ? keyGenerator(req) : keyGenerator;

			// Try to get cached data
			const cachedData = await CacheService.get(cacheKey);

			if (cachedData) {
				// Cache hit - return cached data
				console.log(`🎯 Event cache hit: ${cacheKey}`);
				req.cacheHit = true;
				return res.json(cachedData);
			}

			// Cache miss - continue to controller
			console.log(`❌ Event cache miss: ${cacheKey}`);
			req.cacheHit = false;

			// Store original json method
			const originalJson = res.json;

			// Override json method to cache response
			res.json = function (data) {
				// Only cache successful responses
				if (res.statusCode === 200 && data.success) {
					CacheService.set(cacheKey, data, expireInSeconds).catch((err) =>
						console.error("Failed to cache event response:", err)
					);
				}

				// Call original json method
				return originalJson.call(this, data);
			};

			// Attach cache key to request for manual cache invalidation
			req.cacheKey = cacheKey;

			next();
		} catch (error) {
			console.error("Event cache middleware error:", error);
			// Don't let cache errors break the request
			req.cacheHit = false;
			next();
		}
	};
};

// Specific event caching middleware

// Cache event categories (2 hours)
const cacheEventCategories = cacheEvent(
	(req) => EventCacheKeys.eventCategories(req.query.includeInactive),
	2 * 60 * 60
);

// Cache single event category with events (1 hour)
const cacheEventCategory = cacheEvent((req) => {
	const page = req.query.page || 1;
	const limit = req.query.limit || 10;
	return EventCacheKeys.categoryEvents(req.params.categoryId, page, limit);
}, 60 * 60);

// Cache events list (30 minutes)
const cacheEventsList = cacheEvent((req) => {
	const filters = {
		category: req.query.category,
		status: req.query.status,
		eventMode: req.query.eventMode,
		search: req.query.search,
		upcoming: req.query.upcoming,
		sortBy: req.query.sortBy,
		sortOrder: req.query.sortOrder,
		page: req.query.page || 1,
		limit: req.query.limit || 10,
	};
	return EventCacheKeys.events(filters);
}, 30 * 60);

// Cache single event details (45 minutes)
const cacheEventDetails = cacheEvent((req) => {
	// Support both ID and slug lookup
	return req.params.eventId.length === 25
		? EventCacheKeys.event(req.params.eventId)
		: EventCacheKeys.eventBySlug(req.params.eventId);
}, 45 * 60);

// Cache event sections (1 hour)
const cacheEventSections = cacheEvent(
	(req) =>
		EventCacheKeys.eventSections(req.params.eventId, req.query.includeHidden),
	60 * 60
);

// Cache single event section (1 hour)
const cacheEventSection = cacheEvent(
	(req) =>
		EventCacheKeys.eventSection(req.params.eventId, req.params.sectionId),
	60 * 60
);

// Cache event statistics (20 minutes)
const cacheEventStats = cacheEvent(
	(req) => EventCacheKeys.eventStats(req.params.eventId),
	20 * 60
);

// Cache admin events list (15 minutes)
const cacheAdminEventsList = cacheEvent(
	(req) => EventCacheKeys.adminEventsList(req.query.status),
	15 * 60
);

// Event cache invalidation helpers
class EventCacheInvalidator {
	// Invalidate all event category caches
	static async invalidateCategories() {
		await CacheService.delPattern("event:categories:*");
		await CacheService.delPattern("event:category:*");
		console.log("🗑️ Invalidated event category caches");
	}

	// Invalidate specific category cache
	static async invalidateCategory(categoryId) {
		await CacheService.del(EventCacheKeys.eventCategory(categoryId));
		await CacheService.delPattern(`event:category:${categoryId}:*`);
		console.log(`🗑️ Invalidated category cache: ${categoryId}`);
	}

	// Invalidate all events list caches
	static async invalidateEventsList() {
		await CacheService.delPattern("events:list:*");
		await CacheService.delPattern("admin:events:*");
		console.log("🗑️ Invalidated events list caches");
	}

	// Invalidate specific event cache
	static async invalidateEvent(eventId, slug = null) {
		await CacheService.del(EventCacheKeys.event(eventId));
		if (slug) {
			await CacheService.del(EventCacheKeys.eventBySlug(slug));
		}
		await CacheService.delPattern(`event:${eventId}:*`);
		console.log(`🗑️ Invalidated event cache: ${eventId}`);
	}

	// Invalidate event sections
	static async invalidateEventSections(eventId) {
		await CacheService.delPattern(`event:${eventId}:section*`);
		console.log(`🗑️ Invalidated event sections cache: ${eventId}`);
	}

	// Invalidate event stats and counts
	static async invalidateEventStats(eventId) {
		await CacheService.del(EventCacheKeys.eventStats(eventId));
		await CacheService.del(EventCacheKeys.eventRegistrationCount(eventId));
		console.log(`🗑️ Invalidated event stats cache: ${eventId}`);
	}

	// Invalidate dashboard stats
	static async invalidateDashboardStats() {
		await CacheService.del(EventCacheKeys.eventDashboardStats());
		console.log("🗑️ Invalidated event dashboard stats");
	}

	// Invalidate all event-related caches
	static async invalidateAllEventCaches() {
		await CacheService.delPattern("event:*");
		await CacheService.delPattern("events:*");
		await CacheService.delPattern("admin:events:*");
		console.log("🗑️ Invalidated ALL event caches");
	}

	// Invalidate form-related caches when form is modified
	static async invalidateFormCaches(eventId) {
		try {
			const keys = EventCacheKeys.getFormRelatedKeys(eventId);
			await Promise.all(keys.map((key) => CacheService.del(key)));
			console.log(`🗑️ Invalidated form caches for event ${eventId}`);
		} catch (error) {
			console.error("Failed to invalidate form caches:", error);
		}
	}

	// Invalidate registration-related caches when registration changes
	static async invalidateRegistrationCaches(eventId) {
		try {
			const keys = EventCacheKeys.getRegistrationRelatedKeys(eventId);
			await Promise.all(keys.map((key) => CacheService.del(key)));
			console.log(`🗑️ Invalidated registration caches for event ${eventId}`);
		} catch (error) {
			console.error("Failed to invalidate registration caches:", error);
		}
	}

	// Invalidate guest-related caches when guest changes
	static async invalidateGuestCaches(eventId, registrationId = null) {
		try {
			const keys = EventCacheKeys.getGuestRelatedKeys(eventId, registrationId);
			await Promise.all(keys.map((key) => CacheService.del(key)));
			console.log(`🗑️ Invalidated guest caches for event ${eventId}`);
		} catch (error) {
			console.error("Failed to invalidate guest caches:", error);
		}
	}

	// Invalidate admin dashboard caches
	static async invalidateAdminDashboardCaches(eventId) {
		try {
			const keys = EventCacheKeys.getAdminDashboardKeys(eventId);
			await Promise.all(keys.map((key) => CacheService.del(key)));
			console.log(`🗑️ Invalidated admin dashboard caches for event ${eventId}`);
		} catch (error) {
			console.error("Failed to invalidate admin dashboard caches:", error);
		}
	}

	// Invalidate merchandise caches
	static async invalidateMerchandiseCaches(eventId) {
		try {
			await Promise.all([
				CacheService.delPattern(`event:${eventId}:merchandise:*`),
				CacheService.del(EventCacheKeys.merchandiseStats(eventId)),
				CacheService.delPattern(`admin:event:${eventId}:orders:*`),
			]);
			console.log(`🗑️ Invalidated merchandise caches for event ${eventId}`);
		} catch (error) {
			console.error("Failed to invalidate merchandise caches:", error);
		}
	}

	// Invalidate specific merchandise item cache
	static async invalidateMerchandiseItem(eventId, itemId) {
		try {
			await Promise.all([
				CacheService.del(EventCacheKeys.merchandiseItem(eventId, itemId)),
				// Also invalidate merchandise lists
				CacheService.delPattern(`event:${eventId}:merchandise:*`),
			]);
			console.log(`🗑️ Invalidated merchandise item cache: ${itemId}`);
		} catch (error) {
			console.error("Failed to invalidate merchandise item cache:", error);
		}
	}

	// Invalidate cart caches
	static async invalidateCartCaches(registrationId, eventId = null) {
		try {
			await Promise.all([
				CacheService.del(EventCacheKeys.userCart(registrationId)),
				CacheService.del(EventCacheKeys.userOrders(registrationId)),
				// Also invalidate merchandise stats if eventId provided
				eventId
					? CacheService.del(EventCacheKeys.merchandiseStats(eventId))
					: Promise.resolve(),
			]);
			console.log(
				`🗑️ Invalidated cart caches for registration ${registrationId}`
			);
		} catch (error) {
			console.error("Failed to invalidate cart caches:", error);
		}
	}

	// Invalidate order caches
	static async invalidateOrderCaches(eventId) {
		try {
			await Promise.all([
				CacheService.delPattern(`admin:event:${eventId}:orders:*`),
				CacheService.del(EventCacheKeys.merchandiseStats(eventId)),
				// Also invalidate registration stats as merchandise affects totals
				CacheService.delPattern(`event:${eventId}:registration:stats:*`),
			]);
			console.log(`🗑️ Invalidated order caches for event ${eventId}`);
		} catch (error) {
			console.error("Failed to invalidate order caches:", error);
		}
	}

	// Update the existing invalidateAllEventCaches method
	static async invalidateAllEventCaches(eventId) {
		try {
			await Promise.all([
				this.invalidateFormCaches(eventId),
				this.invalidateRegistrationCaches(eventId),
				this.invalidateGuestCaches(eventId),
				this.invalidateAdminDashboardCaches(eventId),
				// NEW: Add merchandise cache invalidation
				this.invalidateMerchandiseCaches(eventId),
				this.invalidateOrderCaches(eventId),
			]);
			console.log(`☢️ Invalidated ALL caches for event ${eventId}`);
		} catch (error) {
			console.error("Failed to invalidate all event caches:", error);
		}
	}
}

// Cache invalidation middleware for event mutations
const invalidateEventCache = (invalidationFunction) => {
	return async (req, res, next) => {
		// Store original json method
		const originalJson = res.json;

		// Override json method to invalidate cache after successful response
		res.json = function (data) {
			// Only invalidate on successful operations
			if (res.statusCode < 300 && data.success) {
				invalidationFunction(req, res).catch((err) =>
					console.error("Event cache invalidation error:", err)
				);
			}

			// Call original json method
			return originalJson.call(this, data);
		};

		next();
	};
};

// Specific event cache invalidation middleware

// Invalidate category caches after category operations
const invalidateEventCategoryCache = invalidateEventCache(async (req) => {
	const categoryId = req.params.categoryId;

	if (categoryId) {
		await EventCacheInvalidator.invalidateCategory(categoryId);
	}

	// Always invalidate categories list
	await EventCacheInvalidator.invalidateCategories();
});

// Invalidate event caches after event operations
const invalidateEventCacheMiddleware = invalidateEventCache(async (req) => {
	const eventId = req.params.eventId;
	const eventSlug = req.body.slug || req.event?.slug;

	if (eventId) {
		await EventCacheInvalidator.invalidateEvent(eventId, eventSlug);
	}

	// Always invalidate events lists
	await EventCacheInvalidator.invalidateEventsList();
	await EventCacheInvalidator.invalidateDashboardStats();
});

// Invalidate section caches after section operations
const invalidateEventSectionCache = invalidateEventCache(async (req) => {
	const eventId = req.params.eventId;

	if (eventId) {
		await EventCacheInvalidator.invalidateEventSections(eventId);
		// Also invalidate the event details since sections are included
		await EventCacheInvalidator.invalidateEvent(eventId);
	}
});

// Invalidate registration-related caches
const invalidateEventRegistrationCache = invalidateEventCache(async (req) => {
	const eventId = req.params.eventId;

	if (eventId) {
		await EventCacheInvalidator.invalidateEventStats(eventId);
		await EventCacheInvalidator.invalidateEvent(eventId); // Update registration counts in event details
	}
});

// Cache event form (1 hour - forms don't change frequently)
const cacheEventForm = cacheEvent(
	(req) => EventCacheKeys.eventForm(req.params.eventId),
	60 * 60
);

// Cache event form fields (1 hour - fields don't change frequently)
const cacheEventFormFields = cacheEvent(
	(req) => EventCacheKeys.eventFormFields(req.params.eventId),
	60 * 60
);

// Cache registration statistics (15 minutes - expensive calculation)
const cacheRegistrationStats = cacheEvent(
	(req) => EventCacheKeys.eventRegistrationStats(req.params.eventId),
	15 * 60
);

// Cache admin registrations list (10 minutes - for admin dashboard)
const cacheAdminRegistrationsList = cacheEvent((req) => {
	const filters = {
		status: req.query.status,
		search: req.query.search,
		batch: req.query.batch,  // Include batch parameter in cache key
		page: req.query.page || 1,
		limit: req.query.limit || 20,
	};
	return EventCacheKeys.adminRegistrationsList(req.params.eventId, filters);
}, 10 * 60);

// Cache guest statistics (15 minutes - expensive calculation)
const cacheGuestStats = cacheEvent(
	(req) => EventCacheKeys.eventGuestStats(req.params.eventId),
	15 * 60
);

// Cache guest summary (10 minutes)
const cacheGuestSummary = cacheEvent(
	(req) => EventCacheKeys.eventGuestSummary(req.params.eventId),
	10 * 60
);

// Cache registration guest summary (5 minutes)
const cacheRegistrationGuestSummary = cacheEvent(
	(req) => EventCacheKeys.registrationGuestSummary(req.params.registrationId),
	5 * 60
);

// Cache admin guests list (10 minutes - for admin dashboard)
const cacheAdminGuestsList = cacheEvent((req) => {
	const filters = {
		status: req.query.status,
		search: req.query.search,
		mealPreference: req.query.mealPreference,
		page: req.query.page || 1,
		limit: req.query.limit || 20,
	};
	return EventCacheKeys.adminGuestsList(req.params.eventId, filters);
}, 10 * 60);

// Cache combined event statistics (20 minutes - very expensive)
const cacheCombinedEventStats = cacheEvent(
	(req) => EventCacheKeys.eventCombinedStats(req.params.eventId),
	20 * 60
);

// Middleware to automatically invalidate caches after operations
const autoInvalidateFormCaches = (req, res, next) => {
	const originalJson = res.json;

	res.json = function (data) {
		// If operation was successful, invalidate form caches
		if (res.statusCode === 200 && data.success) {
			const eventId = req.params.eventId;
			if (eventId) {
				// Async invalidation - don't wait for it
				EventCacheInvalidator.invalidateFormCaches(eventId);
			}
		}

		return originalJson.call(this, data);
	};

	next();
};

const autoInvalidateRegistrationCaches = (req, res, next) => {
	const originalJson = res.json;

	res.json = function (data) {
		// If operation was successful, invalidate registration caches
		if (res.statusCode === 200 && data.success) {
			const eventId = req.params.eventId;
			if (eventId) {
				// Async invalidation - don't wait for it
				EventCacheInvalidator.invalidateRegistrationCaches(eventId);
			}
		}

		return originalJson.call(this, data);
	};

	next();
};

const autoInvalidateGuestCaches = (req, res, next) => {
	const originalJson = res.json;

	res.json = function (data) {
		// If operation was successful, invalidate guest caches
		if (res.statusCode === 200 && data.success) {
			const eventId = req.params.eventId;
			const registrationId = req.userRegistration?.id;
			if (eventId) {
				// Async invalidation - don't wait for it
				EventCacheInvalidator.invalidateGuestCaches(eventId, registrationId);
			}
		}

		return originalJson.call(this, data);
	};

	next();
};

// Merchandise caching middleware functions

// Cache event merchandise list (30 minutes)
const cacheEventMerchandise = cacheEvent(
	(req) =>
		EventCacheKeys.eventMerchandise(
			req.params.eventId,
			req.query.includeInactive
		),
	30 * 60
);

// Cache single merchandise item (1 hour)
const cacheMerchandiseItem = cacheEvent(
	(req) =>
		EventCacheKeys.merchandiseItem(req.params.eventId, req.params.itemId),
	60 * 60
);

// Cache user cart (5 minutes - shorter due to frequent updates)
const cacheUserCart = cacheEvent(
	(req) => EventCacheKeys.userCart(req.userRegistration.id),
	5 * 60
);

// Cache user orders (15 minutes)
const cacheUserOrders = cacheEvent(
	(req) => EventCacheKeys.userOrders(req.userRegistration.id),
	15 * 60
);

// Cache merchandise statistics (10 minutes)
const cacheMerchandiseStats = cacheEvent(
	(req) => EventCacheKeys.merchandiseStats(req.params.eventId),
	10 * 60
);

// Cache admin merchandise orders (5 minutes)
const cacheAdminMerchandiseOrders = cacheEvent(
	(req) =>
		EventCacheKeys.adminMerchandiseOrders(
			req.params.eventId,
			req.query.page || 1,
			req.query.search || ""
		),
	5 * 60
);

// Auto-invalidation middleware for merchandise operations
const autoInvalidateMerchandiseCaches = (req, res, next) => {
	const originalJson = res.json;

	res.json = function (data) {
		// If operation was successful, invalidate merchandise caches
		if (res.statusCode < 300 && data.success) {
			const eventId = req.params.eventId;
			const itemId = req.params.itemId;

			if (eventId) {
				// Async invalidation - don't wait for it
				if (itemId) {
					EventCacheInvalidator.invalidateMerchandiseItem(eventId, itemId);
				} else {
					EventCacheInvalidator.invalidateMerchandiseCaches(eventId);
				}
			}
		}

		return originalJson.call(this, data);
	};

	next();
};

// Auto-invalidation middleware for cart operations
const autoInvalidateCartCaches = (req, res, next) => {
	const originalJson = res.json;

	res.json = function (data) {
		// If operation was successful, invalidate cart caches
		if (res.statusCode < 300 && data.success) {
			const eventId = req.params.eventId;
			const registrationId = req.userRegistration?.id;

			if (registrationId) {
				// Async invalidation - don't wait for it
				EventCacheInvalidator.invalidateCartCaches(registrationId, eventId);
			}
		}

		return originalJson.call(this, data);
	};

	next();
};

// Auto-invalidation middleware for order operations (checkout)
const autoInvalidateOrderCaches = (req, res, next) => {
	const originalJson = res.json;

	res.json = function (data) {
		// If operation was successful, invalidate order caches
		if (res.statusCode < 300 && data.success) {
			const eventId = req.params.eventId;
			const registrationId = req.userRegistration?.id;

			if (eventId) {
				// Async invalidation - don't wait for it
				EventCacheInvalidator.invalidateOrderCaches(eventId);
				if (registrationId) {
					EventCacheInvalidator.invalidateCartCaches(registrationId, eventId);
				}
			}
		}

		return originalJson.call(this, data);
	};

	next();
};

module.exports = {
	EventCacheKeys,
	cacheEvent,
	cacheEventCategories,
	cacheEventCategory,
	cacheEventsList,
	cacheEventDetails,
	cacheEventSections,
	cacheEventSection,
	cacheEventStats,
	cacheAdminEventsList,
	EventCacheInvalidator,
	invalidateEventCategoryCache,
	invalidateEventCacheMiddleware,
	invalidateEventSectionCache,
	invalidateEventRegistrationCache,

	// NEW: Phase 2 & 3 caching middleware
	cacheEventForm,
	cacheEventFormFields,
	cacheRegistrationStats,
	cacheAdminRegistrationsList,
	cacheGuestStats,
	cacheGuestSummary,
	cacheRegistrationGuestSummary,
	cacheAdminGuestsList,
	cacheCombinedEventStats,

	// Cache invalidation utilities

	autoInvalidateFormCaches,
	autoInvalidateRegistrationCaches,
	autoInvalidateGuestCaches,

	// NEW: Merchandise caching middleware
	cacheEventMerchandise,
	cacheMerchandiseItem,
	cacheUserCart,
	cacheUserOrders,
	cacheMerchandiseStats,
	cacheAdminMerchandiseOrders,

	// NEW: Auto-invalidation middleware
	autoInvalidateMerchandiseCaches,
	autoInvalidateCartCaches,
	autoInvalidateOrderCaches,
};
