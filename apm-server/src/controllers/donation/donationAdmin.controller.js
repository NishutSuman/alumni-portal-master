const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../../utils/response');

const prisma = new PrismaClient();

class DonationAdminController {

  // Get all donations with admin details
  async getAllDonations(req, res) {
    try {
      const { page = 1, limit = 20, year, minAmount } = req.query;
      const skip = (page - 1) * limit;

      // Build where clause
      const whereClause = {
        referenceType: 'DONATION',
        status: 'COMPLETED'
      };

      if (year) {
        whereClause.completedAt = {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        };
      }

      if (minAmount) {
        whereClause.amount = { gte: parseFloat(minAmount) };
      }

      const [donations, totalCount] = await Promise.all([
        prisma.paymentTransaction.findMany({
          where: whereClause,
          orderBy: { completedAt: 'desc' },
          skip,
          take: parseInt(limit),
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                batchYear: true,
                whatsappNumber: true
              }
            }
          }
        }),
        prisma.paymentTransaction.count({ where: whereClause })
      ]);

      // Get summary stats
      const summary = await prisma.paymentTransaction.aggregate({
        where: whereClause,
        _sum: { amount: true },
        _avg: { amount: true }
      });

      return successResponse(res, {
        donations: donations.map(donation => ({
          id: donation.id,
          amount: donation.amount,
          description: donation.description,
          donatedAt: donation.completedAt,
          transactionId: donation.razorpayPaymentId,
          message: donation.metadata?.message || null,
          donor: {
            name: donation.user.fullName,
            email: donation.user.email,
            batch: donation.user.batchYear,
            phone: donation.user.whatsappNumber
          }
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        summary: {
          totalAmount: summary._sum.amount || 0,
          averageAmount: summary._avg.amount || 0,
          donationCount: totalCount
        }
      });

    } catch (error) {
      console.error('Get all donations error:', error);
      return errorResponse(res, 'Failed to fetch donations', 500);
    }
  }

  // Get donation analytics for admin
  async getDonationAnalytics(req, res) {
    try {
      const { year } = req.query;
      const currentYear = year || new Date().getFullYear();

      // Monthly donation trends
      const monthlyTrends = await prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM completed_at) as month,
          SUM(amount) as total_amount,
          COUNT(*) as donation_count,
          AVG(amount) as average_amount
        FROM payment_transactions
        WHERE 
          reference_type = 'DONATION' 
          AND status = 'COMPLETED'
          AND EXTRACT(YEAR FROM completed_at) = ${parseInt(currentYear)}
        GROUP BY EXTRACT(MONTH FROM completed_at)
        ORDER BY month
      `;

      // Top donors this year
      const topDonors = await prisma.paymentTransaction.groupBy({
        by: ['userId'],
        where: {
          referenceType: 'DONATION',
          status: 'COMPLETED',
          completedAt: {
            gte: new Date(`${currentYear}-01-01`),
            lte: new Date(`${currentYear}-12-31`)
          }
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10
      });

      // Get donor details
      const userIds = topDonors.map(donor => donor.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, batchYear: true }
      });

      // Batch-wise donation breakdown
      const batchBreakdown = await prisma.$queryRaw`
        SELECT 
          u.batch_year,
          SUM(pt.amount) as total_amount,
          COUNT(pt.id) as donation_count,
          COUNT(DISTINCT pt.user_id) as unique_donors
        FROM payment_transactions pt
        JOIN users u ON pt.user_id = u.id
        WHERE 
          pt.reference_type = 'DONATION' 
          AND pt.status = 'COMPLETED'
          AND EXTRACT(YEAR FROM pt.completed_at) = ${parseInt(currentYear)}
        GROUP BY u.batch_year
        ORDER BY total_amount DESC
      `;

      // Format monthly trends
      const formattedMonthlyTrends = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        totalAmount: 0,
        donationCount: 0,
        averageAmount: 0
      }));

      monthlyTrends.forEach(trend => {
        const monthIndex = parseInt(trend.month) - 1;
        formattedMonthlyTrends[monthIndex] = {
          month: parseInt(trend.month),
          totalAmount: parseFloat(trend.total_amount || 0),
          donationCount: parseInt(trend.donation_count || 0),
          averageAmount: parseFloat(trend.average_amount || 0)
        };
      });

      // Format top donors
      const formattedTopDonors = topDonors.map(donor => {
        const user = users.find(u => u.id === donor.userId);
        return {
          donorName: user?.fullName || 'Unknown',
          batchYear: user?.batchYear,
          totalAmount: donor._sum.amount || 0,
          donationCount: donor._count
        };
      });

      return successResponse(res, {
        analytics: {
          year: parseInt(currentYear),
          monthlyTrends: formattedMonthlyTrends,
          topDonors: formattedTopDonors,
          batchBreakdown: batchBreakdown.map(batch => ({
            batchYear: batch.batch_year,
            totalAmount: parseFloat(batch.total_amount || 0),
            donationCount: parseInt(batch.donation_count || 0),
            uniqueDonors: parseInt(batch.unique_donors || 0)
          }))
        }
      });

    } catch (error) {
      console.error('Get donation analytics error:', error);
      return errorResponse(res, 'Failed to fetch donation analytics', 500);
    }
  }
}

module.exports = new DonationAdminController();