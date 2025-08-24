// src/controllers/eventControllers/eventFeedback.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse, paginatedResponse, getPaginationParams } = require('../../utils/response');
const feedbackService = require('../../services/feedback/FeedbackService');
const feedbackAnalyticsService = require('../../services/feedback/FeedbackAnalyticsService');
const sentimentAnalysisService = require('../../services/feedback/SentimentAnalysisService');

// ==========================================
// ADMIN FEEDBACK MANAGEMENT
// ==========================================

/**
 * Create or update feedback form for an event
 * POST /api/events/:eventId/feedback/form
 * @access Admin only
 */
const createOrUpdateFeedbackForm = async (req, res) => {
  const { eventId } = req.params;
  const { title, description, allowAnonymous, showAfterEvent, autoSendReminders, reminderDelayHours, closeAfterHours, completionMessage } = req.body;
  
  try {
    // Check if event exists and is authorized
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { 
        id: true, 
        title: true, 
        status: true,
        eventDate: true,
        feedbackForm: { select: { id: true } }
      }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    // Create or update feedback form
    const feedbackFormData = {
      title: title || 'Event Feedback',
      description,
      allowAnonymous: allowAnonymous !== undefined ? allowAnonymous : true,
      showAfterEvent: showAfterEvent !== undefined ? showAfterEvent : true,
      autoSendReminders: autoSendReminders !== undefined ? autoSendReminders : false,
      reminderDelayHours: reminderDelayHours || 24,
      closeAfterHours: closeAfterHours || 168, // 7 days default
      completionMessage: completionMessage || 'Thank you for your feedback!'
    };

    let feedbackForm;
    if (event.feedbackForm) {
      // Update existing form
      feedbackForm = await prisma.eventFeedbackForm.update({
        where: { id: event.feedbackForm.id },
        data: feedbackFormData,
        include: {
          fields: {
            orderBy: { orderIndex: 'asc' }
          },
          _count: {
            select: { responses: true }
          }
        }
      });
    } else {
      // Create new form
      feedbackForm = await prisma.eventFeedbackForm.create({
        data: {
          ...feedbackFormData,
          eventId
        },
        include: {
          fields: {
            orderBy: { orderIndex: 'asc' }
          },
          _count: {
            select: { responses: true }
          }
        }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: event.feedbackForm ? 'feedback_form_update' : 'feedback_form_create',
        details: {
          eventId,
          feedbackFormId: feedbackForm.id,
          eventTitle: event.title,
          fieldsCount: feedbackForm.fields.length
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, feedbackForm, `Feedback form ${event.feedbackForm ? 'updated' : 'created'} successfully`);

  } catch (error) {
    console.error('Create/update feedback form error:', error);
    return errorResponse(res, 'Failed to save feedback form', 500);
  }
};

/**
 * Get feedback form for an event
 * GET /api/events/:eventId/feedback/form
 * @access Admin/Public (based on event status)
 */
const getFeedbackForm = async (req, res) => {
  const { eventId } = req.params;
  const isAdmin = req.user?.role === 'SUPER_ADMIN';
  
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        feedbackForm: {
          include: {
            fields: {
              orderBy: { orderIndex: 'asc' }
            },
            _count: {
              select: { responses: true }
            }
          }
        }
      }
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }

    if (!event.feedbackForm) {
      return errorResponse(res, 'No feedback form found for this event', 404);
    }

    // Check access permissions for non-admin users
    if (!isAdmin) {
      // Check if feedback should be shown
      const now = new Date();
      const eventDate = new Date(event.eventDate);
      
      if (event.feedbackForm.showAfterEvent && now < eventDate) {
        return errorResponse(res, 'Feedback form not available yet', 403);
      }

      // Check if feedback is closed
      const closeDate = new Date(eventDate.getTime() + (event.feedbackForm.closeAfterHours * 60 * 60 * 1000));
      if (now > closeDate) {
        return errorResponse(res, 'Feedback form is now closed', 403);
      }

      if (!event.feedbackForm.isActive) {
        return errorResponse(res, 'Feedback form is not active', 403);
      }
    }

    return successResponse(res, event.feedbackForm, 'Feedback form retrieved successfully');

  } catch (error) {
    console.error('Get feedback form error:', error);
    return errorResponse(res, 'Failed to retrieve feedback form', 500);
  }
};

/**
 * Add field to feedback form
 * POST /api/events/:eventId/feedback/fields
 * @access Admin only
 */
