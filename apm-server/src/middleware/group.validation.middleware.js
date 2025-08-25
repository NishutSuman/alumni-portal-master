// src/middleware/group.validation.middleware.js
const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const { errorResponse } = require('../utils/response');

const prisma = new PrismaClient();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const groupValidationSchemas = {
  createGroup: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Group name must be at least 2 characters',
        'string.max': 'Group name cannot exceed 100 characters',
        'any.required': 'Group name is required'
      }),
    type: Joi.string()
      .valid('CELL', 'COMMITTEE', 'OFFICE_BEARERS', 'ADVISORS')
      .required()
      .messages({
        'any.only': 'Group type must be one of: CELL, COMMITTEE, OFFICE_BEARERS, ADVISORS',
        'any.required': 'Group type is required'
      }),
    description: Joi.string()
      .trim()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    displayOrder: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Display order must be a non-negative integer'
      })
  }),

  updateGroup: Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Group name must be at least 2 characters',
        'string.max': 'Group name cannot exceed 100 characters'
      }),
    description: Joi.string()
      .trim()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Description cannot exceed 1000 characters'
      }),
    isActive: Joi.boolean()
      .optional(),
    displayOrder: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.min': 'Display order must be a non-negative integer'
      })
  }),

  addMember: Joi.object({
    userId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid user ID format',
        'any.required': 'User ID is required'
      }),
    role: Joi.string()
      .valid(
        'CONVENER', 'CO_CONVENER', 'STAKE_HOLDER',
        'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'JOINT_TREASURER',
        'CHIEF_ADVISOR', 'JOINT_ADVISOR'
      )
      .required()
      .messages({
        'any.only': 'Invalid role for group member',
        'any.required': 'Member role is required'
      })
  }),

  updateMember: Joi.object({
    role: Joi.string()
      .valid(
        'CONVENER', 'CO_CONVENER', 'STAKE_HOLDER',
        'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'JOINT_TREASURER',
        'CHIEF_ADVISOR', 'JOINT_ADVISOR'
      )
      .required()
      .messages({
        'any.only': 'Invalid role for group member',
        'any.required': 'Member role is required'
      }),
    isActive: Joi.boolean()
      .optional()
  }),

  bulkMembers: Joi.object({
    action: Joi.string()
      .valid('add', 'remove', 'update')
      .required()
      .messages({
        'any.only': 'Action must be one of: add, remove, update',
        'any.required': 'Action is required'
      }),
    members: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().uuid().required(),
          role: Joi.string().valid(
            'CONVENER', 'CO_CONVENER', 'STAKE_HOLDER',
            'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'JOINT_TREASURER',
            'CHIEF_ADVISOR', 'JOINT_ADVISOR'
          ).when('$action', { is: Joi.not('remove'), then: Joi.required() })
        })
      )
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one member is required',
        'array.max': 'Cannot process more than 50 members at once'
      })
  }),

  reorderGroups: Joi.object({
    groups: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().required(),
          displayOrder: Joi.number().integer().min(0).required()
        })
      )
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one group is required for reordering'
      })
  })
};

// Parameter validation schemas
const groupParamSchemas = {
  groupIdParam: Joi.object({
    groupId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid group ID format',
        'any.required': 'Group ID is required'
      })
  }),

  userIdParam: Joi.object({
    userId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Invalid user ID format',
        'any.required': 'User ID is required'
      })
  })
};

// ============================================
// VALIDATION MIDDLEWARE FUNCTIONS
// ============================================

// Generic validation function
const validateGroupData = (schemaName) => {
  return (req, res, next) => {
    const schema = groupValidationSchemas[schemaName];
    if (!schema) {
      return errorResponse(res, 'Invalid validation schema', 500);
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      context: { action: req.body.action }
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return errorResponse(res, 'Validation failed', 400, { errors });
    }

    req.body = value;
    next();
  };
};

// Generic parameter validation function
const validateGroupParams = (schemaName) => {
  return (req, res, next) => {
    const schema = groupParamSchemas[schemaName];
    if (!schema) {
      return errorResponse(res, 'Invalid parameter validation schema', 500);
    }

    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return errorResponse(res, 'Parameter validation failed', 400, { errors });
    }

    req.params = value;
    next();
  };
};

