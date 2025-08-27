// src/services/membership.service.js
const { prisma } = require('../config/database');
const { CacheService } = require('../config/redis');

class MembershipService {
  /**
   * Get applicable membership fee for a user's batch
   * @param {number} userBatchYear - User's batch year
   * @param {number|null} membershipYear - Membership year (defaults to current year)
   * @returns {Object} Fee information
   */
  static async getMembershipFee(userBatchYear, membershipYear = null) {
    const currentYear = membershipYear || new Date().getFullYear();
    
    try {
      // Check if global setting is active and applies to all
      const globalSetting = await prisma.globalMembershipSettings.findFirst({
        where: { 
          membershipYear: currentYear,
          isActive: true, 
          applyToAll: true 
        }
      });
      
      if (globalSetting) {
        return {
          fee: globalSetting.membershipFee,
          type: 'GLOBAL',
          settings: globalSetting,
          description: globalSetting.description || `Global membership fee for ${currentYear}`
        };
      }
      
      // Check batch-specific setting
      const batchSetting = await prisma.batchMembershipSettings.findFirst({
        where: { 
          batchYear: userBatchYear, 
          membershipYear: currentYear,
          isActive: true
        },
        include: {
          batch: {
            select: { name: true }
          }
        }
      });
      
      if (batchSetting) {
        return {
          fee: batchSetting.membershipFee,
          type: 'BATCH_SPECIFIC',
          settings: batchSetting,
          description: batchSetting.description || `Membership fee for ${batchSetting.batch.name}`
        };
      }
      
      return {
        fee: 0,
        type: 'NOT_CONFIGURED',
        settings: null,
        description: 'Membership fee not configured'
      };
      
    } catch (error) {
      console.error('Get membership fee error:', error);
      throw new Error('Failed to determine membership fee');
    }
  }
  
  /**
   * Check if membership is required for the organization
   * @returns {boolean} True if membership is required
   */
  static async isMembershipRequired() {
    try {
      const cacheKey = 'organization:membership:required';
      
      // Check cache first
      let isRequired = await CacheService.get(cacheKey);
      
      if (isRequired === null) {
        // Check if any membership settings exist and are active
        const [globalExists, batchExists] = await Promise.all([
          prisma.globalMembershipSettings.findFirst({
            where: { isActive: true }
          }),
          prisma.batchMembershipSettings.findFirst({
            where: { isActive: true }
          })
        ]);
        
        isRequired = !!(globalExists || batchExists);
        
        // Cache for 1 hour
        await CacheService.set(cacheKey, isRequired, 60 * 60);
      }
      
      return isRequired;
    } catch (error) {
      console.error('Check membership required error:', error);
      return false;
    }
  }
  
