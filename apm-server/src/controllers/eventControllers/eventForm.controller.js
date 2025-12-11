// src/controllers/eventForm.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const { getTenantFilter, getTenantData } = require('../../utils/tenant.util');

// ==========================================
// EVENT FORM MANAGEMENT (Admin Only)
// ==========================================

// Get event registration form (Public - for users to see form structure)
const getEventForm = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Check if event exists and has registration enabled
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: {
        id: true,
        title: true,
        hasRegistration: true,
        hasCustomForm: true,
        status: true,
      },
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    if (!event.hasRegistration) {
      return errorResponse(res, 'Event does not have registration enabled', 400);
    }
    
    // Get form with fields
    const form = await prisma.eventForm.findUnique({
      where: { eventId },
      include: {
        fields: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            fieldName: true,
            fieldLabel: true,
            fieldType: true,
            options: true,
            isRequired: true,
            orderIndex: true,
            validation: true,
          },
        },
      },
    });
    
    if (!form || !form.isActive) {
      return successResponse(res, { 
        hasForm: false,
        form: null 
      }, 'No active form found for this event');
    }
    
    return successResponse(res, { 
      hasForm: true,
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        fields: form.fields,
      }
    }, 'Event form retrieved successfully');
    
  } catch (error) {
    console.error('Get event form error:', error);
    return errorResponse(res, 'Failed to retrieve event form', 500);
  }
};

