const { asyncHandler } = require('../../utils/response');
const InvoiceService = require('../../services/payment/InvoiceService');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const generateInvoice = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user owns this transaction
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: transactionId,
        userId
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Generate invoice
    const result = await InvoiceService.generateInvoice(transactionId);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'invoice_generated',
        details: {
          transactionId,
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(result.alreadyExists ? 200 : 201).json({
      success: true,
      message: result.alreadyExists 
        ? 'Invoice already exists' 
        : 'Invoice generated successfully',
      data: {
        invoice: result.invoice
      }
    });

  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

const getInvoice = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user owns this transaction
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: transactionId,
        userId
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Get invoice
    const result = await InvoiceService.getInvoiceByTransactionId(transactionId);

    res.status(200).json({
      success: true,
      message: 'Invoice retrieved successfully',
      data: result
    });

  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(error.message === 'Invoice not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

const downloadInvoicePDF = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const userId = req.user.id;

  try {
    // Verify user owns this transaction
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: transactionId,
        userId
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Get or generate PDF
    const result = await InvoiceService.downloadInvoicePDF(transactionId);

    if (result.success && result.pdfUrl) {
      // In production, you might redirect to the PDF URL or stream the file
      res.status(200).json({
        success: true,
        message: 'Invoice PDF ready for download',
        data: {
          pdfUrl: result.pdfUrl
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate invoice PDF'
      });
    }

  } catch (error) {
    console.error('Download invoice PDF error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

const resendInvoiceEmail = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const { email } = req.body;
  const userId = req.user.id;

  try {
    // Verify user owns this transaction
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        id: transactionId,
        userId
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Use provided email or user's email
    const targetEmail = email || transaction.user.email;

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        message: 'No email address provided'
      });
    }

    // Resend invoice email
    const result = await InvoiceService.resendInvoiceEmail(transactionId, targetEmail);

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'invoice_email_resent',
        details: {
          transactionId,
          sentTo: targetEmail
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(200).json({
      success: true,
      message: 'Invoice email sent successfully',
      data: {
        sentTo: targetEmail
      }
    });

  } catch (error) {
    console.error('Resend invoice email error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});


// =============================================
// ADMIN INVOICE CONTROLLERS
// =============================================

const adminGenerateInvoice = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  try {
    // Generate invoice (admin can generate for any transaction)
    const result = await InvoiceService.generateInvoice(transactionId);

    res.status(result.alreadyExists ? 200 : 201).json({
      success: true,
      message: result.alreadyExists 
        ? 'Invoice already exists' 
        : 'Invoice generated successfully',
      data: {
        invoice: result.invoice
      }
    });

  } catch (error) {
    console.error('Admin invoice generation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

const adminGetInvoice = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;

  try {
    // Get invoice (admin can access any invoice)
    const result = await InvoiceService.getInvoiceByTransactionId(transactionId);

    res.status(200).json({
      success: true,
      message: 'Invoice retrieved successfully',
      data: result
    });

  } catch (error) {
    console.error('Admin get invoice error:', error);
    res.status(error.message === 'Invoice not found' ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = {
  // User invoice endpoints
  generateInvoice,
  getInvoice,
  downloadInvoicePDF,
  resendInvoiceEmail,
  
  // Admin invoice endpoints
  adminGenerateInvoice,
  adminGetInvoice
};