  /**
   * Check user's current membership status
   * @param {string} userId - User ID
   * @returns {Object} Membership status information
   */
  static async getUserMembershipStatus(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          batch: true,
          membershipStatus: true,
          currentMembershipYear: true,
          membershipExpiresAt: true,
          membershipAmountPaid: true,
          membershipPaidAt: true,
          role: true
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Super admins bypass membership requirements
      if (user.role === 'SUPER_ADMIN') {
        return {
          status: 'ACTIVE',
          isRequired: false,
          exemptReason: 'SUPER_ADMIN',
          user: user
        };
      }
      
      const isRequired = await this.isMembershipRequired();
      if (!isRequired) {
        return {
          status: 'ACTIVE',
          isRequired: false,
          exemptReason: 'NOT_REQUIRED',
          user: user
        };
      }
      
      const currentYear = new Date().getFullYear();
      const isCurrentYearPaid = user.currentMembershipYear === currentYear;
      const hasNotExpired = user.membershipExpiresAt && user.membershipExpiresAt > new Date();
      
      let status = 'EXPIRED';
      if (isCurrentYearPaid && hasNotExpired) {
        status = 'ACTIVE';
      } else if (user.membershipStatus === 'PENDING') {
        status = 'PENDING';
      }
      
      return {
        status,
        isRequired: true,
        currentYear,
        paidYear: user.currentMembershipYear,
        expiresAt: user.membershipExpiresAt,
        amountPaid: user.membershipAmountPaid,
        paidAt: user.membershipPaidAt,
        user: user
      };
      
    } catch (error) {
      console.error('Get user membership status error:', error);
      throw error;
    }
  }
  
  /**
   * Process successful membership payment
   * @param {string} userId - User ID
   * @param {string} transactionId - Payment transaction ID
   * @param {number} amount - Payment amount
   * @returns {boolean} Success status
   */
  static async processMembershipPayment(userId, transactionId, amount) {
    try {
      const currentYear = new Date().getFullYear();
      const nextYear = new Date(currentYear + 1, 0, 1); // January 1st next year
      
      // Update user's membership status in a transaction
      await prisma.$transaction(async (tx) => {
        // Update user's membership status
        await tx.user.update({
          where: { id: userId },
          data: {
            membershipStatus: 'ACTIVE',
            currentMembershipYear: currentYear,
            membershipPaidAt: new Date(),
            membershipExpiresAt: nextYear,
            membershipAmountPaid: amount
          }
        });
        
        // Create activity log
        await tx.activityLog.create({
          data: {
            userId: userId,
            action: 'membership_payment_completed',
            details: {
              transactionId,
              amount: amount.toString(),
              membershipYear: currentYear,
              expiresAt: nextYear.toISOString()
            }
          }
        });
      });
      
      // Clear membership cache for this user
      await this.clearUserMembershipCache(userId);
      
      console.log(`✅ Membership activated for user ${userId}, year ${currentYear}`);
      return true;
    } catch (error) {
      console.error('Process membership payment error:', error);
      throw error;
    }
  }
  
  /**
   * Get batch admin assignments for a specific batch
   * @param {number} batchYear - Batch year
   * @returns {Array} List of batch admin assignments
   */
  static async getBatchAdmins(batchYear) {
    try {
      const cacheKey = `batch:${batchYear}:admins`;
      
      // Check cache first
      let assignments = await CacheService.get(cacheKey);
      
      if (!assignments) {
        assignments = await prisma.batchAdminAssignment.findMany({
          where: { 
            batchYear: batchYear,
            isActive: true 
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profileImage: true,
                membershipStatus: true,
                currentMembershipYear: true
              }
            },
            assigner: {
              select: {
                fullName: true
              }
            }
          },
          orderBy: { assignedAt: 'desc' }
        });
        
        // Cache for 15 minutes
        await CacheService.set(cacheKey, assignments, 15 * 60);
      }
      
      return assignments;
    } catch (error) {
      console.error('Get batch admins error:', error);
      throw error;
    }
  }
  
  /**
   * Check if user is batch admin for specific batch
   * @param {string} userId - User ID
   * @param {number} batchYear - Batch year
   * @returns {boolean} True if user is batch admin
   */
  static async isBatchAdmin(userId, batchYear) {
    try {
      const cacheKey = `user:${userId}:batch:${batchYear}:admin`;
      
      // Check cache first
      let isBatchAdmin = await CacheService.get(cacheKey);
      
      if (isBatchAdmin === null) {
        // Super admins have access to all batches
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true }
        });
        
        if (user?.role === 'SUPER_ADMIN') {
          isBatchAdmin = true;
        } else {
          // Check specific batch admin assignment
          const assignment = await prisma.batchAdminAssignment.findFirst({
            where: {
              userId: userId,
              batchYear: batchYear,
              isActive: true
            }
          });
          
          isBatchAdmin = !!assignment;
        }
        
        // Cache for 30 minutes
        await CacheService.set(cacheKey, isBatchAdmin, 30 * 60);
      }
      
      return isBatchAdmin;
    } catch (error) {
      console.error('Check batch admin error:', error);
      return false;
    }
  }
  
  /**
   * Assign users as batch admins for a specific batch
   * @param {Array} userIds - Array of user IDs
   * @param {number} batchYear - Batch year
   * @param {string} assignedBy - Admin user ID who is making the assignment
   * @returns {Array} Created assignments
   */
  static async assignBatchAdmins(userIds, batchYear, assignedBy) {
    try {
      const assignments = [];
      
      await prisma.$transaction(async (tx) => {
        for (const userId of userIds) {
          // Check if assignment already exists
          const existingAssignment = await tx.batchAdminAssignment.findUnique({
            where: {
              userId_batchYear: {
                userId: userId,
                batchYear: batchYear
              }
            }
          });
          
          if (existingAssignment) {
            // Reactivate if inactive
            if (!existingAssignment.isActive) {
              const updated = await tx.batchAdminAssignment.update({
                where: { id: existingAssignment.id },
                data: {
                  isActive: true,
                  assignedBy: assignedBy,
                  assignedAt: new Date()
                }
              });
              assignments.push(updated);
            }
          } else {
            // Create new assignment
            const newAssignment = await tx.batchAdminAssignment.create({
              data: {
                userId: userId,
                batchYear: batchYear,
                assignedBy: assignedBy
              }
            });
            assignments.push(newAssignment);
          }
          
          // Log activity
          await tx.activityLog.create({
            data: {
              userId: assignedBy,
              action: 'batch_admin_assigned',
              details: {
                assignedUserId: userId,
                batchYear: batchYear
              }
            }
          });
        }
      });
      
      // Clear related caches
      await this.clearBatchAdminCaches(batchYear, userIds);
      
      return assignments;
    } catch (error) {
      console.error('Assign batch admins error:', error);
      throw error;
    }
  }
  
  /**
   * Remove users as batch admins for a specific batch
   * @param {Array} userIds - Array of user IDs
   * @param {number} batchYear - Batch year
   * @param {string} removedBy - Admin user ID who is removing the assignment
   * @returns {number} Number of assignments removed
   */
  static async removeBatchAdmins(userIds, batchYear, removedBy) {
    try {
      let removedCount = 0;
      
      await prisma.$transaction(async (tx) => {
        // Deactivate assignments
        const result = await tx.batchAdminAssignment.updateMany({
          where: {
            userId: { in: userIds },
            batchYear: batchYear,
            isActive: true
          },
          data: {
            isActive: false
          }
        });
        
        removedCount = result.count;
        
        // Log activities
        for (const userId of userIds) {
          await tx.activityLog.create({
            data: {
              userId: removedBy,
              action: 'batch_admin_removed',
              details: {
                removedUserId: userId,
                batchYear: batchYear
              }
            }
          });
        }
      });
      
      // Clear related caches
      await this.clearBatchAdminCaches(batchYear, userIds);
      
      return removedCount;
    } catch (error) {
      console.error('Remove batch admins error:', error);
      throw error;
    }
  }
  
  /**
   * Clear user membership cache
   * @param {string} userId - User ID
   */
  static async clearUserMembershipCache(userId) {
    try {
      await Promise.all([
        CacheService.del(`user:${userId}:membership:status`),
        CacheService.delPattern(`user:${userId}:batch:*:admin`)
      ]);
    } catch (error) {
      console.error('Clear user membership cache error:', error);
    }
  }
  
  /**
   * Clear batch admin related caches
   * @param {number} batchYear - Batch year
   * @param {Array} userIds - User IDs (optional)
   */
  static async clearBatchAdminCaches(batchYear, userIds = []) {
    try {
      const promises = [
        CacheService.del(`batch:${batchYear}:admins`)
      ];
      
      // Clear individual user batch admin caches
      userIds.forEach(userId => {
        promises.push(
          CacheService.delPattern(`user:${userId}:batch:*:admin`)
        );
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Clear batch admin caches error:', error);
    }
  }
  
  /**
   * Get membership statistics for admin dashboard
   * @returns {Object} Membership statistics
   */
  static async getMembershipStatistics() {
    try {
      const currentYear = new Date().getFullYear();
      
      // Get overall statistics
      const [statusCounts, yearlyStats, totalRevenue] = await Promise.all([
        // Count by membership status
        prisma.user.groupBy({
          by: ['membershipStatus'],
          where: {
            isActive: true,
            role: { in: ['USER', 'BATCH_ADMIN'] }
          },
          _count: true
        }),
        
        // Current year statistics
        prisma.user.aggregate({
          where: {
            isActive: true,
            currentMembershipYear: currentYear,
            role: { in: ['USER', 'BATCH_ADMIN'] }
          },
          _count: true,
          _sum: {
            membershipAmountPaid: true
          }
        }),
        
        // Total revenue from membership payments
        prisma.paymentTransaction.aggregate({
          where: {
            referenceType: 'MEMBERSHIP',
            status: 'COMPLETED'
          },
          _sum: {
            amount: true
          }
        })
      ]);
      
      return {
        statusBreakdown: statusCounts.reduce((acc, item) => {
          acc[item.membershipStatus] = item._count;
          return acc;
        }, {}),
        currentYear: {
          year: currentYear,
          activeMemberships: yearlyStats._count,
          revenue: yearlyStats._sum.membershipAmountPaid || 0
        },
        totalRevenue: totalRevenue._sum.amount || 0
      };
    } catch (error) {
      console.error('Get membership statistics error:', error);
      throw error;
    }
  }
}

module.exports = MembershipService;