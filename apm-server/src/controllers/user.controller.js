// src/controllers/user.js
const { prisma } = require('../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../utils/response');

// Update user profile
const updateProfile = async (req, res) => {
  const { 
    fullName, 
    dateOfBirth, 
    whatsappNumber, 
    alternateNumber, 
    bio, 
    employmentStatus, 
    linkedinUrl, 
    instagramUrl, 
    facebookUrl, 
    twitterUrl, 
    youtubeUrl,
    portfolioUrl,
    isProfilePublic,
    showEmail,
    showPhone
  } = req.body;
  
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName && { fullName }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(whatsappNumber !== undefined && { whatsappNumber }),
        ...(alternateNumber !== undefined && { alternateNumber }),
        ...(bio !== undefined && { bio }),
        ...(employmentStatus && { employmentStatus }),
        ...(linkedinUrl !== undefined && { linkedinUrl }),
        ...(instagramUrl !== undefined && { instagramUrl }),
        ...(facebookUrl !== undefined && { facebookUrl }),
        ...(twitterUrl !== undefined && { twitterUrl }),
        ...(youtubeUrl !== undefined && { youtubeUrl }),
        ...(portfolioUrl !== undefined && { portfolioUrl }),
        ...(isProfilePublic !== undefined && { isProfilePublic }),
        ...(showEmail !== undefined && { showEmail }),
        ...(showPhone !== undefined && { showPhone }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        batch: true,
        dateOfBirth: true,
        whatsappNumber: true,
        alternateNumber: true,
        bio: true,
        employmentStatus: true,
        profileImage: true,
        linkedinUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        twitterUrl: true,
        youtubeUrl: true,
        portfolioUrl: true,
        isProfilePublic: true,
        showEmail: true,
        showPhone: true,
        updatedAt: true,
      },
    });
    
    // Log profile update
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'profile_update',
        details: { fields: Object.keys(req.body) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { user: updatedUser }, 'Profile updated successfully');
    
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse(res, 'Failed to update profile', 500);
  }
};

// Add or update address
const updateAddress = async (req, res) => {
  const { addressType } = req.params; // 'permanent' or 'current'
  const { addressLine1, addressLine2, city, state, postalCode, country } = req.body;
  
  // Validation
  if (!addressLine1 || !city || !state || !postalCode) {
    return errorResponse(res, 'Address line 1, city, state, and postal code are required', 400);
  }
  
  if (!['permanent', 'current'].includes(addressType.toLowerCase())) {
    return errorResponse(res, 'Invalid address type. Must be "permanent" or "current"', 400);
  }
  
  try {
    const addressData = {
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country: country || 'India',
      addressType: addressType.toUpperCase(),
    };
    
    const address = await prisma.userAddress.upsert({
      where: {
        userId_addressType: {
          userId: req.user.id,
          addressType: addressType.toUpperCase(),
        },
      },
      update: addressData,
      create: {
        ...addressData,
        userId: req.user.id,
      },
    });
    
    // Log address update
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: `address_${addressType}_update`,
        details: {
          addressType,
          city,
          state,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { address }, `${addressType} address updated successfully`);
    
  } catch (error) {
    console.error('Update address error:', error);
    return errorResponse(res, 'Failed to update address', 500);
  }
};

// Get user addresses
const getAddresses = async (req, res) => {
  try {
    // Get user addresses 
    const addresses = await prisma.userAddress.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        addressType: true,
        updatedAt: true,
      },
    });
    
    // Convert to object for easier frontend consumption
    const addressObj = addresses.reduce((acc, addr) => {
      acc[addr.addressType.toLowerCase()] = addr;
      return acc;
    }, {});
    
    return successResponse(res, { addresses: addressObj }, 'Addresses retrieved successfully');
    
  } catch (error) {
    console.error('Get addresses error:', error);
    return errorResponse(res, 'Failed to retrieve addresses', 500);
  }
};

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

