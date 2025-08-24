// src/controllers/treasury/treasuryReceipt.controller.js
const { prisma } = require('../../config/database');
const { successResponse, errorResponse } = require('../../utils/response');
const fs = require('fs');
const path = require('path');

// ============================================
// RECEIPT MANAGEMENT FOR EXPENSES & COLLECTIONS
// ============================================

/**
 * Upload receipt for expense
 * POST /api/treasury/expenses/:expenseId/receipt
 * Access: SuperAdmin only
 */
const uploadExpenseReceipt = async (req, res) => {
  try {
    const { expenseId } = req.params;

    if (!req.file) {
      return errorResponse(res, 'Receipt file is required', 400);
    }

    // Verify expense exists
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { 
        id: true, 
        description: true, 
        amount: true,
        receiptUrl: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } }
      }
    });

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    // Generate file URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/documents/${req.file.filename}`;

    // Delete old receipt file if exists
    if (expense.receiptUrl) {
      try {
        const oldFilename = path.basename(expense.receiptUrl);
        const oldFilePath = path.join(process.cwd(), 'public', 'uploads', 'documents', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (deleteError) {
        console.error('Error deleting old receipt file:', deleteError);
        // Continue with upload even if old file deletion fails
      }
    }

    // Update expense with receipt URL
    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: { receiptUrl: fileUrl },
      include: {
        category: { select: { id: true, name: true } },
        subcategory: { select: { id: true, name: true } }
      }
    });

    return successResponse(
      res,
      {
        expense: {
          id: updatedExpense.id,
          description: updatedExpense.description,
          amount: updatedExpense.amount,
          receiptUrl: updatedExpense.receiptUrl,
          category: updatedExpense.category,
          subcategory: updatedExpense.subcategory
        },
        uploadedReceipt: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: fileUrl
        }
      },
      'Expense receipt uploaded successfully'
    );
  } catch (error) {
    console.error('Upload expense receipt error:', error);
    return errorResponse(res, 'Failed to upload expense receipt', 500);
  }
};

/**
 * Upload receipt for manual collection
 * POST /api/treasury/manual-collections/:collectionId/receipt
 * Access: SuperAdmin only
 */
const uploadCollectionReceipt = async (req, res) => {
  try {
    const { collectionId } = req.params;

    if (!req.file) {
      return errorResponse(res, 'Receipt file is required', 400);
    }

    // Verify collection exists
    const collection = await prisma.manualCollection.findUnique({
      where: { id: collectionId },
      select: { 
        id: true, 
        description: true, 
        amount: true,
        collectionMode: true,
        receiptUrl: true
      }
    });

    if (!collection) {
      return errorResponse(res, 'Manual collection not found', 404);
    }

    // Generate file URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/documents/${req.file.filename}`;

    // Delete old receipt file if exists
    if (collection.receiptUrl) {
      try {
        const oldFilename = path.basename(collection.receiptUrl);
        const oldFilePath = path.join(process.cwd(), 'public', 'uploads', 'documents', oldFilename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (deleteError) {
        console.error('Error deleting old receipt file:', deleteError);
        // Continue with upload even if old file deletion fails
      }
    }

    // Update collection with receipt URL
    const updatedCollection = await prisma.manualCollection.update({
      where: { id: collectionId },
      data: { receiptUrl: fileUrl }
    });

    return successResponse(
      res,
      {
        collection: {
          id: updatedCollection.id,
          description: updatedCollection.description,
          amount: updatedCollection.amount,
          collectionMode: updatedCollection.collectionMode,
          receiptUrl: updatedCollection.receiptUrl
        },
        uploadedReceipt: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          url: fileUrl
        }
      },
      'Collection receipt uploaded successfully'
    );
  } catch (error) {
    console.error('Upload collection receipt error:', error);
    return errorResponse(res, 'Failed to upload collection receipt', 500);
  }
};

/**
 * View/Download expense receipt
 * GET /api/treasury/expenses/:expenseId/receipt
 * Access: Public (Read-only for transparency)
 */
const getExpenseReceipt = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { 
        id: true, 
        receiptUrl: true, 
        description: true,
        amount: true,
        expenseDate: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } }
      }
    });

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    if (!expense.receiptUrl) {
      return errorResponse(res, 'No receipt found for this expense', 404);
    }

    return successResponse(
      res,
      {
        expense: {
          id: expense.id,
          description: expense.description,
          amount: expense.amount,
          expenseDate: expense.expenseDate,
          category: expense.category,
          subcategory: expense.subcategory
        },
        receipt: {
          url: expense.receiptUrl,
          filename: path.basename(expense.receiptUrl)
        }
      },
      'Expense receipt retrieved successfully'
    );
  } catch (error) {
    console.error('Get expense receipt error:', error);
    return errorResponse(res, 'Failed to retrieve expense receipt', 500);
  }
};

