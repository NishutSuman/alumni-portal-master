// src/services/blood-compatibility.service.js
// LifeLink Network - Blood Compatibility Service
// Medical-grade blood compatibility logic

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Blood Compatibility Matrix - Medical Standard
 * Key: Recipient blood type
 * Value: Array of compatible donor blood types
 */
const BLOOD_COMPATIBILITY = {
  'A_POSITIVE': ['A_POSITIVE', 'A_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  'A_NEGATIVE': ['A_NEGATIVE', 'O_NEGATIVE'],
  'B_POSITIVE': ['B_POSITIVE', 'B_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  'B_NEGATIVE': ['B_NEGATIVE', 'O_NEGATIVE'],
  'AB_POSITIVE': ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  'AB_NEGATIVE': ['A_NEGATIVE', 'B_NEGATIVE', 'AB_NEGATIVE', 'O_NEGATIVE'],
  'O_POSITIVE': ['O_POSITIVE', 'O_NEGATIVE'],
  'O_NEGATIVE': ['O_NEGATIVE'] // Universal donor
};

/**
 * Reverse compatibility mapping
 * Key: Donor blood type  
 * Value: Array of recipient blood types who can receive
 */
const DONOR_COMPATIBILITY = {
  'O_NEGATIVE': ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'],
  'O_POSITIVE': ['A_POSITIVE', 'B_POSITIVE', 'AB_POSITIVE', 'O_POSITIVE'],
  'A_NEGATIVE': ['A_POSITIVE', 'A_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE'],
  'A_POSITIVE': ['A_POSITIVE', 'AB_POSITIVE'],
  'B_NEGATIVE': ['B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE'],
  'B_POSITIVE': ['B_POSITIVE', 'AB_POSITIVE'],
  'AB_NEGATIVE': ['AB_POSITIVE', 'AB_NEGATIVE'],
  'AB_POSITIVE': ['AB_POSITIVE']
};

class BloodCompatibilityService {
  
  /**
   * Get compatible donor blood types for a recipient
   * @param {string} recipientBloodGroup - Recipient's blood group
   * @returns {Array<string>} Compatible donor blood groups
   */
  static getCompatibleDonors(recipientBloodGroup) {
    if (!recipientBloodGroup || !BLOOD_COMPATIBILITY[recipientBloodGroup]) {
      throw new Error(`Invalid recipient blood group: ${recipientBloodGroup}`);
    }
    
    return BLOOD_COMPATIBILITY[recipientBloodGroup];
  }

  /**
   * Get compatible recipients for a donor
   * @param {string} donorBloodGroup - Donor's blood group
   * @returns {Array<string>} Compatible recipient blood groups
   */
  static getCompatibleRecipients(donorBloodGroup) {
    if (!donorBloodGroup || !DONOR_COMPATIBILITY[donorBloodGroup]) {
      throw new Error(`Invalid donor blood group: ${donorBloodGroup}`);
    }
    
    return DONOR_COMPATIBILITY[donorBloodGroup];
  }

  /**
   * Check if donor can donate to recipient
   * @param {string} donorBloodGroup - Donor's blood group
   * @param {string} recipientBloodGroup - Recipient's blood group
   * @returns {boolean} True if compatible
   */
  static isCompatible(donorBloodGroup, recipientBloodGroup) {
    try {
      const compatibleDonors = this.getCompatibleDonors(recipientBloodGroup);
      return compatibleDonors.includes(donorBloodGroup);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user is eligible to donate (3-month rule)
   * @param {Date|null} lastDonationDate - Last donation date
   * @returns {Object} Eligibility status and next eligible date
   */
  static checkDonorEligibility(lastDonationDate) {
    const now = new Date();
    
    // First time donor - eligible
    if (!lastDonationDate) {
      return {
        isEligible: true,
        daysSinceLastDonation: null,
        nextEligibleDate: null,
        message: 'Eligible for first-time donation'
      };
    }

    const lastDonation = new Date(lastDonationDate);
    const daysDifference = Math.floor((now - lastDonation) / (1000 * 60 * 60 * 24));
    const minimumWaitDays = 90; // 3 months = 90 days
    
    const isEligible = daysDifference >= minimumWaitDays;
    
    if (isEligible) {
      return {
        isEligible: true,
        daysSinceLastDonation: daysDifference,
        nextEligibleDate: null,
        message: `Eligible - Last donated ${daysDifference} days ago`
      };
    }

    // Calculate next eligible date
    const nextEligibleDate = new Date(lastDonation);
    nextEligibleDate.setDate(nextEligibleDate.getDate() + minimumWaitDays);
    const daysRemaining = minimumWaitDays - daysDifference;

    return {
      isEligible: false,
      daysSinceLastDonation: daysDifference,
      nextEligibleDate,
      daysRemaining,
      message: `Must wait ${daysRemaining} more days (Last donated ${daysDifference} days ago)`
    };
  }

  /**
   * Find compatible and eligible donors for a blood requisition
   * @param {string} requiredBloodGroup - Required blood group
   * @param {string} location - Search location (city/area)
   * @param {number} limit - Maximum donors to return
   * @returns {Promise<Array>} Available donors with eligibility info
   */
  static async findAvailableDonors(requiredBloodGroup, location, limit = 50) {
    try {
      // Get compatible donor blood groups
      const compatibleBloodGroups = this.getCompatibleDonors(requiredBloodGroup);
      
      // Debug: Check total blood donors first
      const totalBloodDonors = await prisma.user.count({
        where: {
          isBloodDonor: true,
          isActive: true
        }
      });
      
      console.log(`🩸 Total blood donors in database: ${totalBloodDonors}`);
      console.log(`🩸 Searching for blood groups: ${compatibleBloodGroups.join(', ')}`);
      console.log(`🩸 Searching in location: ${location}`);

      // Find donors in database with broader search
      const donors = await prisma.user.findMany({
        where: {
          isBloodDonor: true,
          isActive: true,
          bloodGroup: {
            in: compatibleBloodGroups
          },
          // Broader location search including both current and permanent addresses
          OR: [
            // Address-based search
            {
              addresses: {
                some: {
                  OR: [
                    { city: { contains: location, mode: 'insensitive' } },
                    { state: { contains: location, mode: 'insensitive' } },
                    { district: { contains: location, mode: 'insensitive' } }
                  ]
                }
              }
            },
            // If no specific location filtering needed, remove this constraint for testing
            ...(location.toLowerCase() === 'any' ? [{}] : [])
          ]
        },
        select: {
          id: true,
          fullName: true,
          bloodGroup: true,
          lastBloodDonationDate: true,
          totalBloodDonations: true,
          showPhone: true,
          whatsappNumber: true,
          addresses: {
            select: {
              city: true,
              state: true,
              addressType: true
            }
          }
        },
        take: limit * 2 // Get more to filter eligible ones
      });

      console.log(`🩸 Found ${donors.length} donors matching criteria`);

      // If no donors found with location filter, try without location for testing
      if (donors.length === 0) {
        console.log(`🩸 No donors found with location filter, trying without location...`);
        const fallbackDonors = await prisma.user.findMany({
          where: {
            isBloodDonor: true,
            isActive: true,
            bloodGroup: {
              in: compatibleBloodGroups
            }
          },
          select: {
            id: true,
            fullName: true,
            bloodGroup: true,
            lastBloodDonationDate: true,
            totalBloodDonations: true,
            showPhone: true,
            whatsappNumber: true,
            addresses: {
              select: {
                city: true,
                state: true,
                addressType: true
              }
            }
          },
          take: limit
        });
        console.log(`🩸 Fallback search found ${fallbackDonors.length} donors`);
        // Use fallback donors if found
        if (fallbackDonors.length > 0) {
          const formattedDonors = this.formatDonorResults(fallbackDonors, limit);
          return this.shuffleArray(formattedDonors);
        }
      }

      // Format and return regular search results
      // For search/counting, show ALL donors (including ineligible) so requester knows total pool
      const formattedDonors = this.formatDonorResults(donors, limit, false);
      return formattedDonors; // Don't shuffle for search - keep sorted by eligibility
      
    } catch (error) {
      console.error('Find available donors error:', error);
      throw new Error('Failed to find available donors');
    }
  }

  /**
   * Add donation record and update donor stats
   * @param {string} donorId - Donor user ID
   * @param {Object} donationData - Donation details
   * @returns {Promise<Object>} Created donation record
   */
  static async recordDonation(donorId, donationData) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Create donation record
        const donation = await tx.bloodDonation.create({
          data: {
            donorId,
            donationDate: donationData.donationDate || new Date(),
            location: donationData.location,
            units: donationData.units || 1,
            notes: donationData.notes
          }
        });

        // Update donor statistics
        await tx.user.update({
          where: { id: donorId },
          data: {
            lastBloodDonationDate: donation.donationDate,
            totalBloodDonations: {
              increment: 1  // Count of donation events (how many times donated)
            },
            totalUnitsDonated: {
              increment: donation.units  // Total units donated
            }
          }
        });

        return donation;
      });
    } catch (error) {
      console.error('Record donation error:', error);
      throw new Error('Failed to record donation');
    }
  }

  /**
   * Format donor results with eligibility info
   * @param {Array} donors - Raw donor data from database
   * @param {number} limit - Maximum donors to return
   * @param {boolean} eligibleOnly - Filter to show only eligible donors (default: true)
   * @returns {Array} Formatted donor results
   */
  static formatDonorResults(donors, limit, eligibleOnly = true) {
    const formatted = donors
      .map(donor => {
        const eligibility = this.checkDonorEligibility(donor.lastBloodDonationDate);

        return {
          id: donor.id,
          name: donor.fullName || 'Unknown',
          bloodGroup: donor.bloodGroup,
          totalDonations: donor.totalBloodDonations,
          location: donor.addresses[0] ? `${donor.addresses[0].city}, ${donor.addresses[0].state}` : 'Location not specified',
          eligibility,
          contactAvailable: donor.showPhone,
          phone: donor.showPhone ? donor.whatsappNumber : null
        };
      })
      .sort((a, b) => {
        // Sort eligible donors first, then by total donations
        if (a.eligibility.isEligible !== b.eligibility.isEligible) {
          return b.eligibility.isEligible ? 1 : -1;
        }
        if (b.totalDonations !== a.totalDonations) {
          return b.totalDonations - a.totalDonations;
        }
        return (b.eligibility.daysSinceLastDonation || 999) - (a.eligibility.daysSinceLastDonation || 999);
      });

    // Filter by eligibility if requested
    const filtered = eligibleOnly
      ? formatted.filter(donor => donor.eligibility.isEligible)
      : formatted;

    return filtered.slice(0, limit);
  }

  /**
   * Shuffle array for fair donor distribution
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  static shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get blood group statistics
   * @returns {Promise<Object>} Blood group distribution stats
   */
  static async getBloodGroupStats() {
    try {
      const stats = await prisma.user.groupBy({
        by: ['bloodGroup'],
        where: {
          isBloodDonor: true,
          isActive: true,
          bloodGroup: { not: null }
        },
        _count: {
          bloodGroup: true
        }
      });

      return stats.reduce((acc, stat) => {
        acc[stat.bloodGroup] = stat._count.bloodGroup;
        return acc;
      }, {});
    } catch (error) {
      console.error('Get blood group stats error:', error);
      throw new Error('Failed to get blood group statistics');
    }
  }
}

module.exports = BloodCompatibilityService;