const { prisma } = require('../../config/database');

class MembershipAdminService {
  /**
   * Get users by membership status with batch filtering
   */
  static async getUsersByStatus(status, batchYear = null) {
    const whereClause = {
      isActive: true,
      role: { in: ['USER', 'BATCH_ADMIN'] },
      membershipStatus: status
    };
    
    if (batchYear) {
      whereClause.batch = batchYear;
    }
    
    return await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        email: true,
        batch: true,
        membershipStatus: true,
        membershipExpiresAt: true,
        membershipAmountPaid: true,
        lastLoginAt: true
      },
      orderBy: [
        { batch: 'desc' },
        { fullName: 'asc' }
      ]
    });
  }
  
  /**
   * Auto-expire memberships that have passed their expiry date
   */
  static async autoExpireMemberships() {
    try {
      const now = new Date();
      
      const result = await prisma.user.updateMany({
        where: {
          membershipStatus: 'ACTIVE',
          membershipExpiresAt: {
            lt: now
          }
        },
        data: {
          membershipStatus: 'EXPIRED'
        }
      });
      
      console.log(`✅ Auto-expired ${result.count} memberships`);
      return result.count;
    } catch (error) {
      console.error('Auto-expire memberships error:', error);
      return 0;
    }
  }
  
  /**
   * Get membership statistics for specific batch
   */
  static async getBatchMembershipStats(batchYear) {
    const stats = await prisma.user.groupBy({
      by: ['membershipStatus'],
      where: {
        isActive: true,
        batch: batchYear,
        role: { in: ['USER', 'BATCH_ADMIN'] }
      },
      _count: true,
      _sum: {
        membershipAmountPaid: true
      }
    });
    
    const result = {
      batch: batchYear,
      totalUsers: 0,
      totalRevenue: 0,
      breakdown: {}
    };
    
    stats.forEach(stat => {
      result.totalUsers += stat._count;
      result.totalRevenue += parseFloat(stat._sum.membershipAmountPaid || 0);
      result.breakdown[stat.membershipStatus] = {
        count: stat._count,
        revenue: parseFloat(stat._sum.membershipAmountPaid || 0)
      };
    });
    
    return result;
  }
}

module.exports = MembershipAdminService;