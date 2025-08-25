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
      
      // Find donors in database
      const donors = await prisma.user.findMany({
        where: {
          isBloodDonor: true,
          isActive: true,
          bloodGroup: {
            in: compatibleBloodGroups
          },
          // Location-based search (you may need to adjust this based on your address structure)
          addresses: {
            some: {
              OR: [
                { city: { contains: location, mode: 'insensitive' } },
                { state: { contains: location, mode: 'insensitive' } }
              ]
            }
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          bloodGroup: true,
          lastDonationDate: true,
          totalDonations: true,
          showPhone: true,
          phone: true,
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

      // Filter eligible donors and add eligibility info
      const availableDonors = donors
        .map(donor => {
          const eligibility = this.checkDonorEligibility(donor.lastDonationDate);
          
          return {
            id: donor.id,
            name: `${donor.firstName} ${donor.lastName}`,
            bloodGroup: donor.bloodGroup,
            totalDonations: donor.totalDonations,
            location: donor.addresses[0] ? `${donor.addresses[0].city}, ${donor.addresses[0].state}` : 'Location not specified',
            eligibility,
            contactAvailable: donor.showPhone,
            phone: donor.showPhone ? donor.phone : null
          };
        })
        .filter(donor => donor.eligibility.isEligible) // Only eligible donors
        .sort((a, b) => {
          // Sort by: 1) Total donations (desc), 2) Days since last donation (desc)
          if (b.totalDonations !== a.totalDonations) {
            return b.totalDonations - a.totalDonations;
          }
          return (b.eligibility.daysSinceLastDonation || 999) - (a.eligibility.daysSinceLastDonation || 999);
        })
        .slice(0, limit);

      // Randomize order for fairness (after sorting by experience)
      return this.shuffleArray(availableDonors);
      
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
            lastDonationDate: donation.donationDate,
            totalDonations: {
              increment: donation.units
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