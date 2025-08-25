// src/controllers/lifelink.controller.js
// LifeLink Network Controller - Following established patterns

const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/response');
const { CacheService } = require('../config/redis');
const BloodCompatibilityService = require('../services/blood-compatibility.service');

const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatDonorCard = (donor) => {
  const eligibility = BloodCompatibilityService.checkDonorEligibility(donor.lastDonationDate);
  
  return {
    id: donor.id,
    name: `${donor.firstName} ${donor.lastName}`,
    profilePhoto: donor.profilePhoto,
    bloodGroup: donor.bloodGroup,
    totalDonations: donor.totalDonations,
    lastDonationDate: donor.lastDonationDate,
    eligibility: {
      isEligible: eligibility.isEligible,
      message: eligibility.message,
      nextEligibleDate: eligibility.nextEligibleDate,
      daysRemaining: eligibility.daysRemaining
    },
    location: donor.addresses[0] ? `${donor.addresses[0].city}, ${donor.addresses[0].state}` : null,
    contactAvailable: donor.showPhone
  };
};

// ============================================
// USER PROFILE MANAGEMENT
// ============================================

/**
 * Update user's blood profile
 * PUT /api/users/profile/blood
 * Access: Authenticated users
 */
const updateBloodProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bloodGroup, isBloodDonor } = req.body;

    // Update user blood profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        bloodGroup: bloodGroup || null,
        isBloodDonor: isBloodDonor || false
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        bloodGroup: true,
        isBloodDonor: true,
        lastDonationDate: true,
        totalDonations: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'blood_profile_update',
        details: {
          bloodGroup,
          isBloodDonor,
          updatedFields: ['bloodGroup', 'isBloodDonor']
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Clear user profile cache
    await CacheService.delPattern(`user:${userId}:profile*`);
    await CacheService.delPattern('lifelink:dashboard*');

    const eligibility = BloodCompatibilityService.checkDonorEligibility(updatedUser.lastDonationDate);

    const responseData = {
      ...updatedUser,
      eligibility
    };

    return successResponse(res, responseData, 'Blood profile updated successfully');
  } catch (error) {
    console.error('Update blood profile error:', error);
    return errorResponse(res, 'Failed to update blood profile', 500);
  }
};

/**
 * Get user's blood profile
 * GET /api/users/profile/blood
 * Access: Authenticated users
 */
const getBloodProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        bloodGroup: true,
        isBloodDonor: true,
        lastDonationDate: true,
        totalDonations: true,
        donationHistory: {
          select: {
            id: true,
            donationDate: true,
            location: true,
            units: true,
            notes: true
          },
          orderBy: { donationDate: 'desc' },
          take: 5 // Recent 5 donations
        }
      }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    const eligibility = BloodCompatibilityService.checkDonorEligibility(user.lastDonationDate);

    const responseData = {
      ...user,
      eligibility
    };

    return successResponse(res, responseData, 'Blood profile retrieved successfully');
  } catch (error) {
    console.error('Get blood profile error:', error);
    return errorResponse(res, 'Failed to retrieve blood profile', 500);
  }
};

// ============================================
// LIFELINK DASHBOARD
// ============================================

/**
 * Get LifeLink dashboard with all donors
 * GET /api/lifelink/dashboard
 * Access: Public (enhanced with auth)
 */
const getLifeLinkDashboard = async (req, res) => {
  try {
    const { bloodGroup, eligibleOnly = 'false', limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {
      isBloodDonor: true,
      isActive: true,
      bloodGroup: { not: null }
    };

    if (bloodGroup) {
      where.bloodGroup = bloodGroup;
    }

    // Get donors
    const donors = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePhoto: true,
        bloodGroup: true,
        lastDonationDate: true,
        totalDonations: true,
        showPhone: true,
        addresses: {
          select: {
            city: true,
            state: true,
            addressType: true
          },
          take: 1
        }
      },
      orderBy: [
        { lastDonationDate: 'desc' },
        { totalDonations: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: parseInt(limit)
    });

    // Get total count for pagination
    const totalCount = await prisma.user.count({ where });

    // Format donor cards and filter eligible if requested
    let donorCards = donors.map(formatDonorCard);

    if (eligibleOnly === 'true') {
      donorCards = donorCards.filter(donor => donor.eligibility.isEligible);
    }

    // Get blood group statistics
    const bloodGroupStats = await BloodCompatibilityService.getBloodGroupStats();

    // Get total donors by eligibility
    const eligibilityStats = {
      total: donorCards.length,
      eligible: donorCards.filter(d => d.eligibility.isEligible).length,
      waiting: donorCards.filter(d => !d.eligibility.isEligible).length
    };

    const responseData = {
      donors: donorCards,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNext: skip + donorCards.length < totalCount,
        hasPrev: parseInt(page) > 1
      },
      statistics: {
        bloodGroupDistribution: bloodGroupStats,
        eligibility: eligibilityStats
      },
      filters: {
        bloodGroup: bloodGroup || null,
        eligibleOnly: eligibleOnly === 'true'
      }
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'LifeLink dashboard retrieved successfully');
  } catch (error) {
    console.error('LifeLink dashboard error:', error);
    return errorResponse(res, 'Failed to load dashboard', 500);
  }
};