const addFeedbackField = async (req, res) => {
  const { eventId } = req.params;
  const { 
    fieldName, fieldLabel, fieldType, options, isRequired, 
    minValue, maxValue, stepValue, ratingStyle, placeholder, helpText 
  } = req.body;
  
  try {
    // Get feedback form
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId },
      include: {
        fields: { select: { orderIndex: true } },
        _count: { select: { responses: true } }
      }
    });

    if (!feedbackForm) {
      return errorResponse(res, 'Feedback form not found', 404);
    }

    // Check if responses already exist (prevent modification)
    if (feedbackForm._count.responses > 0) {
      return errorResponse(res, 'Cannot modify form with existing responses', 400);
    }

    // Calculate next order index
    const maxOrderIndex = feedbackForm.fields.length > 0 
      ? Math.max(...feedbackForm.fields.map(f => f.orderIndex)) 
      : -1;

    // Create field
    const field = await prisma.eventFeedbackField.create({
      data: {
        feedbackFormId: feedbackForm.id,
        fieldName: fieldName.toLowerCase().replace(/\s+/g, '_'),
        fieldLabel,
        fieldType,
        options: options || null,
        isRequired: isRequired || false,
        orderIndex: maxOrderIndex + 1,
        minValue,
        maxValue,
        stepValue,
        ratingStyle,
        placeholder,
        helpText
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'feedback_field_create',
        details: {
          eventId,
          feedbackFormId: feedbackForm.id,
          fieldId: field.id,
          fieldType,
          fieldLabel
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, field, 'Feedback field added successfully');

  } catch (error) {
    console.error('Add feedback field error:', error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'Field name already exists in this form', 400);
    }
    return errorResponse(res, 'Failed to add feedback field', 500);
  }
};

/**
 * Update feedback field
 * PUT /api/events/:eventId/feedback/fields/:fieldId
 * @access Admin only
 */
