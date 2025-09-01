// src/controllers/membership.controller.js
const MembershipService = require('../../services/membership/membership.service');
const PaymentService = require('../../services/payment/PaymentService');
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Get user's membership status and fee information
 */
const getMembershipStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const userBatch = req.user.batch;
    
    const [membershipStatus, feeInfo] = await Promise.all([
      MembershipService.getUserMembershipStatus(userId),
      MembershipService.getMembershipFee(userBatch)
    ]);
    
    return successResponse(res, {
      membershipStatus,
      feeInfo,
      currentYear: new Date().getFullYear()
    }, 'Membership status retrieved successfully');
    
  } catch (error) {
    console.error('Get membership status error:', error);
    return errorResponse(res, 'Failed to retrieve membership status', 500);
  }
};

/**
 * Get applicable membership fee for user's batch
 */
const getMembershipFee = async (req, res) => {
  try {
    const userBatch = req.user.batch;
    const feeInfo = await MembershipService.getMembershipFee(userBatch);
    
    return successResponse(res, {
      batch: userBatch,
      fee: feeInfo.fee,
      type: feeInfo.type,
      year: new Date().getFullYear(),
      settings: feeInfo.settings
    }, 'Membership fee retrieved successfully');
    
  } catch (error) {
    console.error('Get membership fee error:', error);
    return errorResponse(res, 'Failed to retrieve membership fee', 500);
  }
};

/**
 * Initiate membership payment
 */
const initiateMembershipPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const userBatch = req.user.batch;
    
    // Get applicable fee
    const feeInfo = await MembershipService.getMembershipFee(userBatch);
    
    if (feeInfo.fee <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Membership fee not configured for your batch'
      });
    }
    
    // Create payment transaction
    const paymentData = {
      userId: userId,
      referenceType: 'MEMBERSHIP',
      referenceId: userId,
      amount: feeInfo.fee,
      description: `Annual Membership Fee ${new Date().getFullYear()} - Batch ${userBatch}`,
      metadata: {
        membershipYear: new Date().getFullYear(),
        batchYear: userBatch,
        feeType: feeInfo.type
      }
    };
    
    const transaction = await PaymentService.initiatePayment(paymentData);
    
    return successResponse(res, {
      transaction,
      membershipFee: feeInfo.fee,
      membershipYear: new Date().getFullYear()
    }, 'Membership payment initiated successfully');
    
  } catch (error) {
    console.error('Initiate membership payment error:', error);
    return errorResponse(res, 'Failed to initiate membership payment', 500);
  }
};

module.exports = {
  getMembershipStatus,
  getMembershipFee,
  initiateMembershipPayment
};