// ============================================
// DONATION MANAGEMENT
// ============================================

/**
 * Get user's donation history
 * GET /api/lifelink/my-donations
 * Access: Authenticated users
 */
const getMyDonations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const donations = await prisma.bloodDonation.findMany({
      where: { donorId: userId },
      select: {
        id: true,
        donationDate: true,
        location: true,
        units: true,
        notes: true,
        createdAt: true
      },
      orderBy: { donationDate: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const totalCount = await prisma.bloodDonation.count({
      where: { donorId: userId }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalDonations: true,
        lastDonationDate: true
      }
    });

    const eligibility = BloodCompatibilityService.checkDonorEligibility(user?.lastDonationDate);

    const responseData = {
      donations,
      summary: {
        totalDonations: user?.totalDonations || 0,
        lastDonationDate: user?.lastDonationDate,
        eligibility
      },
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    };

    return successResponse(res, responseData, 'Donation history retrieved successfully');
  } catch (error) {
    console.error('Get my donations error:', error);
    return errorResponse(res, 'Failed to retrieve donation history', 500);
  }
};

/**
 * Add new donation record
 * POST /api/lifelink/donations
 * Access: Authenticated blood donors
 */
const addDonation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { donationDate, location, units, notes } = req.body;

    // Check if user is a blood donor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isBloodDonor: true,
        lastDonationDate: true
      }
    });

    if (!user?.isBloodDonor) {
      return errorResponse(res, 'Only registered blood donors can add donation records', 403);
    }

    // Check eligibility (3-month rule)
    const eligibility = BloodCompatibilityService.checkDonorEligibility(user.lastDonationDate);
    
    if (!eligibility.isEligible) {
      return errorResponse(res, eligibility.message, 400, {
        eligibility
      });
    }

    // Record the donation
    const donation = await BloodCompatibilityService.recordDonation(userId, {
      donationDate: donationDate ? new Date(donationDate) : new Date(),
      location,
      units: units || 1,
      notes
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'donation_added',
        details: {
          donationId: donation.id,
          donationDate: donation.donationDate,
          location,
          units: donation.units
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Clear relevant caches
    await CacheService.delPattern(`user:${userId}:*`);
    await CacheService.delPattern('lifelink:dashboard*');

    return successResponse(res, donation, 'Donation recorded successfully');
  } catch (error) {
    console.error('Add donation error:', error);
    return errorResponse(res, 'Failed to record donation', 500);
  }
};

/**
 * Check donation eligibility status
 * GET /api/lifelink/donation-status
 * Access: Authenticated blood donors
 */
const getDonationStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isBloodDonor: true,
        lastDonationDate: true,
        totalDonations: true
      }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (!user.isBloodDonor) {
      return errorResponse(res, 'User is not registered as a blood donor', 400);
    }

    const eligibility = BloodCompatibilityService.checkDonorEligibility(user.lastDonationDate);

    const responseData = {
      totalDonations: user.totalDonations,
      lastDonationDate: user.lastDonationDate,
      eligibility
    };

    return successResponse(res, responseData, 'Donation status retrieved successfully');
  } catch (error) {
    console.error('Get donation status error:', error);
    return errorResponse(res, 'Failed to check donation status', 500);
  }
};

// ============================================
// EMERGENCY REQUISITION SYSTEM (Phase 2B)
// ============================================

/**
 * Create blood requisition with automatic donor notifications
 * POST /api/lifelink/requisitions
 * Access: Authenticated users
 */