// Create or update event registration form (Super Admin only)
const createOrUpdateEventForm = async (req, res) => {
  const { eventId } = req.params;
  const { title, description, isActive = true } = req.body;
  
  try {
    // Check if event exists
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: {
        id: true,
        title: true,
        hasRegistration: true,
        hasCustomForm: true,
      },
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    if (!event.hasRegistration) {
      return errorResponse(res, 'Event does not have registration enabled', 400);
    }
    
    // Check if form already exists
    const existingForm = await prisma.eventForm.findUnique({
      where: { eventId },
    });
    
    let form;
    let action;
    
    if (existingForm) {
      // Update existing form
      form = await prisma.eventForm.update({
        where: { eventId },
        data: {
          title: title || existingForm.title,
          description: description !== undefined ? description : existingForm.description,
          isActive: isActive !== undefined ? isActive : existingForm.isActive,
        },
        include: {
          fields: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
      action = 'updated';
    } else {
      // Create new form
      form = await prisma.eventForm.create({
        data: {
          eventId,
          title: title || 'Registration Form',
          description,
          isActive,
        },
        include: {
          fields: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
      action = 'created';
      
      // Enable custom form feature if not already enabled
      if (!event.hasCustomForm) {
        await prisma.event.update({
          where: { id: eventId },
          data: { hasCustomForm: true },
        });
      }
    }
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: `event_form_${action}`,
        details: {
          eventId,
          formId: form.id,
          eventTitle: event.title,
          formTitle: form.title,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { form }, `Event form ${action} successfully`);
    
  } catch (error) {
    console.error('Create/update event form error:', error);
    return errorResponse(res, 'Failed to create/update event form', 500);
  }
};

// Delete event registration form (Super Admin only)
const deleteEventForm = async (req, res) => {
  const { eventId } = req.params;
  
  try {
    // Check if event exists
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...getTenantFilter(req) },
      select: { id: true, title: true },
    });

    if (!event) {
      return errorResponse(res, 'Event not found', 404);
    }
    
    // Check if form exists
    const form = await prisma.eventForm.findUnique({
      where: { eventId },
      include: {
        _count: {
          select: { fields: true },
        },
      },
    });
    
    if (!form) {
      return errorResponse(res, 'Event form not found', 404);
    }
    
    // Delete form (cascade will handle fields and responses)
    await prisma.eventForm.delete({
      where: { eventId },
    });
    
    // Disable custom form feature
    await prisma.event.update({
      where: { id: eventId },
      data: { hasCustomForm: false },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_form_delete',
        details: {
          eventId,
          formId: form.id,
          eventTitle: event.title,
          fieldsDeleted: form._count.fields,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Event form deleted successfully');
    
  } catch (error) {
    console.error('Delete event form error:', error);
    return errorResponse(res, 'Failed to delete event form', 500);
  }
};

// ==========================================
// FORM FIELD MANAGEMENT (Admin Only)
// ==========================================

// Add field to event form (Super Admin only)
const addFormField = async (req, res) => {
  const { eventId } = req.params;
  const { 
    fieldName, 
    fieldLabel, 
    fieldType, 
    options, 
    isRequired = false, 
    orderIndex = 0,
    validation
  } = req.body;
  
  try {
    // Check if form exists
    const form = await prisma.eventForm.findFirst({
      where: {
        eventId,
        event: { ...getTenantFilter(req) }
      },
      include: {
        event: {
          select: { id: true, title: true },
        },
        fields: {
          select: { fieldName: true },
        },
      },
    });

    if (!form) {
      return errorResponse(res, 'Event form not found. Create a form first.', 404);
    }
    
    // Check for duplicate field names
    const existingField = form.fields.find(field => field.fieldName === fieldName);
    if (existingField) {
      return errorResponse(res, 'Field with this name already exists', 409);
    }
    
    // Calculate order index if not provided
    let finalOrderIndex = orderIndex;
    if (orderIndex === 0 || orderIndex === undefined) {
      const maxOrderIndex = await prisma.eventFormField.aggregate({
        where: { formId: form.id },
        _max: { orderIndex: true },
      });
      finalOrderIndex = (maxOrderIndex._max.orderIndex || 0) + 1;
    }
    
    // Create form field
    const field = await prisma.eventFormField.create({
      data: {
        formId: form.id,
        fieldName,
        fieldLabel,
        fieldType,
        options: options || null,
        isRequired,
        orderIndex: finalOrderIndex,
        validation: validation || null,
      },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_form_field_create',
        details: {
          eventId,
          formId: form.id,
          fieldId: field.id,
          eventTitle: form.event.title,
          fieldName,
          fieldType,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { field }, 'Form field added successfully');
    
  } catch (error) {
    console.error('Add form field error:', error);
    return errorResponse(res, 'Failed to add form field', 500);
  }
};

// Update form field (Super Admin only)
const updateFormField = async (req, res) => {
  const { eventId, fieldId } = req.params;
  const { 
    fieldLabel, 
    fieldType, 
    options, 
    isRequired, 
    orderIndex,
    validation
  } = req.body;
  
  try {
    // Check if field exists and belongs to the event
    const field = await prisma.eventFormField.findFirst({
      where: {
        id: fieldId,
        form: {
          eventId,
          event: { ...getTenantFilter(req) }
        },
      },
      include: {
        form: {
          include: {
            event: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    if (!field) {
      return errorResponse(res, 'Form field not found', 404);
    }
    
    // Prepare update data
    const updateData = {};
    
    if (fieldLabel !== undefined) updateData.fieldLabel = fieldLabel;
    if (fieldType !== undefined) updateData.fieldType = fieldType;
    if (options !== undefined) updateData.options = options;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
    if (validation !== undefined) updateData.validation = validation;
    
    // Update field
    const updatedField = await prisma.eventFormField.update({
      where: { id: fieldId },
      data: updateData,
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_form_field_update',
        details: {
          eventId,
          formId: field.form.id,
          fieldId,
          eventTitle: field.form.event.title,
          fieldName: field.fieldName,
          changes: Object.keys(updateData),
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, { field: updatedField }, 'Form field updated successfully');
    
  } catch (error) {
    console.error('Update form field error:', error);
    return errorResponse(res, 'Failed to update form field', 500);
  }
};

// Delete form field (Super Admin only)
const deleteFormField = async (req, res) => {
  const { eventId, fieldId } = req.params;
  
  try {
    // Check if field exists and belongs to the event
    const field = await prisma.eventFormField.findFirst({
      where: {
        id: fieldId,
        form: {
          eventId,
          event: { ...getTenantFilter(req) }
        },
      },
      include: {
        form: {
          include: {
            event: {
              select: { id: true, title: true },
            },
          },
        },
        _count: {
          select: { responses: true },
        },
      },
    });

    if (!field) {
      return errorResponse(res, 'Form field not found', 404);
    }
    
    // Check if field has responses
    if (field._count.responses > 0) {
      return errorResponse(res, 'Cannot delete field that has user responses', 400);
    }
    
    // Delete field
    await prisma.eventFormField.delete({
      where: { id: fieldId },
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_form_field_delete',
        details: {
          eventId,
          formId: field.form.id,
          fieldId,
          eventTitle: field.form.event.title,
          fieldName: field.fieldName,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    return successResponse(res, null, 'Form field deleted successfully');
    
  } catch (error) {
    console.error('Delete form field error:', error);
    return errorResponse(res, 'Failed to delete form field', 500);
  }
};

// Reorder form fields (Super Admin only)
const reorderFormFields = async (req, res) => {
  const { eventId } = req.params;
  const { fieldOrders } = req.body;
  
  try {
    // Check if form exists
    const form = await prisma.eventForm.findFirst({
      where: {
        eventId,
        event: { ...getTenantFilter(req) }
      },
      include: {
        event: {
          select: { id: true, title: true },
        },
        fields: {
          select: { id: true },
        },
      },
    });

    if (!form) {
      return errorResponse(res, 'Event form not found', 404);
    }
    
    // Validate that all field IDs belong to this form
    const formFieldIds = form.fields.map(field => field.id);
    const providedFieldIds = fieldOrders.map(order => order.fieldId);
    
    const invalidFieldIds = providedFieldIds.filter(id => !formFieldIds.includes(id));
    if (invalidFieldIds.length > 0) {
      return errorResponse(res, 'Some field IDs do not belong to this form', 400);
    }
    
    // Update field orders in transaction
    await prisma.$transaction(async (tx) => {
      for (const { fieldId, orderIndex } of fieldOrders) {
        await tx.eventFormField.update({
          where: { id: fieldId },
          data: { orderIndex },
        });
      }
    });
    
    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'event_form_fields_reorder',
        details: {
          eventId,
          formId: form.id,
          eventTitle: form.event.title,
          fieldsReordered: fieldOrders.length,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });
    
    // Get updated form with reordered fields
    const updatedForm = await prisma.eventForm.findUnique({
      where: { eventId },
      include: {
        fields: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    
    return successResponse(res, { form: updatedForm }, 'Form fields reordered successfully');
    
  } catch (error) {
    console.error('Reorder form fields error:', error);
    return errorResponse(res, 'Failed to reorder form fields', 500);
  }
};

module.exports = {
  // Form management
  getEventForm,
  createOrUpdateEventForm,
  deleteEventForm,
  
  // Field management
  addFormField,
  updateFormField,
  deleteFormField,
  reorderFormFields,
};