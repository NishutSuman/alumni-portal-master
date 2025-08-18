// src/controllers/user.js
const { prisma } = require('../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams, calculatePagination } = require('../utils/response');
const { getFileUrl, deleteUploadedFile } = require('../middleware/upload.middleware');

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

// Upload/Update profile picture
const uploadProfilePicture = async (req, res) => {
  try {
    // Check if file was uploaded (multer middleware handles this)
    if (!req.file) {
      return errorResponse(res, 'No image file provided', 400);
    }
    
    // Get the current user to check if they have an existing profile picture
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { profileImage: true },
    });
    
    // Generate the file URL
    const imageUrl = getFileUrl(req, req.file.filename, 'profiles');
    
    // Update user profile with image URL
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImage: imageUrl },
      select: {
        id: true,
        fullName: true,
        profileImage: true,
        updatedAt: true,
      },
    });
    
    // Delete old profile picture if it exists
    if (currentUser.profileImage && currentUser.profileImage.includes('/uploads/')) {
      const oldFileName = currentUser.profileImage.split('/').pop();
      const oldFilePath = `./public/uploads/profiles/${oldFileName}`;
      deleteUploadedFile(oldFilePath);
    }
    
    // Log profile picture update
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'profile_picture_upload',
        details: { 
          imageUrl,
          fileName: req.file.filename,
          fileSize: req.file.size,
          mimeType: req.file.mimetype 
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { user: updatedUser }, 'Profile picture uploaded successfully');
    
  } catch (error) {
    console.error('Upload profile picture error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }
    
    return errorResponse(res, 'Failed to upload profile picture', 500);
  }
};

// Update existing profile picture (same as upload)
const updateProfilePicture = async (req, res) => {
  return uploadProfilePicture(req, res);
};

// Delete profile picture
const deleteProfilePicture = async (req, res) => {
  try {
    // Get current user with profile image
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, profileImage: true },
    });
    
    if (!user.profileImage) {
      return errorResponse(res, 'No profile picture to delete', 400);
    }
    
    // Delete file from storage if it's a local upload
    if (user.profileImage.includes('/uploads/')) {
      const fileName = user.profileImage.split('/').pop();
      const filePath = `./public/uploads/profiles/${fileName}`;
      deleteUploadedFile(filePath);
    }
    
    // Remove profile image from database
    await prisma.user.update({
      where: { id: req.user.id },
      data: { profileImage: null },
    });
    
    // Log profile picture deletion
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'profile_picture_delete',
        details: { 
          deletedImageUrl: user.profileImage 
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Profile picture deleted successfully');
    
  } catch (error) {
    console.error('Delete profile picture error:', error);
    return errorResponse(res, 'Failed to delete profile picture', 500);
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
  uploadProfilePicture,
  updateProfilePicture,
  deleteProfilePicture,
};