const createRequisition = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      patientName,
      hospitalName,
      contactNumber,
      alternateNumber,
      requiredBloodGroup,
      unitsNeeded,
      urgencyLevel,
      medicalCondition,
      location,
      additionalNotes,
      requiredByDate,
      allowContactReveal
    } = req.body;

    // Calculate expiry (default: 3 days or required by date, whichever is earlier)
    const now = new Date();
    const defaultExpiry = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days
    const requiredBy = new Date(requiredByDate);
    const expiresAt = requiredBy < defaultExpiry ? requiredBy : defaultExpiry;

    // Create requisition in transaction
    const result = await prisma.$transaction(async (tx) => {
      const requisition = await tx.bloodRequisition.create({
        data: {
          requesterId: userId,
          patientName: patientName.trim(),
          hospitalName: hospitalName.trim(),
          contactNumber,
          alternateNumber,
          requiredBloodGroup,
          unitsNeeded: unitsNeeded || 1,
          urgencyLevel: urgencyLevel || 'HIGH',
          medicalCondition,
          location: location.trim(),
          additionalNotes,
          requiredByDate: requiredBy,
          expiresAt,
          allowContactReveal: allowContactReveal !== false
        }
      });

      return requisition;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'lifelink_requisition_created',
        details: {
          requisitionId: result.id,
          patientName,
          requiredBloodGroup,
          urgencyLevel,
          location
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const responseData = {
      id: result.id,
      patientName: result.patientName,
      hospitalName: result.hospitalName,
      requiredBloodGroup: result.requiredBloodGroup,
      unitsNeeded: result.unitsNeeded,
      urgencyLevel: result.urgencyLevel,
      location: result.location,
      requiredByDate: result.requiredByDate,
      expiresAt: result.expiresAt,
      status: result.status,
      createdAt: result.createdAt
    };

    return successResponse(res, responseData, 'Blood requisition created successfully');
  } catch (error) {
    console.error('Create requisition error:', error);
    return errorResponse(res, 'Failed to create blood requisition', 500);
  }
};

/**
 * Search compatible donors for requisition
 * POST /api/lifelink/search-donors
 * Access: Authenticated users
 */
const searchDonors = async (req, res) => {
  try {
    const { requiredBloodGroup, location, limit = 50 } = req.body;

    const availableDonors = await BloodCompatibilityService.findAvailableDonors(
      requiredBloodGroup,
      location,
      parseInt(limit)
    );

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, { availableDonors }, req.cacheTTL);
    }

    return successResponse(res, {
      availableDonors,
      searchCriteria: {
        requiredBloodGroup,
        location,
        limit: parseInt(limit)
      },
      summary: {
        totalFound: availableDonors.length,
        eligibleDonors: availableDonors.filter(d => d.eligibility.isEligible).length
      }
    }, `Found ${availableDonors.length} compatible donors`);

  } catch (error) {
    console.error('Search donors error:', error);
    return errorResponse(res, error.message || 'Failed to search compatible donors', 500);
  }
};

/**
 * Notify selected donors about emergency requisition
 * POST /api/lifelink/notify-selected
 * Access: Authenticated users (with active requisition)
 */
const notifySelectedDonors = async (req, res) => {
  try {
    const userId = req.user.id;
    const { donorIds, requisitionId, customMessage } = req.body;

    // Get requisition details
    const requisition = await prisma.bloodRequisition.findUnique({
      where: { id: requisitionId },
      include: {
        requester: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      }
    });

    if (!requisition) {
      return errorResponse(res, 'Blood requisition not found', 404);
    }

    if (requisition.requesterId !== userId && req.user.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'You can only notify donors for your own requisitions', 403);
    }

    if (requisition.status !== 'ACTIVE') {
      return errorResponse(res, 'Can only notify donors for active requisitions', 400);
    }

    // Verify donor IDs exist and are eligible
    const donorUsers = await prisma.user.findMany({
      where: {
        id: { in: donorIds },
        isBloodDonor: true,
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        bloodGroup: true,
        lastDonationDate: true
      }
    });

    if (donorUsers.length !== donorIds.length) {
      return errorResponse(res, 'Some selected donors are not valid or not active', 400);
    }

    // Send emergency notifications using NotificationService
    const { NotificationService } = require('../services/notification.service');
    
    const notificationResult = await NotificationService.sendLifeLinkEmergencyNotification(
      requisition,
      donorIds,
      customMessage
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'lifelink_donors_notified',
        details: {
          requisitionId,
          donorCount: donorIds.length,
          notificationsSent: notificationResult.notificationsSent,
          customMessage: !!customMessage
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      requisitionId,
      notificationResult,
      donorsNotified: donorUsers.map(d => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        bloodGroup: d.bloodGroup
      }))
    }, `Emergency notification sent to ${notificationResult.notificationsSent} donors`);

  } catch (error) {
    console.error('Notify selected donors error:', error);
    return errorResponse(res, error.message || 'Failed to notify selected donors', 500);
  }
};

/**
 * Broadcast emergency notification to all available donors in area
 * POST /api/lifelink/notify-all
 * Access: Authenticated users
 */
const notifyAllDonors = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requisitionId, customMessage } = req.body;

    // Get requisition details
    const requisition = await prisma.bloodRequisition.findUnique({
      where: { id: requisitionId }
    });

    if (!requisition) {
      return errorResponse(res, 'Blood requisition not found', 404);
    }

    if (requisition.requesterId !== userId && req.user.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'You can only broadcast for your own requisitions', 403);
    }

    if (requisition.status !== 'ACTIVE') {
      return errorResponse(res, 'Can only broadcast for active requisitions', 400);
    }

    // Find all available donors in the area
    const availableDonors = await BloodCompatibilityService.findAvailableDonors(
      requisition.requiredBloodGroup,
      requisition.location,
      200 // Increased limit for broadcast
    );

    if (availableDonors.length === 0) {
      return errorResponse(res, 'No eligible donors found in the specified area', 404);
    }

    const donorIds = availableDonors.map(donor => donor.id);

    // Send broadcast notification
    const { NotificationService } = require('../services/notification.service');
    
    const notificationResult = await NotificationService.sendLifeLinkEmergencyNotification(
      requisition,
      donorIds,
      customMessage
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'lifelink_broadcast_sent',
        details: {
          requisitionId,
          donorCount: donorIds.length,
          notificationsSent: notificationResult.notificationsSent,
          area: requisition.location,
          bloodGroup: requisition.requiredBloodGroup
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, {
      requisitionId,
      notificationResult,
      broadcastSummary: {
        totalEligibleDonors: availableDonors.length,
        notificationsSent: notificationResult.notificationsSent,
        area: requisition.location,
        bloodGroup: requisition.requiredBloodGroup
      }
    }, `Emergency broadcast sent to ${notificationResult.notificationsSent} donors in ${requisition.location}`);

  } catch (error) {
    console.error('Notify all donors error:', error);
    return errorResponse(res, error.message || 'Failed to broadcast emergency notification', 500);
  }
};

