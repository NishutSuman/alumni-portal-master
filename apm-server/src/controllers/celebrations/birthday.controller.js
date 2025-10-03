// src/controllers/celebrations/birthday.controller.js
const BirthdayService = require('../../services/birthday/BirthdayService');
const { successResponse, errorResponse } = require('../../utils/response');

/**
 * Get today's birthdays
 * GET /api/celebrations/birthdays/today
 * Access: Authenticated users
 */
const getTodaysBirthdays = async (req, res) => {
  try {
    const birthdays = await BirthdayService.getTodaysBirthdays();
    
    return successResponse(
      res,
      {
        birthdays,
        count: birthdays.length,
        date: new Date().toISOString().split('T')[0]
      },
      birthdays.length > 0 
        ? `Found ${birthdays.length} birthday(s) today`
        : 'No birthdays today'
    );
  } catch (error) {
    console.error('Get today\'s birthdays error:', error);
    return errorResponse(res, 'Failed to fetch today\'s birthdays', 500);
  }
};

/**
 * Get upcoming birthdays
 * GET /api/celebrations/birthdays/upcoming
 * Access: Authenticated users
 */
const getUpcomingBirthdays = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const upcomingBirthdays = await BirthdayService.getUpcomingBirthdays(parseInt(days));
    
    return successResponse(
      res,
      {
        upcomingBirthdays,
        totalDays: upcomingBirthdays.length,
        lookAheadDays: parseInt(days)
      },
      `Found birthdays in next ${days} days`
    );
  } catch (error) {
    console.error('Get upcoming birthdays error:', error);
    return errorResponse(res, 'Failed to fetch upcoming birthdays', 500);
  }
};

/**
 * Get birthday statistics
 * GET /api/celebrations/birthdays/stats
 * Access: Admin
 */
const getBirthdayStats = async (req, res) => {
  try {
    const stats = await BirthdayService.getBirthdayStats();
    
    return successResponse(res, stats, 'Birthday statistics retrieved successfully');
  } catch (error) {
    console.error('Get birthday stats error:', error);
    return errorResponse(res, 'Failed to fetch birthday statistics', 500);
  }
};

/**
 * Get birthday distribution by month
 * GET /api/celebrations/birthdays/distribution
 * Access: Admin
 */
const getBirthdayDistribution = async (req, res) => {
  try {
    const distribution = await BirthdayService.getBirthdayDistribution();
    
    return successResponse(res, distribution, 'Birthday distribution retrieved successfully');
  } catch (error) {
    console.error('Get birthday distribution error:', error);
    return errorResponse(res, 'Failed to fetch birthday distribution', 500);
  }
};

/**
 * Get birthdays in specific month
 * GET /api/celebrations/birthdays/month/:month
 * Access: Admin
 */
const getBirthdaysInMonth = async (req, res) => {
  try {
    const { month } = req.params;
    const { year } = req.query;
    
    const birthdays = await BirthdayService.getBirthdaysInMonth(
      parseInt(month), 
      year ? parseInt(year) : undefined
    );
    
    return successResponse(
      res,
      {
        birthdays,
        month: parseInt(month),
        year: year || new Date().getFullYear(),
        count: birthdays.length
      },
      `Found ${birthdays.length} birthdays in month ${month}`
    );
  } catch (error) {
    console.error('Get birthdays in month error:', error);
    return errorResponse(res, 'Failed to fetch birthdays for month', 500);
  }
};

/**
 * Manually trigger birthday notifications (Admin testing)
 * POST /api/celebrations/birthdays/trigger
 * Access: SUPER_ADMIN
 */
const triggerBirthdayNotifications = async (req, res) => {
  try {
    const result = await BirthdayService.triggerTodaysBirthdayNotifications();
    
    return successResponse(res, result, 'Birthday notifications triggered successfully');
  } catch (error) {
    console.error('Trigger birthday notifications error:', error);
    return errorResponse(res, 'Failed to trigger birthday notifications', 500);
  }
};

/**
 * Manually trigger birthday emails (Admin testing)
 * POST /api/celebrations/birthdays/emails/trigger
 * Access: SUPER_ADMIN
 */
const triggerBirthdayEmails = async (req, res) => {
  try {
    const result = await BirthdayService.sendBirthdayEmails();
    
    return successResponse(res, result, 'Birthday emails triggered successfully');
  } catch (error) {
    console.error('Trigger birthday emails error:', error);
    return errorResponse(res, 'Failed to trigger birthday emails', 500);
  }
};

module.exports = {
  getTodaysBirthdays,
  getUpcomingBirthdays,
  getBirthdayStats,
  getBirthdayDistribution,
  getBirthdaysInMonth,
  triggerBirthdayNotifications,
  triggerBirthdayEmails
};