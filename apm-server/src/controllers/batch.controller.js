// src/controllers/batch.js
const { prisma } = require('../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../utils/response');

// Get all batches with statistics
const getAllBatches = async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query, 20);
  
  try {
    const total = await prisma.batch.count();
    
    const batches = await prisma.batch.findMany({
      select: {
        id: true,
        year: true,
        name: true,
        description: true,
        totalMembers: true,
        createdAt: true,
        admins: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
          },
        },
      },
      orderBy: { year: 'desc' },
      skip,
      take: limit,
    });
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, batches, pagination, 'Batches retrieved successfully');
    
  } catch (error) {
    console.error('Get batches error:', error);
    return errorResponse(res, 'Failed to retrieve batches', 500);
  }
};

// Get specific batch details
const getBatchDetails = async (req, res) => {
  const { year } = req.params;
  
  try {
    const batch = await prisma.batch.findUnique({
      where: { year: parseInt(year) },
      select: {
        id: true,
        year: true,
        name: true,
        description: true,
        totalMembers: true,
        createdAt: true,
        admins: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
            role: true,
          },
        },
      },
    });
    
    if (!batch) {
      return errorResponse(res, 'Batch not found', 404);
    }
    
    return successResponse(res, { batch }, 'Batch details retrieved successfully');
    
  } catch (error) {
    console.error('Get batch details error:', error);
    return errorResponse(res, 'Failed to retrieve batch details', 500);
  }
};

// Get batch members
const getBatchMembers = async (req, res) => {
  const { year } = req.params;
  const { page, limit, skip } = getPaginationParams(req.query, 20);
  const { search } = req.query;
  
  try {
    // Build where clause
    const whereClause = {
      batch: parseInt(year),
      isActive: true,
      isProfilePublic: true,
    };
    
    if (search) {
      whereClause.fullName = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    const total = await prisma.user.count({ where: whereClause });
    
    const members = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        bio: true,
        employmentStatus: true,
        profileImage: true,
        email: true,
        showEmail: true,
        linkedinUrl: true,
        portfolioUrl: true,
        workHistory: {
          where: { isCurrentJob: true },
          select: {
            companyName: true,
            jobRole: true,
          },
          take: 1,
        },
        educationHistory: {
          orderBy: { toYear: 'desc' },
          select: {
            course: true,
            institution: true,
          },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
      skip,
      take: limit,
    });
    
    // Filter sensitive information based on privacy settings
    const sanitizedMembers = members.map(member => ({
      ...member,
      email: member.showEmail ? member.email : null,
      showEmail: undefined,
    }));
    
    const pagination = calculatePagination(total, page, limit);
    
    return paginatedResponse(res, sanitizedMembers, pagination, 'Batch members retrieved successfully');
    
  } catch (error) {
    console.error('Get batch members error:', error);
    return errorResponse(res, 'Failed to retrieve batch members', 500);
  }
};

// Get batch statistics
const getBatchStats = async (req, res) => {
  const { year } = req.params;
  
  try {
    const [
      batchInfo,
      employmentStats,
      topCompanies,
      topInstitutions
    ] = await Promise.all([
      // Basic batch info
      prisma.batch.findUnique({
        where: { year: parseInt(year) },
        select: {
          year: true,
          name: true,
          totalMembers: true,
        },
      }),
      
      // Employment distribution
      prisma.user.groupBy({
        by: ['employmentStatus'],
        where: { batch: parseInt(year), isActive: true },
        _count: true,
      }),
      
      // Top companies
      prisma.userWorkExperience.groupBy({
        by: ['companyName'],
        where: {
          user: { batch: parseInt(year), isActive: true },
          isCurrentJob: true,
        },
        _count: true,
        orderBy: { _count: { companyName: 'desc' } },
        take: 10,
      }),
      
      // Top educational institutions
      prisma.userEducation.groupBy({
        by: ['institution'],
        where: {
          user: { batch: parseInt(year), isActive: true },
        },
        _count: true,
        orderBy: { _count: { institution: 'desc' } },
        take: 10,
      }),
    ]);
    
    if (!batchInfo) {
      return errorResponse(res, 'Batch not found', 404);
    }
    
    const stats = {
      batchInfo,
      employmentDistribution: employmentStats.map(stat => ({
        status: stat.employmentStatus,
        count: stat._count,
      })),
      topCompanies: topCompanies.map(company => ({
        name: company.companyName,
        count: company._count.companyName,
      })),
      topInstitutions: topInstitutions.map(institution => ({
        name: institution.institution,
        count: institution._count.institution,
      })),
    };
    
    return successResponse(res, { stats }, 'Batch statistics retrieved successfully');
    
  } catch (error) {
    console.error('Get batch stats error:', error);
    return errorResponse(res, 'Failed to retrieve batch statistics', 500);
  }
};

module.exports = {
  getAllBatches,
  getBatchDetails,
  getBatchMembers,
  getBatchStats,
};