/**
 * Discover available requisitions for donors
 * GET /api/lifelink/discover-requisitions
 * Access: Authenticated blood donors
 */
const discoverRequisitions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { urgencyLevel, maxDistance, limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get donor's blood group and location
    const donor = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        bloodGroup: true,
        addresses: {
          select: {
            city: true,
            state: true,
            addressType: true
          },
          take: 1
        }
      }
    });

    if (!donor?.bloodGroup) {
      return errorResponse(res, 'Please update your blood group to discover requisitions', 400);
    }

    // Get compatible recipient blood groups for donor
    const compatibleRecipients = BloodCompatibilityService.getCompatibleRecipients(donor.bloodGroup);

    // Build where clause for requisition search
    const where = {
      status: 'ACTIVE',
      expiresAt: { gte: new Date() },
      requiredBloodGroup: { in: compatibleRecipients }
    };

    if (urgencyLevel) where.urgencyLevel = urgencyLevel;

    // Get requisitions with seeker details
    const requisitions = await prisma.bloodRequisition.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            profilePhoto: true,
            addresses: {
              select: {
                city: true,
                state: true,
                addressType: true
              },
              take: 1
            }
          }
        },
        responses: {
          where: { donorId: userId },
          select: {
            response: true,
            respondedAt: true
          }
        },
        _count: {
          select: {
            responses: true,
            notifications: true
          }
        }
      },
      orderBy: [
        { urgencyLevel: 'desc' },
        { createdAt: 'desc' }
      ],
      skip,
      take: parseInt(limit)
    });

    const totalCount = await prisma.bloodRequisition.count({ where });

    // Format requisitions with seeker details and compatibility info
    const formattedRequisitions = requisitions.map(req => {
      const hasResponded = req.responses.length > 0;
      const donorLocation = donor.addresses[0];
      const seekerLocation = req.requester.addresses[0];
      
      return {
        id: req.id,
        patientName: req.patientName,
        hospitalName: req.hospitalName,
        requiredBloodGroup: req.requiredBloodGroup,
        unitsNeeded: req.unitsNeeded,
        urgencyLevel: req.urgencyLevel,
        medicalCondition: req.medicalCondition,
        location: req.location,
        additionalNotes: req.additionalNotes,
        requiredByDate: req.requiredByDate,
        expiresAt: req.expiresAt,
        createdAt: req.createdAt,
        
        // Compatibility info
        compatibility: {
          isCompatible: true, // Already filtered
          donorBloodGroup: donor.bloodGroup,
          canDonate: true
        },
        
        // Distance calculation (simplified - you might want to use a proper distance API)
        distance: donorLocation && seekerLocation ? 
          `${donorLocation.city}, ${donorLocation.state}` === `${seekerLocation.city}, ${seekerLocation.state}` ? 'Same city' : 'Different city' 
          : 'Location not specified',
        
        // Response status
        responseStatus: hasResponded ? {
          hasResponded: true,
          response: req.responses[0].response,
          respondedAt: req.responses[0].respondedAt
        } : { hasResponded: false },
        
        // Seeker (requester) information
        seeker: {
          id: req.requester.id,
          name: `${req.requester.firstName} ${req.requester.lastName}`,
          phone: req.requester.phone, // Full contact details visible to compatible donors
          profilePhoto: req.requester.profilePhoto,
          location: seekerLocation ? `${seekerLocation.city}, ${seekerLocation.state}` : 'Location not specified'
        },
        
        // Statistics
        statistics: {
          totalResponses: req._count.responses,
          totalNotificationsSent: req._count.notifications
        },
        
        // Time urgency
        timeRemaining: {
          hoursLeft: Math.max(0, Math.floor((new Date(req.requiredByDate) - new Date()) / (1000 * 60 * 60))),
          isUrgent: new Date(req.requiredByDate) - new Date() < 24 * 60 * 60 * 1000, // Less than 24 hours
          isExpiring: new Date(req.expiresAt) - new Date() < 6 * 60 * 60 * 1000 // Less than 6 hours
        }
      };
    });

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      const responseData = {
        requisitions: formattedRequisitions,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      };
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, {
      requisitions: formattedRequisitions,
      donorInfo: {
        bloodGroup: donor.bloodGroup,
        canDonateTo: compatibleRecipients,
        location: donorLocation ? `${donorLocation.city}, ${donorLocation.state}` : 'Not specified'
      },
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNext: skip + requisitions.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    }, `Found ${formattedRequisitions.length} emergency requests you can help with`);

  } catch (error) {
    console.error('Discover requisitions error:', error);
    return errorResponse(res, 'Failed to discover requisitions', 500);
  }
};