// Add education entry
const addEducation = async (req, res) => {
  const { course, stream, institution, fromYear, toYear, isOngoing, description } = req.body;
  
  // Validation
  if (!course || !institution || !fromYear) {
    return errorResponse(res, 'Course, institution, and from year are required', 400);
  }
  
  if (!isOngoing && !toYear) {
    return errorResponse(res, 'To year is required when not ongoing', 400);
  }
  
  if (toYear && fromYear > toYear) {
    return errorResponse(res, 'From year cannot be later than to year', 400);
  }
  
  try {
    const education = await prisma.userEducation.create({
      data: {
        userId: req.user.id,
        course,
        stream,
        institution,
        fromYear: parseInt(fromYear),
        toYear: toYear ? parseInt(toYear) : null,
        isOngoing: Boolean(isOngoing),
        description,
      },
    });
    
    // Log education addition
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'education_add',
        details: {
          course,
          institution,
          fromYear,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { education }, 'Education added successfully', 201);
    
  } catch (error) {
    console.error('Add education error:', error);
    return errorResponse(res, 'Failed to add education', 500);
  }
};

// Update education entry
const updateEducation = async (req, res) => {
  const { educationId } = req.params;
  const { course, stream, institution, fromYear, toYear, isOngoing, description } = req.body;
  
  try {
    // Check if education belongs to user
    const existingEducation = await prisma.userEducation.findFirst({
      where: {
        id: educationId,
        userId: req.user.id,
      },
    });
    
    if (!existingEducation) {
      return errorResponse(res, 'Education entry not found', 404);
    }
    
    // Validation
    if (toYear && fromYear && parseInt(fromYear) > parseInt(toYear)) {
      return errorResponse(res, 'From year cannot be later than to year', 400);
    }
    
    const updatedEducation = await prisma.userEducation.update({
      where: { id: educationId },
      data: {
        ...(course && { course }),
        ...(stream !== undefined && { stream }),
        ...(institution && { institution }),
        ...(fromYear && { fromYear: parseInt(fromYear) }),
        ...(toYear !== undefined && { toYear: toYear ? parseInt(toYear) : null }),
        ...(isOngoing !== undefined && { isOngoing: Boolean(isOngoing) }),
        ...(description !== undefined && { description }),
      },
    });
    
    // Log education update
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'education_update',
        details: {
          educationId,
          fields: Object.keys(req.body),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { education: updatedEducation }, 'Education updated successfully');
    
  } catch (error) {
    console.error('Update education error:', error);
    return errorResponse(res, 'Failed to update education', 500);
  }
};