/**
 * View/Download collection receipt
 * GET /api/treasury/manual-collections/:collectionId/receipt
 * Access: Public (Read-only for transparency)
 */
const getCollectionReceipt = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await prisma.manualCollection.findUnique({
      where: { id: collectionId },
      select: { 
        id: true, 
        receiptUrl: true, 
        description: true,
        amount: true,
        collectionDate: true,
        collectionMode: true
      }
    });

    if (!collection) {
      return errorResponse(res, 'Manual collection not found', 404);
    }

    if (!collection.receiptUrl) {
      return errorResponse(res, 'No receipt found for this collection', 404);
    }

    return successResponse(
      res,
      {
        collection: {
          id: collection.id,
          description: collection.description,
          amount: collection.amount,
          collectionDate: collection.collectionDate,
          collectionMode: collection.collectionMode
        },
        receipt: {
          url: collection.receiptUrl,
          filename: path.basename(collection.receiptUrl)
        }
      },
      'Collection receipt retrieved successfully'
    );
  } catch (error) {
    console.error('Get collection receipt error:', error);
    return errorResponse(res, 'Failed to retrieve collection receipt', 500);
  }
};

/**
 * Delete expense receipt
 * DELETE /api/treasury/expenses/:expenseId/receipt
 * Access: SuperAdmin only
 */
const deleteExpenseReceipt = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { 
        id: true, 
        receiptUrl: true, 
        description: true
      }
    });

    if (!expense) {
      return errorResponse(res, 'Expense not found', 404);
    }

    if (!expense.receiptUrl) {
      return errorResponse(res, 'No receipt found for this expense', 404);
    }

    // Delete file from filesystem
    try {
      const filename = path.basename(expense.receiptUrl);
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'documents', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (deleteError) {
      console.error('Error deleting receipt file:', deleteError);
      // Continue with database update even if file deletion fails
    }

    // Update expense to remove receipt URL
    await prisma.expense.update({
      where: { id: expenseId },
      data: { receiptUrl: null }
    });

    return successResponse(
      res,
      {
        expense: {
          id: expense.id,
          description: expense.description.substring(0, 100)
        },
        deletedReceipt: {
          url: expense.receiptUrl,
          filename: path.basename(expense.receiptUrl)
        }
      },
      'Expense receipt deleted successfully'
    );
  } catch (error) {
    console.error('Delete expense receipt error:', error);
    return errorResponse(res, 'Failed to delete expense receipt', 500);
  }
};

/**
 * Delete collection receipt
 * DELETE /api/treasury/manual-collections/:collectionId/receipt
 * Access: SuperAdmin only
 */