/**
 * Notify seeker when donor responds to their requisition
 * @param {string} seekerId - Requester user ID
 * @param {Object} donorData - Donor information
 * @param {Object} requisitionData - Requisition details
 * @param {string} response - Donor response (WILLING, NOT_AVAILABLE, etc.)
 * @param {boolean} contactRevealed - Whether donor contact was revealed
 */
const notifySeekerOfResponse = async (seekerId, donorData, requisitionData, response, contactRevealed) => {
  try {
    const { NotificationService, NOTIFICATION_TYPES, PRIORITY_LEVELS } = require('../services/notification.service');
    
    // Create different messages based on response type
    let title, message, priority;
    
    if (response === 'WILLING') {
      title = '✅ Donor Found!';
      message = `${donorData.name} (${donorData.bloodGroup}) is willing to help with your blood request for ${requisitionData.patientName}`;
      priority = PRIORITY_LEVELS.HIGH;
      
      if (contactRevealed) {
        message += `. Contact: ${donorData.phone}`;
      }
    } else if (response === 'NOT_AVAILABLE') {
      title = '📱 Response Received';
      message = `${donorData.name} received your blood request but is currently not available to donate`;
      priority = PRIORITY_LEVELS.MEDIUM;
    } else if (response === 'NOT_SUITABLE') {
      title = '📱 Response Received';
      message = `${donorData.name} received your blood request but cannot donate at this time`;
      priority = PRIORITY_LEVELS.MEDIUM;
    }

    await NotificationService.createAndSendNotification({
      recipientIds: [seekerId],
      type: NOTIFICATION_TYPES.LIFELINK_EMERGENCY,
      title,
      message,
      data: {
        requisitionId: requisitionData.id,
        donorId: donorData.id,
        donorName: donorData.name,
        donorBloodGroup: donorData.bloodGroup,
        response,
        contactRevealed,
        donorPhone: contactRevealed ? donorData.phone : null
      },
      priority,
      channels: ['PUSH', 'IN_APP']
    });

    console.log(`✅ Notified seeker ${seekerId} of donor response: ${response}`);
  } catch (error) {
    console.error('Notify seeker of response error:', error);
    // Don't throw - this is a background operation
  }
};
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      donorId: userId
    };

    if (status) where.status = status;

    // Don't show expired notifications
    where.OR = [
      { requisition: { expiresAt: null } },
      { requisition: { expiresAt: { gte: new Date() } } }
    ];

    const notifications = await prisma.donorNotification.findMany({
      where,
      include: {
        requisition: {
          select: {
            id: true,
            patientName: true,
            hospitalName: true,
            requiredBloodGroup: true,
            unitsNeeded: true,
            urgencyLevel: true,
            location: true,
            requiredByDate: true,
            status: true,
            allowContactReveal: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const totalCount = await prisma.donorNotification.count({ where });

    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      status: notification.status,
      notificationType: notification.notificationType,
      createdAt: notification.createdAt,
      readAt: notification.readAt,
      requisition: notification.requisition ? {
        ...notification.requisition,
        isExpired: notification.requisition.requiredByDate ? 
          new Date() > new Date(notification.requisition.requiredByDate) : false
      } : null
    }));

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      const responseData = {
        notifications: formattedNotifications,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      };
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, {
      notifications: formattedNotifications,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNext: skip + notifications.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    }, 'Emergency notifications retrieved successfully');

  } catch (error) {
    console.error('Get my notifications error:', error);
    return errorResponse(res, 'Failed to retrieve emergency notifications', 500);
  }
};

/**
 * Mark notification as read
 * PUT /api/lifelink/notifications/:notificationId/read
 * Access: Notification recipient
 */
const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await prisma.donorNotification.findUnique({
      where: { id: notificationId },
      select: { donorId: true, readAt: true }
    });

    if (!notification) {
      return errorResponse(res, 'Notification not found', 404);
    }

    if (notification.donorId !== userId) {
      return errorResponse(res, 'You can only mark your own notifications as read', 403);
    }

    if (notification.readAt) {
      return successResponse(res, { alreadyRead: true }, 'Notification was already read');
    }

    await prisma.donorNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'lifelink_notification_read',
        details: { notificationId },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, { markedRead: true }, 'Notification marked as read');
  } catch (error) {
    console.error('Mark notification read error:', error);
    return errorResponse(res, 'Failed to mark notification as read', 500);
  }
};

/**
 * Get user's requisitions
 * GET /api/lifelink/my-requisitions
 * Access: Authenticated users
 */