// ============================================
// BUSINESS RULE VALIDATIONS
// ============================================

// Validate group name uniqueness
const validateGroupNameUnique = async (req, res, next) => {
  try {
    const { name } = req.body;
    const { groupId } = req.params;

    if (!name) {
      return next();
    }

    const existingGroup = await prisma.organizationGroup.findFirst({
      where: {
        name: name.trim(),
        ...(groupId && { id: { not: groupId } })
      },
      select: { id: true, name: true }
    });

    if (existingGroup) {
      return errorResponse(res, 'Group name already exists', 409, {
        field: 'name',
        existingGroup: existingGroup.name
      });
    }

    next();
  } catch (error) {
    console.error('Group name validation error:', error);
    return errorResponse(res, 'Failed to validate group name', 500);
  }
};

// Validate group access/existence
const validateGroupAccess = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await prisma.organizationGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true
      }
    });

    if (!group) {
      return errorResponse(res, 'Group not found', 404);
    }

    req.group = group;
    next();
  } catch (error) {
    console.error('Group access validation error:', error);
    return errorResponse(res, 'Failed to validate group access', 500);
  }
};

// Validate member role against group type
const validateMemberRole = (req, res, next) => {
  try {
    const { role } = req.body;
    const { group } = req;

    if (!role || !group) {
      return next();
    }

    const rolesByGroupType = {
      CELL: ['CONVENER', 'CO_CONVENER', 'STAKE_HOLDER'],
      COMMITTEE: ['CONVENER', 'CO_CONVENER', 'STAKE_HOLDER'],
      OFFICE_BEARERS: ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'JOINT_TREASURER'],
      ADVISORS: ['CHIEF_ADVISOR', 'JOINT_ADVISOR']
    };

    const allowedRoles = rolesByGroupType[group.type] || [];
    
    if (!allowedRoles.includes(role)) {
      return errorResponse(res, `Role '${role}' is not valid for group type '${group.type}'`, 400, {
        allowedRoles,
        groupType: group.type
      });
    }

    next();
  } catch (error) {
    console.error('Member role validation error:', error);
    return errorResponse(res, 'Failed to validate member role', 500);
  }
};

// Validate user exists and is not already a member
const validateUserForMembership = async (req, res, next) => {
  try {
    const { userId } = req.body.userId ? req.body : req.params;
    const { groupId } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isActive: true
      }
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    if (!user.isActive) {
      return errorResponse(res, 'Cannot add inactive user to group', 400);
    }

    // For adding members, check if already exists
    if (req.method === 'POST') {
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId
          }
        },
        select: { id: true, isActive: true, role: true }
      });

      if (existingMember && existingMember.isActive) {
        return errorResponse(res, 'User is already an active member of this group', 409, {
          currentRole: existingMember.role
        });
      }
    }

    req.targetUser = user;
    next();
  } catch (error) {
    console.error('User membership validation error:', error);
    return errorResponse(res, 'Failed to validate user membership', 500);
  }
};

// Validate member exists in group
const validateMemberExists = async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;

    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhoto: true
          }
        }
      }
    });

    if (!member) {
      return errorResponse(res, 'Member not found in this group', 404);
    }

    req.groupMember = member;
    next();
  } catch (error) {
    console.error('Member existence validation error:', error);
    return errorResponse(res, 'Failed to validate member existence', 500);
  }
};

// ============================================
// EXPORTED MIDDLEWARE
// ============================================

module.exports = {
  // Data validation
  validateCreateGroup: validateGroupData('createGroup'),
  validateUpdateGroup: validateGroupData('updateGroup'),
  validateAddMember: validateGroupData('addMember'),
  validateUpdateMember: validateGroupData('updateMember'),
  validateBulkMembers: validateGroupData('bulkMembers'),
  validateReorderGroups: validateGroupData('reorderGroups'),

  // Parameter validation
  validateGroupIdParam: validateGroupParams('groupIdParam'),
  validateUserIdParam: validateGroupParams('userIdParam'),

  // Business rule validation
  validateGroupNameUnique,
  validateGroupAccess,
  validateMemberRole,
  validateUserForMembership,
  validateMemberExists
};