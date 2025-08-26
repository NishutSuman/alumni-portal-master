const TicketTemplateService = require('../../services/ticketTemplate.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');

/**
 * Get active templates (filtered by category if provided)
 * GET /api/tickets/templates
 */
const getActiveTemplates = async (req, res) => {
  try {
    const { categoryId } = req.query;
    const userId = req.user?.id; // Optional authentication
    
    const templates = await TicketTemplateService.getActiveTemplates(categoryId, userId);
    
    return successResponse(
      res,
      templates,
      'Templates retrieved successfully'
    );
  } catch (error) {
    console.error('Get active templates error:', error);
    return errorResponse(res, 'Failed to retrieve templates', 500);
  }
};

/**
 * Get template details
 * GET /api/tickets/templates/:templateId
 */
const getTemplateDetails = async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = await TicketTemplateService.getTemplateById(templateId);
    
    return successResponse(
      res,
      template,
      'Template details retrieved successfully'
    );
  } catch (error) {
    console.error('Get template details error:', error);
    return errorResponse(res, error.message || 'Failed to retrieve template details', 500);
  }
};

/**
 * Use template to get pre-filled ticket data
 * POST /api/tickets/templates/:templateId/use
 */
const useTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    
    const processedTemplate = await TicketTemplateService.useTemplate(templateId, userId);
    
    return successResponse(
      res,
      processedTemplate,
      'Template processed successfully'
    );
  } catch (error) {
    console.error('Use template error:', error);
    return errorResponse(res, error.message || 'Failed to process template', 500);
  }
};

/**
 * Create new template (Admin only)
 * POST /api/tickets/admin/templates
 */
const createTemplate = async (req, res) => {
  try {
    const templateData = req.body;
    const adminId = req.user.id;
    
    const template = await TicketTemplateService.createTemplate(adminId, templateData);
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ticket_template_created',
        details: {
          templateId: template.id,
          templateName: template.name,
          categoryId: template.categoryId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      template,
      'Template created successfully',
      201
    );
  } catch (error) {
    console.error('Create template error:', error);
    return errorResponse(res, error.message || 'Failed to create template', 500);
  }
};

/**
 * Update template (Admin only)
 * PUT /api/tickets/admin/templates/:templateId
 */
const updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const updateData = req.body;
    const adminId = req.user.id;
    
    const updatedTemplate = await TicketTemplateService.updateTemplate(
      templateId,
      adminId,
      updateData
    );
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ticket_template_updated',
        details: {
          templateId,
          templateName: updatedTemplate.name,
          changes: updateData
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    return successResponse(
      res,
      updatedTemplate,
      'Template updated successfully'
    );
  } catch (error) {
    console.error('Update template error:', error);
    return errorResponse(res, error.message || 'Failed to update template', 500);
  }
};

/**
 * Delete template (Admin only)
 * DELETE /api/tickets/admin/templates/:templateId
 */
const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const adminId = req.user.id;
    
    // Check if template exists and get details for logging
    const template = await prisma.ticketTemplate.findUnique({
      where: { id: templateId },
      select: { name: true, createdBy: true, usageCount: true }
    });
    
    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }
    
    // Permission check
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });
    
    if (template.createdBy !== adminId && user.role !== 'SUPER_ADMIN') {
      return errorResponse(res, 'Permission denied to delete this template', 403);
    }
    
    // Soft delete by setting isActive to false (preserve usage history)
    await prisma.ticketTemplate.update({
      where: { id: templateId },
      data: { isActive: false }
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'ticket_template_deleted',
        details: {
          templateId,
          templateName: template.name,
          usageCount: template.usageCount
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });
    
    // Invalidate template caches
    await TicketTemplateService.invalidateTemplateCaches();
    
    return successResponse(
      res,
      null,
      'Template deleted successfully'
    );
  } catch (error) {
    console.error('Delete template error:', error);
    return errorResponse(res, error.message || 'Failed to delete template', 500);
  }
};

module.exports = {
  getActiveTemplates,
  getTemplateDetails,
  useTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
};