const getMyRequisitions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { requesterId: userId };
    if (status) where.status = status;

    const requisitions = await prisma.bloodRequisition.findMany({
      where,
      select: {
        id: true,
        patientName: true,
        hospitalName: true,
        requiredBloodGroup: true,
        unitsNeeded: true,
        urgencyLevel: true,
        location: true,
        status: true,
        requiredByDate: true,
        expiresAt: true,
        createdAt: true,
        _count: {
          select: {
            responses: true,
            notifications: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });

    const totalCount = await prisma.bloodRequisition.count({ where });

    const formattedRequisitions = requisitions.map(req => ({
      ...req,
      isExpired: req.expiresAt ? new Date() > new Date(req.expiresAt) : false,
      responseCount: req._count.responses,
      notificationsSent: req._count.notifications
    }));

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      const responseData = {
        requisitions: formattedRequisitions,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      };
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, {
      requisitions: formattedRequisitions,
      pagination: {
        currentPage: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        hasNext: skip + requisitions.length < totalCount,
        hasPrev: parseInt(page) > 1
      }
    }, 'Requisitions retrieved successfully');

  } catch (error) {
    console.error('Get my requisitions error:', error);
    return errorResponse(res, 'Failed to retrieve requisitions', 500);
  }
};

/**
 * Get single requisition details with responses
 * GET /api/lifelink/requisitions/:requisitionId
 * Access: Requester or SUPER_ADMIN
 */
const getRequisition = async (req, res) => {
  try {
    const { requisitionId } = req.params;

    const requisition = await prisma.bloodRequisition.findUnique({
      where: { id: requisitionId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        responses: {
          include: {
            donor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                bloodGroup: true,
                totalDonations: true
              }
            }
          },
          orderBy: { respondedAt: 'desc' }
        },
        _count: {
          select: {
            notifications: true,
            responses: true
          }
        }
      }
    });

    if (!requisition) {
      return errorResponse(res, 'Blood requisition not found', 404);
    }

    // Format responses with contact revelation logic
    const formattedResponses = requisition.responses.map(response => ({
      id: response.id,
      response: response.response,
      message: response.message,
      respondedAt: response.respondedAt,
      isContactRevealed: response.isContactRevealed,
      contactPhone: response.isContactRevealed ? response.contactPhone : null,
      donor: {
        ...response.donor,
        name: `${response.donor.firstName} ${response.donor.lastName}`
      }
    }));

    const responseData = {
      id: requisition.id,
      patientName: requisition.patientName,
      hospitalName: requisition.hospitalName,
      contactNumber: requisition.contactNumber,
      alternateNumber: requisition.alternateNumber,
      requiredBloodGroup: requisition.requiredBloodGroup,
      unitsNeeded: requisition.unitsNeeded,
      urgencyLevel: requisition.urgencyLevel,
      medicalCondition: requisition.medicalCondition,
      location: requisition.location,
      additionalNotes: requisition.additionalNotes,
      status: requisition.status,
      requiredByDate: requisition.requiredByDate,
      expiresAt: requisition.expiresAt,
      allowContactReveal: requisition.allowContactReveal,
      createdAt: requisition.createdAt,
      updatedAt: requisition.updatedAt,
      isExpired: requisition.expiresAt ? new Date() > new Date(requisition.expiresAt) : false,
      requester: {
        name: `${requisition.requester.firstName} ${requisition.requester.lastName}`,
        phone: requisition.requester.phone
      },
      responses: formattedResponses,
      statistics: {
        totalNotificationsSent: requisition._count.notifications,
        totalResponses: requisition._count.responses,
        willingDonors: formattedResponses.filter(r => r.response === 'WILLING').length,
        unavailableDonors: formattedResponses.filter(r => r.response === 'NOT_AVAILABLE').length,
        contactsRevealed: formattedResponses.filter(r => r.isContactRevealed).length
      }
    };

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
    }

    return successResponse(res, responseData, 'Requisition details retrieved successfully');
  } catch (error) {
    console.error('Get requisition error:', error);
    return errorResponse(res, 'Failed to retrieve requisition details', 500);
  }
};

/**
 * Update requisition status
 * PUT /api/lifelink/requisitions/:requisitionId/status
 * Access: Requester or SUPER_ADMIN
 */
