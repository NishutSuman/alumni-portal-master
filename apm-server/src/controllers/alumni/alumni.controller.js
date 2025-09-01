// src/controllers/alumni.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../../utils/response');

// Alumni Directory Search
const searchAlumni = async (req, res) => {
  const { 
    search, // General search term (name, company, institution)
    batch,
    employmentStatus,
    company,
    institution,
    city,
    state,
    country,
    sortBy = 'fullName',
    sortOrder = 'asc'
  } = req.query;
  
  const { page, limit, skip } = getPaginationParams(req.query, 20);
  
  try {
    // Build dynamic where clause
    const whereClause = {
      isActive: true,
      isProfilePublic: true,
    };
    
    // General search across multiple fields
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
        { workHistory: { some: { companyName: { contains: search, mode: 'insensitive' } } } },
        { workHistory: { some: { jobRole: { contains: search, mode: 'insensitive' } } } },
        { educationHistory: { some: { institution: { contains: search, mode: 'insensitive' } } } },
        { educationHistory: { some: { course: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    
    // Specific filters
    if (batch) {
      whereClause.batch = parseInt(batch);
    }
    
    if (employmentStatus) {
      whereClause.employmentStatus = employmentStatus;
    }
    
    if (company) {
      whereClause.workHistory = {
        some: {
          companyName: { contains: company, mode: 'insensitive' }
        }
      };
    }
    
    if (institution) {
      whereClause.educationHistory = {
        some: {
          institution: { contains: institution, mode: 'insensitive' }
        }
      };
    }
    
    // Address filters
    if (city || state || country) {
      const addressFilter = {};
      if (city) addressFilter.city = { contains: city, mode: 'insensitive' };
      if (state) addressFilter.state = { contains: state, mode: 'insensitive' };
      if (country) addressFilter.country = { contains: country, mode: 'insensitive' };
      
      whereClause.addresses = {
        some: addressFilter
      };
    }
    
    // Valid sort fields
    const validSortFields = ['fullName', 'batch', 'createdAt', 'employmentStatus'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'fullName';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';
    
    // Get total count
    const total = await prisma.user.count({ where: whereClause });
    
    // Get paginated results
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        batch: true,
        bio: true,
        employmentStatus: true,
        profileImage: true,
        email: true,
        whatsappNumber: true,
        alternateNumber: true,
        showEmail: true,
        showPhone: true,
        linkedinUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        youtubeUrl: true,
        portfolioUrl: true,
        createdAt: true,
        workHistory: {
          where: { isCurrentJob: true },
          select: {
            companyName: true,
            jobRole: true,
            companyType: true,
          },
          take: 1,
        },
        educationHistory: {
          orderBy: { toYear: 'desc' },
          select: {
            course: true,
            stream: true,
            institution: true,
            fromYear: true,
            toYear: true,
          },
          take: 1,
        },
        addresses: {
          where: { addressType: 'CURRENT' },
          select: {
            city: true,
            state: true,
            country: true,
          },
          take: 1,
        },
      },
      orderBy: { [sortField]: order },
      skip,
      take: limit,
    });
    
    // Filter sensitive information based on privacy settings
    const sanitizedUsers = users.map(user => ({
      ...user,
      email: user.showEmail ? user.email : null,
      whatsappNumber: user.showPhone ? user.whatsappNumber : null,
      alternateNumber: user.showPhone ? user.alternateNumber : null,
      showEmail: undefined,
      showPhone: undefined,
      currentAddress: user.addresses[0] || null, // Get first address (current) or null
      addresses: undefined, // Remove addresses array from response
    }));
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, sanitizedUsers, pagination, 'Alumni directory retrieved successfully');
    
  } catch (error) {
    console.error('Search alumni error:', error);
    return errorResponse(res, 'Failed to search alumni directory', 500);
  }
};

// Get alumni statistics
const getAlumniStats = async (req, res) => {
  try {
    const [
      totalAlumni,
      batchStats,
      employmentStats,
      recentJoins
    ] = await Promise.all([
      // Total active alumni
      prisma.user.count({
        where: { isActive: true, isProfilePublic: true }
      }),
      
      // Alumni by batch
      prisma.batch.findMany({
        select: {
          year: true,
          name: true,
          totalMembers: true,
        },
        orderBy: { year: 'desc' },
        take: 10,
      }),
      
      // Employment status distribution
      prisma.user.groupBy({
        by: ['employmentStatus'],
        where: { isActive: true, isProfilePublic: true },
        _count: true,
      }),
      
      // Recent joins (last 30 days)
      prisma.user.count({
        where: {
          isActive: true,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);
    
    const stats = {
      totalAlumni,
      recentJoins,
      batchDistribution: batchStats,
      employmentDistribution: employmentStats.map(stat => ({
        status: stat.employmentStatus,
        count: stat._count,
      })),
    };
    
    return successResponse(res, { stats }, 'Alumni statistics retrieved successfully');
    
  } catch (error) {
    console.error('Get alumni stats error:', error);
    return errorResponse(res, 'Failed to retrieve alumni statistics', 500);
  }
};

// Get individual alumni profile (public view)
const getAlumniProfile = async (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        isProfilePublic: true,
      },
      select: {
        id: true,
        fullName: true,
        batch: true,
        bio: true,
        employmentStatus: true,
        profileImage: true,
        email: true,
        whatsappNumber: true,
        alternateNumber: true,
        showEmail: true,
        showPhone: true,
        linkedinUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        youtubeUrl: true,
        portfolioUrl: true,
        createdAt: true,
        educationHistory: {
          orderBy: { fromYear: 'desc' },
          select: {
            id: true,
            course: true,
            stream: true,
            institution: true,
            fromYear: true,
            toYear: true,
            isOngoing: true,
            description: true,
          },
        },
        workHistory: {
          orderBy: { fromYear: 'desc' },
          select: {
            id: true,
            companyName: true,
            jobRole: true,
            companyType: true,
            fromYear: true,
            toYear: true,
            isCurrentJob: true,
            description: true,
          },
        },
        addresses: {
          select: {
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            country: true,
            addressType: true,
          },
        },
      },
    });
    
    if (!user) {
      return errorResponse(res, 'Alumni profile not found or private', 404);
    }
    
    // Filter sensitive information based on privacy settings
    const sanitizedUser = {
      ...user,
      email: user.showEmail ? user.email : null,
      whatsappNumber: user.showPhone ? user.whatsappNumber : null,
      alternateNumber: user.showPhone ? user.alternateNumber : null,
      showEmail: undefined,
      showPhone: undefined,
      currentAddress: user.addresses.find(addr => addr.addressType === 'CURRENT') || null,
      addresses: undefined, // Remove full addresses array
    };
    
    return successResponse(res, { user: sanitizedUser }, 'Alumni profile retrieved successfully');
    
  } catch (error) {
    console.error('Get alumni profile error:', error);
    return errorResponse(res, 'Failed to retrieve alumni profile', 500);
  }
};

module.exports = {
  searchAlumni,
  getAlumniStats,
  getAlumniProfile,
};