const updateFeedbackField = async (req, res) => {
  const { eventId, fieldId } = req.params;
  const updateData = req.body;
  
  try {
    // Get field with form info
    const field = await prisma.eventFeedbackField.findFirst({
      where: { 
        id: fieldId,
        feedbackForm: { eventId }
      },
      include: {
        feedbackForm: {
          include: {
            _count: { select: { responses: true } }
          }
        }
      }
    });

    if (!field) {
      return errorResponse(res, 'Feedback field not found', 404);
    }

    // Check if responses exist
    if (field.feedbackForm._count.responses > 0) {
      return errorResponse(res, 'Cannot modify field with existing responses', 400);
    }

    // Update field
    const updatedField = await prisma.eventFeedbackField.update({
      where: { id: fieldId },
      data: {
        ...updateData,
        fieldName: updateData.fieldName 
          ? updateData.fieldName.toLowerCase().replace(/\s+/g, '_')
          : undefined
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'feedback_field_update',
        details: {
          eventId,
          fieldId,
          changes: updateData
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, updatedField, 'Feedback field updated successfully');

  } catch (error) {
    console.error('Update feedback field error:', error);
    return errorResponse(res, 'Failed to update feedback field', 500);
  }
};

/**
 * Delete feedback field
 * DELETE /api/events/:eventId/feedback/fields/:fieldId
 * @access Admin only
 */
const deleteFeedbackField = async (req, res) => {
  const { eventId, fieldId } = req.params;
  
  try {
    // Get field with response count
    const field = await prisma.eventFeedbackField.findFirst({
      where: { 
        id: fieldId,
        feedbackForm: { eventId }
      },
      include: {
        feedbackForm: {
          include: {
            _count: { select: { responses: true } }
          }
        },
        _count: { select: { responses: true } }
      }
    });

    if (!field) {
      return errorResponse(res, 'Feedback field not found', 404);
    }

    // Check if responses exist
    if (field._count.responses > 0) {
      return errorResponse(res, 'Cannot delete field with existing responses', 400);
    }

    // Delete field
    await prisma.eventFeedbackField.delete({
      where: { id: fieldId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'feedback_field_delete',
        details: {
          eventId,
          fieldId,
          fieldLabel: field.fieldLabel
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, null, 'Feedback field deleted successfully');

  } catch (error) {
    console.error('Delete feedback field error:', error);
    return errorResponse(res, 'Failed to delete feedback field', 500);
  }
};

/**
 * Reorder feedback fields
 * POST /api/events/:eventId/feedback/fields/reorder
 * @access Admin only
 */
const reorderFeedbackFields = async (req, res) => {
  const { eventId } = req.params;
  const { fieldIds } = req.body; // Array of field IDs in desired order
  
  try {
    if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
      return errorResponse(res, 'Field IDs array is required', 400);
    }

    // Get feedback form
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId },
      include: {
        fields: true,
        _count: { select: { responses: true } }
      }
    });

    if (!feedbackForm) {
      return errorResponse(res, 'Feedback form not found', 404);
    }

    // Check if responses exist
    if (feedbackForm._count.responses > 0) {
      return errorResponse(res, 'Cannot reorder fields with existing responses', 400);
    }

    // Validate all field IDs belong to this form
    const formFieldIds = feedbackForm.fields.map(f => f.id);
    const invalidIds = fieldIds.filter(id => !formFieldIds.includes(id));
    
    if (invalidIds.length > 0) {
      return errorResponse(res, 'Invalid field IDs provided', 400);
    }

    // Update order in transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < fieldIds.length; i++) {
        await tx.eventFeedbackField.update({
          where: { id: fieldIds[i] },
          data: { orderIndex: i }
        });
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'feedback_fields_reorder',
        details: {
          eventId,
          fieldIds,
          fieldsCount: fieldIds.length
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    return successResponse(res, null, 'Feedback fields reordered successfully');

  } catch (error) {
    console.error('Reorder feedback fields error:', error);
    return errorResponse(res, 'Failed to reorder feedback fields', 500);
  }
};

// ==========================================
// USER FEEDBACK SUBMISSION
// ==========================================

/**
 * Submit feedback response
 * POST /api/events/:eventId/feedback/submit
 * @access Authenticated users or anonymous (based on form settings)
 */
const submitFeedback = async (req, res) => {
  const { eventId } = req.params;
  const { responses, isAnonymous } = req.body;
  const userId = req.user?.id;
  
  try {
    // Get feedback form with fields
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId, isActive: true },
      include: {
        fields: {
          orderBy: { orderIndex: 'asc' }
        },
        event: {
          select: { eventDate: true, title: true }
        }
      }
    });

    if (!feedbackForm) {
      return errorResponse(res, 'Feedback form not found or not active', 404);
    }

    // Check timing constraints
    const now = new Date();
    const eventDate = new Date(feedbackForm.event.eventDate);
    
    if (feedbackForm.showAfterEvent && now < eventDate) {
      return errorResponse(res, 'Feedback form not available yet', 403);
    }

    const closeDate = new Date(eventDate.getTime() + (feedbackForm.closeAfterHours * 60 * 60 * 1000));
    if (now > closeDate) {
      return errorResponse(res, 'Feedback form is now closed', 403);
    }

    // Check if anonymous submission is allowed
    const submissionIsAnonymous = isAnonymous && feedbackForm.allowAnonymous;
    if (submissionIsAnonymous && !feedbackForm.allowAnonymous) {
      return errorResponse(res, 'Anonymous feedback not allowed for this form', 400);
    }

    // For non-anonymous, require authentication
    if (!submissionIsAnonymous && !userId) {
      return errorResponse(res, 'Authentication required for non-anonymous feedback', 401);
    }

    // Check if user already submitted (for identified responses)
    if (!submissionIsAnonymous) {
      const existingResponse = await prisma.eventFeedbackResponse.findFirst({
        where: {
          feedbackFormId: feedbackForm.id,
          userId
        }
      });

      if (existingResponse) {
        return errorResponse(res, 'You have already submitted feedback for this event', 400);
      }
    }

    // Validate responses against form fields
    const validationResult = await feedbackService.validateFeedbackResponses(feedbackForm.fields, responses);
    if (!validationResult.isValid) {
      return errorResponse(res, validationResult.errors.join(', '), 400);
    }

    // Process responses in transaction
    const submittedResponses = await prisma.$transaction(async (tx) => {
      const responseRecords = [];
      
      for (const [fieldId, responseValue] of Object.entries(responses)) {
        const field = feedbackForm.fields.find(f => f.id === fieldId);
        if (!field) continue;

        // Analyze sentiment for text responses
        let sentimentScore = null;
        if (field.fieldType === 'TEXTAREA' || field.fieldType === 'TEXT') {
          sentimentScore = await sentimentAnalysisService.analyzeSentiment(responseValue);
        }

        const responseRecord = await tx.eventFeedbackResponse.create({
          data: {
            feedbackFormId: feedbackForm.id,
            userId: submissionIsAnonymous ? null : userId,
            fieldId,
            response: String(responseValue),
            isAnonymous: submissionIsAnonymous,
            sentimentScore,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            submittedAt: now
          }
        });

        responseRecords.push(responseRecord);
      }

      return responseRecords;
    });

    // Trigger analytics update (async)
    feedbackAnalyticsService.updateAnalytics(feedbackForm.id).catch(error => {
      console.error('Analytics update error:', error);
    });

    // Log activity (only for identified responses)
    if (!submissionIsAnonymous) {
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'feedback_submit',
          details: {
            eventId,
            feedbackFormId: feedbackForm.id,
            responsesCount: submittedResponses.length,
            eventTitle: feedbackForm.event.title
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
    }

    return successResponse(res, {
      message: feedbackForm.completionMessage,
      responsesSubmitted: submittedResponses.length
    }, 'Feedback submitted successfully');

  } catch (error) {
    console.error('Submit feedback error:', error);
    return errorResponse(res, 'Failed to submit feedback', 500);
  }
};

/**
 * Get user's feedback response
 * GET /api/events/:eventId/feedback/my-response
 * @access Authenticated users
 */
const getMyFeedbackResponse = async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.id;
  
  try {
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId },
      select: { id: true }
    });

    if (!feedbackForm) {
      return errorResponse(res, 'Feedback form not found', 404);
    }

    const responses = await prisma.eventFeedbackResponse.findMany({
      where: {
        feedbackFormId: feedbackForm.id,
        userId,
        isAnonymous: false
      },
      include: {
        field: {
          select: {
            id: true,
            fieldName: true,
            fieldLabel: true,
            fieldType: true
          }
        }
      }
    });

    return successResponse(res, responses, 'Feedback responses retrieved successfully');

  } catch (error) {
    console.error('Get my feedback error:', error);
    return errorResponse(res, 'Failed to retrieve feedback', 500);
  }
};