const updateRequisitionStatus = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.id;

    const validStatuses = ['ACTIVE', 'FULFILLED', 'EXPIRED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid status. Must be one of: ' + validStatuses.join(', '), 400);
    }

    const updatedRequisition = await prisma.bloodRequisition.update({
      where: { id: requisitionId },
      data: {
        status,
        updatedAt: new Date()
      },
      select: {
        id: true,
        patientName: true,
        status: true,
        requiredBloodGroup: true,
        location: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'lifelink_requisition_status_updated',
        details: {
          requisitionId,
          oldStatus: req.requisition.status,
          newStatus: status,
          notes
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, updatedRequisition, `Requisition status updated to ${status}`);
  } catch (error) {
    console.error('Update requisition status error:', error);
    return errorResponse(res, 'Failed to update requisition status', 500);
  }
};

/**
 * Get willing donors for a requisition
 * GET /api/lifelink/willing-donors/:requisitionId
 * Access: Requester or SUPER_ADMIN
 */
const getWillingDonors = async (req, res) => {
  try {
    const { requisitionId } = req.params;

    const willingDonors = await prisma.donorResponse.findMany({
      where: {
        requisitionId,
        response: 'WILLING'
      },
      include: {
        donor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            bloodGroup: true,
            totalDonations: true,
            lastDonationDate: true,
            addresses: {
              select: {
                city: true,
                state: true,
                addressType: true
              },
              take: 1
            }
          }
        }
      },
      orderBy: { respondedAt: 'desc' }
    });

    const formattedDonors = willingDonors.map(response => {
      const eligibility = BloodCompatibilityService.checkDonorEligibility(response.donor.lastDonationDate);
      
      return {
        responseId: response.id,
        message: response.message,
        respondedAt: response.respondedAt,
        contactRevealed: response.isContactRevealed,
        contactPhone: response.isContactRevealed ? response.contactPhone : null,
        donor: {
          id: response.donor.id,
          name: `${response.donor.firstName} ${response.donor.lastName}`,
          bloodGroup: response.donor.bloodGroup,
          totalDonations: response.donor.totalDonations,
          eligibility,
          location: response.donor.addresses[0] ? 
            `${response.donor.addresses[0].city}, ${response.donor.addresses[0].state}` : null
        }
      };
    });

    // Cache the result
    if (req.cacheKey && req.cacheTTL) {
      await CacheService.set(req.cacheKey, { willingDonors: formattedDonors }, req.cacheTTL);
    }

    return successResponse(res, {
      willingDonors: formattedDonors,
      summary: {
        totalWilling: formattedDonors.length,
        contactsAvailable: formattedDonors.filter(d => d.contactRevealed).length,
        eligibleDonors: formattedDonors.filter(d => d.donor.eligibility.isEligible).length
      }
    }, `Found ${formattedDonors.length} willing donors`);

  } catch (error) {
    console.error('Get willing donors error:', error);
    return errorResponse(res, 'Failed to retrieve willing donors', 500);
  }
};

/**
 * Respond to emergency notification (with contact revelation and seeker notification)
 * POST /api/lifelink/notifications/:notificationId/respond
 * Access: Notification recipient (blood donor)
 */
const respondToNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { response, message } = req.body;
    const userId = req.user.id;

    // Get notification with requisition and requester details
    const notification = await prisma.donorNotification.findUnique({
      where: { id: notificationId },
      include: {
        requisition: {
          include: {
            requester: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true
              }
            }
          }
        }
      }
    });

    if (!notification) {
      return errorResponse(res, 'Emergency notification not found', 404);
    }

    if (notification.donorId !== userId) {
      return errorResponse(res, 'You can only respond to your own notifications', 403);
    }

    if (!notification.requisition) {
      return errorResponse(res, 'Associated requisition not found', 404);
    }

    if (notification.requisition.status !== 'ACTIVE') {
      return errorResponse(res, 'This requisition is no longer active', 400);
    }

    if (notification.requisition.expiresAt && new Date() > new Date(notification.requisition.expiresAt)) {
      return errorResponse(res, 'This requisition has expired', 400);
    }

    // Get user's contact info and privacy settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        showPhone: true,
        firstName: true,
        lastName: true,
        bloodGroup: true
      }
    });

    // Determine if contact should be revealed
    const shouldRevealContact = response === 'WILLING' && 
                              notification.requisition.allowContactReveal && 
                              user.showPhone;

    // Create or update donor response
    const donorResponse = await prisma.donorResponse.upsert({
      where: {
        donorId_requisitionId: {
          donorId: userId,
          requisitionId: notification.requisition.id
        }
      },
      update: {
        response,
        message,
        respondedAt: new Date(),
        contactPhone: shouldRevealContact ? user.phone : null,
        isContactRevealed: shouldRevealContact
      },
      create: {
        donorId: userId,
        requisitionId: notification.requisition.id,
        response,
        message,
        respondedAt: new Date(),
        contactPhone: shouldRevealContact ? user.phone : null,
        isContactRevealed: shouldRevealContact
      }
    });

    // Mark notification as read
    await prisma.donorNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() }
    });

    // **NEW: Notify seeker of donor response**
    await notifySeekerOfResponse(
      notification.requisition.requesterId,
      {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        bloodGroup: user.bloodGroup,
        phone: user.phone
      },
      {
        id: notification.requisition.id,
        patientName: notification.requisition.patientName,
        hospitalName: notification.requisition.hospitalName
      },
      response,
      shouldRevealContact
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'lifelink_emergency_response',
        details: {
          notificationId,
          requisitionId: notification.requisition.id,
          response,
          contactRevealed: shouldRevealContact,
          seekerNotified: true
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const responseData = {
      responseId: donorResponse.id,
      response: donorResponse.response,
      message: donorResponse.message,
      respondedAt: donorResponse.respondedAt,
      contactRevealed: shouldRevealContact,
      requisition: {
        id: notification.requisition.id,
        patientName: notification.requisition.patientName,
        hospitalName: notification.requisition.hospitalName
      },
      seeker: {
        name: `${notification.requisition.requester.firstName} ${notification.requisition.requester.lastName}`,
        phone: notification.requisition.requester.phone
      },
      donor: {
        name: `${user.firstName} ${user.lastName}`,
        bloodGroup: user.bloodGroup
      }
    };

    let successMessage = `Response "${response}" recorded successfully`;
    if (shouldRevealContact) {
      successMessage += '. Your contact information has been shared with the requester.';
    }
    successMessage += ' The requester has been notified of your response.';

    return successResponse(res, responseData, successMessage);

  } catch (error) {
    console.error('Respond to notification error:', error);
    return errorResponse(res, error.message || 'Failed to record response', 500);
  }
};