// Delete education entry
const deleteEducation = async (req, res) => {
  const { educationId } = req.params;
  
  try {
    // Check if education belongs to user
    const existingEducation = await prisma.userEducation.findFirst({
      where: {
        id: educationId,
        userId: req.user.id,
      },
    });
    
    if (!existingEducation) {
      return errorResponse(res, 'Education entry not found', 404);
    }
    
    await prisma.userEducation.delete({
      where: { id: educationId },
    });
    
    // Log education deletion
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'education_delete',
        details: {
          educationId,
          course: existingEducation.course,
          institution: existingEducation.institution,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Education deleted successfully');
    
  } catch (error) {
    console.error('Delete education error:', error);
    return errorResponse(res, 'Failed to delete education', 500);
  }
};

// Add work experience
const addWorkExperience = async (req, res) => {
  const { companyName, jobRole, companyType, workAddress, fromYear, toYear, isCurrentJob, description } = req.body;
  
  // Validation
  if (!companyName || !jobRole || !fromYear) {
    return errorResponse(res, 'Company name, job role, and from year are required', 400);
  }
  
  if (!isCurrentJob && !toYear) {
    return errorResponse(res, 'To year is required when not current job', 400);
  }
  
  if (toYear && fromYear > toYear) {
    return errorResponse(res, 'From year cannot be later than to year', 400);
  }
  
  try {
    const workExperience = await prisma.userWorkExperience.create({
      data: {
        userId: req.user.id,
        companyName,
        jobRole,
        companyType,
        workAddress,
        fromYear: parseInt(fromYear),
        toYear: toYear ? parseInt(toYear) : null,
        isCurrentJob: Boolean(isCurrentJob),
        description,
      },
    });
    
    // Log work experience addition
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'work_experience_add',
        details: {
          companyName,
          jobRole,
          fromYear,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { workExperience }, 'Work experience added successfully', 201);
    
  } catch (error) {
    console.error('Add work experience error:', error);
    return errorResponse(res, 'Failed to add work experience', 500);
  }
};

// Update work experience
const updateWorkExperience = async (req, res) => {
  const { workId } = req.params;
  const { companyName, jobRole, companyType, workAddress, fromYear, toYear, isCurrentJob, description } = req.body;
  
  try {
    // Check if work experience belongs to user
    const existingWork = await prisma.userWorkExperience.findFirst({
      where: {
        id: workId,
        userId: req.user.id,
      },
    });
    
    if (!existingWork) {
      return errorResponse(res, 'Work experience not found', 404);
    }
    
    // Validation
    if (toYear && fromYear && parseInt(fromYear) > parseInt(toYear)) {
      return errorResponse(res, 'From year cannot be later than to year', 400);
    }
    
    const updatedWork = await prisma.userWorkExperience.update({
      where: { id: workId },
      data: {
        ...(companyName && { companyName }),
        ...(jobRole && { jobRole }),
        ...(companyType !== undefined && { companyType }),
        ...(workAddress !== undefined && { workAddress }),
        ...(fromYear && { fromYear: parseInt(fromYear) }),
        ...(toYear !== undefined && { toYear: toYear ? parseInt(toYear) : null }),
        ...(isCurrentJob !== undefined && { isCurrentJob: Boolean(isCurrentJob) }),
        ...(description !== undefined && { description }),
      },
    });
    
    // Log work experience update
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'work_experience_update',
        details: {
          workId,
          fields: Object.keys(req.body),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { workExperience: updatedWork }, 'Work experience updated successfully');
    
  } catch (error) {
    console.error('Update work experience error:', error);
    return errorResponse(res, 'Failed to update work experience', 500);
  }
};

// Delete work experience
const deleteWorkExperience = async (req, res) => {
  const { workId } = req.params;
  
  try {
    // Check if work experience belongs to user
    const existingWork = await prisma.userWorkExperience.findFirst({
      where: {
        id: workId,
        userId: req.user.id,
      },
    });
    
    if (!existingWork) {
      return errorResponse(res, 'Work experience not found', 404);
    }
    
    await prisma.userWorkExperience.delete({
      where: { id: workId },
    });
    
    // Log work experience deletion
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'work_experience_delete',
        details: {
          workId,
          companyName: existingWork.companyName,
          jobRole: existingWork.jobRole,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Work experience deleted successfully');
    
  } catch (error) {
    console.error('Delete work experience error:', error);
    return errorResponse(res, 'Failed to delete work experience', 500);
  }
};

// Get user's education history
const getEducationHistory = async (req, res) => {
  try {
    const education = await prisma.userEducation.findMany({
      where: { userId: req.user.id },
      orderBy: { fromYear: 'desc' },
    });
    
    return successResponse(res, { education }, 'Education history retrieved successfully');
    
  } catch (error) {
    console.error('Get education history error:', error);
    return errorResponse(res, 'Failed to retrieve education history', 500);
  }
};

// Get user's work history
const getWorkHistory = async (req, res) => {
  try {
    const workHistory = await prisma.userWorkExperience.findMany({
      where: { userId: req.user.id },
      orderBy: { fromYear: 'desc' },
    });
    
    return successResponse(res, { workHistory }, 'Work history retrieved successfully');
    
  } catch (error) {
    console.error('Get work history error:', error);
    return errorResponse(res, 'Failed to retrieve work history', 500);
  }
};

module.exports = {
  updateProfile,
  updateAddress,
  getAddresses,
  addEducation,
  updateEducation,
  deleteEducation,
  addWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
  getEducationHistory,
  getWorkHistory,
  searchAlumni,
  getAlumniStats,
  getAlumniProfile,
};