// ==========================================
// ADMIN ANALYTICS & REPORTING
// ==========================================

/**
 * Get feedback analytics
 * GET /api/events/:eventId/feedback/analytics
 * @access Admin only
 */
const getFeedbackAnalytics = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId },
      select: { id: true }
    });

    if (!feedbackForm) {
      return errorResponse(res, 'Feedback form not found', 404);
    }

    // Get or generate analytics
    const analytics = await feedbackAnalyticsService.getAnalytics(feedbackForm.id);

    return successResponse(res, analytics, 'Feedback analytics retrieved successfully');

  } catch (error) {
    console.error('Get feedback analytics error:', error);
    return errorResponse(res, 'Failed to retrieve analytics', 500);
  }
};

/**
 * Get all feedback responses
 * GET /api/events/:eventId/feedback/responses
 * @access Admin only
 */
const getFeedbackResponses = async (req, res) => {
  const { eventId } = req.params;
  const { includeAnonymous, fieldId, sentimentFilter } = req.query;
  const { page, limit, skip } = getPaginationParams(req.query, 50);
  
  try {
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId },
      include: {
        fields: {
          select: { id: true, fieldLabel: true, fieldType: true }
        }
      }
    });

    if (!feedbackForm) {
      return errorResponse(res, 'Feedback form not found', 404);
    }

    // Build where clause
    const whereClause = { feedbackFormId: feedbackForm.id };
    
    if (includeAnonymous === 'false') {
      whereClause.isAnonymous = false;
    }
    
    if (fieldId) {
      whereClause.fieldId = fieldId;
    }
    
    if (sentimentFilter) {
      whereClause.sentimentScore = sentimentFilter;
    }

    // Get total count
    const total = await prisma.eventFeedbackResponse.count({ where: whereClause });

    // Get responses
    const responses = await prisma.eventFeedbackResponse.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true
          }
        },
        field: {
          select: {
            id: true,
            fieldName: true,
            fieldLabel: true,
            fieldType: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' },
      skip,
      take: limit
    });

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(res, responses, pagination, 'Feedback responses retrieved successfully');

  } catch (error) {
    console.error('Get feedback responses error:', error);
    return errorResponse(res, 'Failed to retrieve responses', 500);
  }
};

/**
 * Export feedback responses
 * GET /api/events/:eventId/feedback/export
 * @access Admin only
 */
const exportFeedbackResponses = async (req, res) => {
  const { eventId } = req.params;
  const { format = 'csv', includeAnonymous = 'true' } = req.query;
  
  try {
    const feedbackForm = await prisma.eventFeedbackForm.findFirst({
      where: { eventId },
      include: {
        event: { select: { title: true } },
        fields: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!feedbackForm) {
      return errorResponse(res, 'Feedback form not found', 404);
    }

    // Get all responses
    const whereClause = { feedbackFormId: feedbackForm.id };
    if (includeAnonymous === 'false') {
      whereClause.isAnonymous = false;
    }

    const responses = await prisma.eventFeedbackResponse.findMany({
      where: whereClause,
      include: {
        user: {
          select: { fullName: true, email: true }
        },
        field: {
          select: { fieldName: true, fieldLabel: true, fieldType: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    // Generate export data
    const exportData = await feedbackService.generateExportData(
      feedbackForm, 
      responses, 
      format
    );

    // Set appropriate headers
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `feedback_${eventId}_${timestamp}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' 
      ? 'text/csv' 
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.send(exportData);

  } catch (error) {
    console.error('Export feedback error:', error);
    return errorResponse(res, 'Failed to export feedback data', 500);
  }
};

module.exports = {
  // Admin form management
  createOrUpdateFeedbackForm,
  getFeedbackForm,
  addFeedbackField,
  updateFeedbackField,
  deleteFeedbackField,
  reorderFeedbackFields,
  
  // User feedback submission
  submitFeedback,
  getMyFeedbackResponse,
  
  // Admin analytics & reporting
  getFeedbackAnalytics,
  getFeedbackResponses,
  exportFeedbackResponses
};