/**
 * Respond to requisition directly (with seeker notification)
 * POST /api/lifelink/requisitions/:requisitionId/respond
 * Access: Authenticated blood donors
 */
const respondToRequisition = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    const { response, message } = req.body;
    const userId = req.user.id;

    // Get requisition details with requester info
    const requisition = await prisma.bloodRequisition.findUnique({
      where: { id: requisitionId },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      }
    });

    if (!requisition) {
      return errorResponse(res, 'Blood requisition not found', 404);
    }

    if (requisition.status !== 'ACTIVE') {
      return errorResponse(res, 'This requisition is no longer active', 400);
    }

    if (requisition.expiresAt && new Date() > new Date(requisition.expiresAt)) {
      return errorResponse(res, 'This requisition has expired', 400);
    }

    // Check if user already responded (prevent duplicates)
    const existingResponse = await prisma.donorResponse.findUnique({
      where: {
        donorId_requisitionId: {
          donorId: userId,
          requisitionId
        }
      }
    });

    if (existingResponse) {
      return errorResponse(res, 'You have already responded to this requisition', 400, {
        existingResponse: {
          response: existingResponse.response,
          respondedAt: existingResponse.respondedAt
        }
      });
    }

    // Get user's contact info and privacy settings
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        showPhone: true,
        firstName: true,
        lastName: true,
        bloodGroup: true
      }
    });

    // Determine if contact should be revealed
    const shouldRevealContact = response === 'WILLING' && 
                              requisition.allowContactReveal && 
                              user.showPhone;

    // Create donor response
    const donorResponse = await prisma.donorResponse.create({
      data: {
        donorId: userId,
        requisitionId,
        response,
        message,
        respondedAt: new Date(),
        contactPhone: shouldRevealContact ? user.phone : null,
        isContactRevealed: shouldRevealContact
      }
    });

    // **NEW: Notify seeker of donor response**
    await notifySeekerOfResponse(
      requisition.requesterId,
      {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        bloodGroup: user.bloodGroup,
        phone: user.phone
      },
      {
        id: requisition.id,
        patientName: requisition.patientName,
        hospitalName: requisition.hospitalName
      },
      response,
      shouldRevealContact
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'lifelink_requisition_response',
        details: {
          requisitionId,
          response,
          contactRevealed: shouldRevealContact,
          patientName: requisition.patientName,
          seekerNotified: true
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    const responseData = {
      responseId: donorResponse.id,
      response: donorResponse.response,
      message: donorResponse.message,
      respondedAt: donorResponse.respondedAt,
      contactRevealed: shouldRevealContact,
      requisition: {
        id: requisition.id,
        patientName: requisition.patientName,
        hospitalName: requisition.hospitalName
      },
      seeker: {
        name: `${requisition.requester.firstName} ${requisition.requester.lastName}`,
        phone: requisition.requester.phone
      },
      donor: {
        name: `${user.firstName} ${user.lastName}`,
        bloodGroup: user.bloodGroup
      }
    };

    let successMessage = `Response "${response}" recorded successfully`;
    if (shouldRevealContact) {
      successMessage += '. Your contact information has been shared with the requester.';
    }
    successMessage += ' The requester has been notified of your response.';

    return successResponse(res, responseData, successMessage);

  } catch (error) {
    console.error('Respond to requisition error:', error);
    return errorResponse(res, error.message || 'Failed to record response', 500);
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Profile management
  updateBloodProfile,
  getBloodProfile,
  
  // Dashboard
  getLifeLinkDashboard,
  
  // Donation management
  getMyDonations,
  addDonation,
  getDonationStatus,

  // Emergency requisition system (Phase 2B)
  createRequisition,
  getMyRequisitions,
  getRequisition,
  updateRequisitionStatus,
  searchDonors,
  notifySelectedDonors,
  notifyAllDonors,
  getWillingDonors,
  
  // Donor discovery system (Phase 3)
  discoverRequisitions,
  
  // Donor notifications & responses
  getMyNotifications,
  markNotificationRead,
  respondToNotification,
  respondToRequisition,
  
  // Helper functions
  notifySeekerOfResponse
};