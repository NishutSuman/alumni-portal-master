// src/utils/response.js

/**
 * Standard success response format
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default: 200)
 */

const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  
  return res.status(statusCode).json(response);
};

/**
 * Standard error response format
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 400)
 * @param {Object} errors - Validation errors or additional error details
 */
const errorResponse = (res, message = 'An error occurred', statusCode = 400, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};

/**
 * Paginated response format
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination info
 * @param {String} message - Success message
 */
const paginatedResponse = (res, data, pagination, message = 'Success') => {
  const response = {
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
      hasNext: pagination.hasNext,
      hasPrev: pagination.hasPrev,
    },
    timestamp: new Date().toISOString(),
  };
  
  return res.status(200).json(response);
};

/**
 * Calculate pagination metadata
 * @param {Number} total - Total count of items
 * @param {Number} page - Current page number
 * @param {Number} limit - Items per page
 */
const calculatePagination = (total, page, limit) => {
  const pages = Math.ceil(total / limit);
  const hasNext = page < pages;
  const hasPrev = page > 1;
  
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    pages,
    hasNext,
    hasPrev,
  };
};

/**
 * Async wrapper for route handlers to catch errors
 * @param {Function} fn - Async route handler function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Extract pagination parameters from query
 * @param {Object} query - Request query object
 * @param {Number} defaultLimit - Default limit if not provided
 */
const getPaginationParams = (query, defaultLimit = 10) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || defaultLimit));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse,
  calculatePagination,
  asyncHandler,
  getPaginationParams,
};