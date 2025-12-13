// src/controllers/demo/marquee.controller.js
const { PrismaClient } = require('@prisma/client');
const redisClient = require('../../config/redis');

const prisma = new PrismaClient();

const MARQUEE_SIZE = 30; // 15 per row x 2 rows
const CACHE_TTL = 604800; // 7 days in seconds
const TOTAL_DUMMY_IMAGES = 35;

/**
 * Shuffle array using Fisher-Yates algorithm
 */
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Get marquee profile pictures with tenant isolation
 * Returns 16 images: mix of real users + dummy images
 * Cached for 7 days in Redis
 */
const getMarqueeProfiles = async (req, res) => {
  try {
    // Extract tenant info from request (set by optionalTenantMiddleware from X-Tenant-Code header)
    const organizationId = req.tenant?.id;

    // Debug logging
    console.log('🏢 Marquee - Tenant debug:', {
      tenantCode: req.headers['x-tenant-code'],
      reqTenant: req.tenant ? { id: req.tenant.id, name: req.tenant.name, tenantCode: req.tenant.tenantCode } : null,
      organizationId
    });

    // SECURITY: Do NOT fall back to a random organization!
    // If no tenant is set, the frontend should be sending X-Tenant-Code header
    if (!organizationId) {
      console.warn('⚠️ Marquee: No organization ID from tenant middleware. X-Tenant-Code header:', req.headers['x-tenant-code']);
      return res.json({
        success: true,
        data: [],
        message: 'No organization context'
      });
    }

    console.log('✅ Marquee: Using organization ID:', organizationId, 'from tenant:', req.tenant?.name);

    // Check Redis cache first
    const cacheKey = `marquee:profiles:v3:${organizationId}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Marquee cache HIT for organization: ${organizationId}`);
        return res.json({
          success: true,
          data: JSON.parse(cachedData),
          cached: true
        });
      }
    } catch (cacheError) {
      console.error('Redis cache read error:', cacheError);
      // Continue without cache if Redis fails
    }

    console.log(`🎯 Marquee cache MISS for organization: ${organizationId}, fetching from DB...`);

    // Fetch real users with profile pictures (TENANT ISOLATED)
    const realUsers = await prisma.user.findMany({
      where: {
        organizationId: organizationId, // 🔒 MULTI-TENANT FILTER
        profileImage: { not: null },
        isActive: true
      },
      select: {
        id: true,
        profileImage: true,
        fullName: true
      },
      take: 100 // Get pool for randomness
    });

    console.log(`📊 Found ${realUsers.length} real users with profile pictures for org: ${organizationId}`);

    let finalImages = [];

    // Get tenant code for URL (to pass to image proxy)
    const tenant = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { tenantCode: true }
    });
    const tenantCode = tenant?.tenantCode || 'default';

    if (realUsers.length >= MARQUEE_SIZE) {
      // Enough real users, randomly pick 16
      const shuffled = shuffleArray(realUsers);
      finalImages = shuffled.slice(0, MARQUEE_SIZE).map(user => ({
        id: user.id,
        type: 'real',
        // Return relative path - frontend will construct full URL
        profileImage: `/api/users/profile-picture/${user.id}?tenant=${tenantCode}`
      }));
    } else {
      // Mix real + dummy images
      const dummyCount = MARQUEE_SIZE - realUsers.length;

      // Randomly select dummy images from pool of 35
      const allDummyIndices = Array.from({ length: TOTAL_DUMMY_IMAGES }, (_, i) => i + 1);
      const shuffledDummyIndices = shuffleArray(allDummyIndices);
      const selectedDummyIndices = shuffledDummyIndices.slice(0, dummyCount);

      const dummyImages = selectedDummyIndices.map(num => ({
        id: `dummy-pp${num}`,
        type: 'dummy',
        // Return relative path - frontend will construct full URL
        profileImage: `/api/users/profile-picture/dummy-pp${num}?tenant=${tenantCode}`
      }));

      const realImages = realUsers.map(user => ({
        id: user.id,
        type: 'real',
        // Return relative path - frontend will construct full URL
        profileImage: `/api/users/profile-picture/${user.id}?tenant=${tenantCode}`
      }));

      // Combine and shuffle
      const combined = [...realImages, ...dummyImages];
      finalImages = shuffleArray(combined);
    }

    console.log(`✅ Generated ${finalImages.length} marquee images (${realUsers.length} real, ${MARQUEE_SIZE - realUsers.length} dummy)`);

    // Cache in Redis for 7 days
    try {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(finalImages));
      console.log(`💾 Cached marquee data for organization: ${organizationId} (TTL: 7 days)`);
    } catch (cacheError) {
      console.error('Redis cache write error:', cacheError);
      // Continue without caching if Redis fails
    }

    // Set cache headers for browser caching
    res.set({
      'Cache-Control': `public, max-age=${CACHE_TTL}`, // 7 days
      'ETag': `marquee-${organizationId}-v1`
    });

    return res.json({
      success: true,
      data: finalImages,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error fetching marquee profiles:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch marquee profiles',
      error: error.message
    });
  }
};

module.exports = {
  getMarqueeProfiles
};