const deleteCollectionReceipt = async (req, res) => {
  try {
    const { collectionId } = req.params;

    const collection = await prisma.manualCollection.findUnique({
      where: { id: collectionId },
      select: { 
        id: true, 
        receiptUrl: true, 
        description: true
      }
    });

    if (!collection) {
      return errorResponse(res, 'Manual collection not found', 404);
    }

    if (!collection.receiptUrl) {
      return errorResponse(res, 'No receipt found for this collection', 404);
    }

    // Delete file from filesystem
    try {
      const filename = path.basename(collection.receiptUrl);
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'documents', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (deleteError) {
      console.error('Error deleting receipt file:', deleteError);
      // Continue with database update even if file deletion fails
    }

    // Update collection to remove receipt URL
    await prisma.manualCollection.update({
      where: { id: collectionId },
      data: { receiptUrl: null }
    });

    return successResponse(
      res,
      {
        collection: {
          id: collection.id,
          description: collection.description.substring(0, 100)
        },
        deletedReceipt: {
          url: collection.receiptUrl,
          filename: path.basename(collection.receiptUrl)
        }
      },
      'Collection receipt deleted successfully'
    );
  } catch (error) {
    console.error('Delete collection receipt error:', error);
    return errorResponse(res, 'Failed to delete collection receipt', 500);
  }
};

/**
 * Get receipt summary (all receipts with basic info)
 * GET /api/treasury/receipts/summary
 * Access: Public (Read-only for transparency)
 */
const getReceiptSummary = async (req, res) => {
  try {
    const { page, limit = 50 } = req.query;
    const limitInt = Math.min(parseInt(limit) || 50, 100);
    const skip = page ? (parseInt(page) - 1) * limitInt : 0;

    // Get expenses with receipts
    const expensesWithReceipts = await prisma.expense.findMany({
      where: { receiptUrl: { not: null } },
      select: {
        id: true,
        amount: true,
        description: true,
        expenseDate: true,
        receiptUrl: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        creator: { select: { fullName: true } }
      },
      skip,
      take: Math.ceil(limitInt / 2), // Half for expenses, half for collections
      orderBy: { expenseDate: 'desc' }
    });

    // Get collections with receipts
    const collectionsWithReceipts = await prisma.manualCollection.findMany({
      where: { receiptUrl: { not: null } },
      select: {
        id: true,
        amount: true,
        description: true,
        collectionDate: true,
        collectionMode: true,
        receiptUrl: true,
        creator: { select: { fullName: true } }
      },
      skip,
      take: Math.floor(limitInt / 2),
      orderBy: { collectionDate: 'desc' }
    });

    // Get total counts
    const [expenseReceiptCount, collectionReceiptCount] = await Promise.all([
      prisma.expense.count({ where: { receiptUrl: { not: null } } }),
      prisma.manualCollection.count({ where: { receiptUrl: { not: null } } })
    ]);

    // Format data
    const receipts = [
      ...expensesWithReceipts.map(expense => ({
        type: 'expense',
        id: expense.id,
        amount: expense.amount,
        description: expense.description,
        date: expense.expenseDate,
        receiptUrl: expense.receiptUrl,
        category: expense.category?.name,
        subcategory: expense.subcategory?.name,
        creator: expense.creator.fullName
      })),
      ...collectionsWithReceipts.map(collection => ({
        type: 'collection',
        id: collection.id,
        amount: collection.amount,
        description: collection.description,
        date: collection.collectionDate,
        collectionMode: collection.collectionMode,
        receiptUrl: collection.receiptUrl,
        creator: collection.creator.fullName
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return successResponse(
      res,
      {
        receipts,
        summary: {
          totalReceipts: expenseReceiptCount + collectionReceiptCount,
          expenseReceipts: expenseReceiptCount,
          collectionReceipts: collectionReceiptCount,
          totalRecords: receipts.length
        },
        pagination: {
          page: page ? parseInt(page) : 1,
          limit: limitInt,
          hasMore: receipts.length >= limitInt
        }
      },
      'Receipt summary retrieved successfully'
    );
  } catch (error) {
    console.error('Get receipt summary error:', error);
    return errorResponse(res, 'Failed to retrieve receipt summary', 500);
  }
};

/**
 * Validate receipt file (helper for upload validation)
 * POST /api/treasury/receipts/validate
 * Access: SuperAdmin only
 */
const validateReceiptFile = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No file provided for validation', 400);
    }

    const file = req.file;
    const validations = {
      fileSize: {
        valid: file.size <= 10 * 1024 * 1024, // 10MB limit
        size: file.size,
        maxSize: 10 * 1024 * 1024,
        message: file.size <= 10 * 1024 * 1024 ? 'File size is acceptable' : 'File size exceeds 10MB limit'
      },
      fileType: {
        valid: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.mimetype),
        type: file.mimetype,
        allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
        message: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.mimetype) 
          ? 'File type is acceptable' 
          : 'Invalid file type. Only JPG, PNG, and PDF files are allowed'
      },
      filename: {
        valid: file.originalname.length <= 255,
        length: file.originalname.length,
        maxLength: 255,
        message: file.originalname.length <= 255 ? 'Filename length is acceptable' : 'Filename too long'
      }
    };

    const isValid = Object.values(validations).every(validation => validation.valid);

    // Clean up uploaded file since this is just validation
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (deleteError) {
      console.error('Error cleaning up validation file:', deleteError);
    }

    return successResponse(
      res,
      {
        isValid,
        validations,
        file: {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }
      },
      isValid ? 'File validation passed' : 'File validation failed'
    );
  } catch (error) {
    console.error('Validate receipt file error:', error);
    return errorResponse(res, 'Failed to validate receipt file', 500);
  }
};

module.exports = {
  uploadExpenseReceipt,
  uploadCollectionReceipt,
  getExpenseReceipt,
  getCollectionReceipt,
  deleteExpenseReceipt,
  deleteCollectionReceipt,
  getReceiptSummary,
  validateReceiptFile
};