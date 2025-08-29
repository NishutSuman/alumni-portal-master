const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/response');
const PaymentService = require('../services/payment/PaymentService');

const prisma = new PrismaClient();

class DonationController {

  // Initiate alumni donation
  async initiateDonation(req, res) {
    try {
      const { amount, message } = req.body;
      const userId = req.user.id;

      // Validate amount
      if (!amount || amount <= 0 || amount > 100000) {
        return errorResponse(res, 'Donation amount must be between ₹1 and ₹100,000', 400);
      }

      // Get user details
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          email: true,
          batchYear: true,
          whatsappNumber: true
        }
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Use existing PaymentService with DONATION reference type
      const paymentService = new PaymentService();
      
      // Create a custom calculation for donation
      const donationCalculation = {
        success: true,
        breakdown: {
          donationAmount: parseFloat(amount),
          subtotal: parseFloat(amount),
          processingFee: 0, // No processing fee for donations
          total: parseFloat(amount)
        },
        items: [
          {
            type: 'donation',
            description: `Alumni Organization Donation${message ? ' - ' + message : ''}`,
            amount: parseFloat(amount)
          }
        ],
        user: {
          fullName: user.fullName,
          email: user.email,
          whatsappNumber: user.whatsappNumber
        }
      };

      // Create donation transaction using existing payment system
      const transactionData = {
        referenceType: 'DONATION',
        referenceId: 'organization', // Generic reference for org donations
        userId: userId,
        description: `Alumni Organization Donation - ${user.fullName}${message ? ' (' + message + ')' : ''}`,
        calculation: donationCalculation,
        metadata: {
          donationType: 'ORGANIZATION',
          donorBatch: user.batchYear,
          message: message || null,
          isDonationOnly: true
        }
      };

      // Use existing payment initiation logic
      const paymentResult = await paymentService.initiateDonationPayment(transactionData);

      // Log donation activity
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'donation_initiated',
          details: {
            amount: parseFloat(amount),
            transactionId: paymentResult.transaction.id,
            message: message || null
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      return successResponse(res, {
        donation: {
          transactionId: paymentResult.transaction.id,
          amount: parseFloat(amount),
          paymentUrl: paymentResult.paymentUrl,
          message: message || null,
          donor: {
            name: user.fullName,
            batch: user.batchYear
          }
        }
      }, 'Donation payment initiated successfully');

    } catch (error) {
      console.error('Initiate donation error:', error);
      return errorResponse(res, error.message || 'Failed to initiate donation', 500);
    }
  }

  // Get user's donation history
  async getMyDonations(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      // Get user's donation transactions
      const [donations, totalCount] = await Promise.all([
        prisma.paymentTransaction.findMany({
          where: {
            userId,
            referenceType: 'DONATION',
            status: 'COMPLETED'
          },
          orderBy: { completedAt: 'desc' },
          skip,
          take: parseInt(limit),
          select: {
            id: true,
            amount: true,
            description: true,
            completedAt: true,
            razorpayPaymentId: true,
            metadata: true
          }
        }),
        prisma.paymentTransaction.count({
          where: {
            userId,
            referenceType: 'DONATION',
            status: 'COMPLETED'
          }
        })
      ]);

      // Get total donated amount
      const totalDonated = await prisma.paymentTransaction.aggregate({
        where: {
          userId,
          referenceType: 'DONATION',
          status: 'COMPLETED'
        },
        _sum: { amount: true }
      });

      return successResponse(res, {
        donations: donations.map(donation => ({
          id: donation.id,
          amount: donation.amount,
          description: donation.description,
          donatedAt: donation.completedAt,
          transactionId: donation.razorpayPaymentId,
          message: donation.metadata?.message || null
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        },
        summary: {
          totalDonated: totalDonated._sum.amount || 0,
          donationCount: totalCount
        }
      });

    } catch (error) {
      console.error('Get my donations error:', error);
      return errorResponse(res, 'Failed to fetch donation history', 500);
    }
  }

  // Get organization donation stats (for display on donation page)
  async getOrganizationStats(req, res) {
    try {
      // Get all completed donations
      const [totalStats, thisYearStats, recentDonations] = await Promise.all([
        // All time stats
        prisma.paymentTransaction.aggregate({
          where: {
            referenceType: 'DONATION',
            status: 'COMPLETED'
          },
          _sum: { amount: true },
          _count: true
        }),

        // Current year stats
        prisma.paymentTransaction.aggregate({
          where: {
            referenceType: 'DONATION',
            status: 'COMPLETED',
            completedAt: {
              gte: new Date(`${new Date().getFullYear()}-01-01`),
              lte: new Date(`${new Date().getFullYear()}-12-31`)
            }
          },
          _sum: { amount: true },
          _count: true
        }),

        // Recent notable donations (≥ ₹1000)
        prisma.paymentTransaction.findMany({
          where: {
            referenceType: 'DONATION',
            status: 'COMPLETED',
            amount: { gte: 1000 }
          },
          orderBy: { completedAt: 'desc' },
          take: 5,
          include: {
            user: {
              select: { fullName: true, batchYear: true }
            }
          }
        })
      ]);

      return successResponse(res, {
        organizationStats: {
          totalRaised: totalStats._sum.amount || 0,
          totalDonors: totalStats._count,
          thisYearRaised: thisYearStats._sum.amount || 0,
          thisYearDonors: thisYearStats._count,
          recentNotableDonations: recentDonations.map(donation => ({
            amount: donation.amount,
            donorName: donation.user.fullName,
            donorBatch: donation.user.batchYear,
            donatedAt: donation.completedAt
          }))
        }
      });

    } catch (error) {
      console.error('Get organization stats error:', error);
      return errorResponse(res, 'Failed to fetch organization statistics', 500);
    }
  }
}

module.exports = new DonationController();