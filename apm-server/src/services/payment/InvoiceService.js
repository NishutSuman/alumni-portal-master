// src/services/payment/InvoiceService.js
// Invoice generation and management service

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

class InvoiceService {
  constructor() {
    this.config = require('../../config/payment');
  }

  /**
   * Generate invoice for completed payment
   * @param {string} transactionId - Payment transaction ID
   * @returns {Object} Invoice generation result
   */
  async generateInvoice(transactionId) {
    try {
      // Fetch transaction with all related data
      const transaction = await prisma.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              whatsappNumber: true,
              batch: true
            }
          }
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'COMPLETED') {
        throw new Error('Can only generate invoice for completed payments');
      }

      // Check if invoice already exists
      const existingInvoice = await prisma.paymentInvoice.findUnique({
        where: { transactionId }
      });

      if (existingInvoice) {
        return {
          success: true,
          alreadyExists: true,
          invoice: existingInvoice
        };
      }

      // Generate invoice number
      const invoiceNumber = this.generateInvoiceNumber();

      // Prepare invoice data
      const invoiceData = await this.prepareInvoiceData(transaction, invoiceNumber);

      // Create invoice record
      const invoice = await prisma.paymentInvoice.create({
        data: {
          invoiceNumber,
          transactionId,
          invoiceData,
          status: 'GENERATED'
        }
      });

      // Generate PDF (if required)
      let pdfUrl = null;
      if (this.config.settings.invoice.autoGenerate) {
        pdfUrl = await this.generateInvoicePDF(invoice.id, invoiceData);
        
        // Update invoice with PDF URL
        await prisma.paymentInvoice.update({
          where: { id: invoice.id },
          data: {
            pdfUrl,
            pdfGeneratedAt: new Date()
          }
        });
      }

      // Send email (if required)
      if (this.config.settings.invoice.autoEmail && transaction.user.email) {
        await this.sendInvoiceEmail(invoice.id, transaction.user.email, invoiceData);
      }

      return {
        success: true,
        invoice: {
          ...invoice,
          pdfUrl
        }
      };

    } catch (error) {
      console.error('Invoice generation failed:', error);
      throw error;
    }
  }

  /**
   * Prepare invoice data structure
   * @param {Object} transaction - Payment transaction data
   * @param {string} invoiceNumber - Generated invoice number
   * @returns {Object} Structured invoice data
   */
  async prepareInvoiceData(transaction, invoiceNumber) {
    const breakdown = transaction.breakdown || {};
    
    // Get reference details based on type
    let referenceDetails = {};
    switch (transaction.referenceType) {
      case 'EVENT_REGISTRATION':
        referenceDetails = await this.getEventRegistrationDetails(transaction.referenceId);
        break;
      case 'MERCHANDISE':
        referenceDetails = await this.getMerchandiseDetails(transaction.referenceId);
        break;
    }

    const invoiceData = {
      // Invoice identification
      invoiceNumber,
      issueDate: new Date().toISOString(),
      
      // Transaction details
      transactionNumber: transaction.transactionNumber,
      paymentDate: transaction.completedAt,
      paymentMethod: 'UPI',
      paymentProvider: transaction.provider,
      
      // Customer details
      customer: {
        name: transaction.user.fullName,
        email: transaction.user.email,
        phone: transaction.user.whatsappNumber,
        batch: transaction.user.batch
      },
      
      // Organization details
      organization: {
        name: process.env.ORGANIZATION_NAME || 'Alumni Portal',
        address: process.env.ORGANIZATION_ADDRESS || '',
        email: process.env.ORGANIZATION_EMAIL || '',
        phone: process.env.ORGANIZATION_PHONE || '',
        logo: process.env.ORGANIZATION_LOGO || ''
      },
      
      // Payment details
      payment: {
        amount: parseFloat(transaction.amount),
        currency: transaction.currency,
        description: transaction.description,
        referenceType: transaction.referenceType,
        breakdown
      },
      
      // Reference details (event/merchandise info)
      reference: referenceDetails,
      
      // Line items for detailed breakdown
      lineItems: this.generateLineItems(breakdown, referenceDetails),
      
      // Totals
      totals: {
        subtotal: breakdown.subtotal || parseFloat(transaction.amount),
        processingFee: breakdown.processingFee || 0,
        total: parseFloat(transaction.amount)
      },
      
      // Meta information
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: 'system'
      }
    };

    return invoiceData;
  }

  /**
   * Get event registration details for invoice
   */
  async getEventRegistrationDetails(registrationId) {
    const registration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      include: {
        event: {
          select: {
            title: true,
            eventDate: true,
            venue: true,
            registrationFee: true,
            guestFee: true
          }
        },
        guests: {
          where: { status: 'ACTIVE' },
          select: { name: true }
        }
      }
    });

    if (!registration) return {};

    return {
      type: 'Event Registration',
      eventTitle: registration.event.title,
      eventDate: registration.event.eventDate,
      venue: registration.event.venue,
      registrationFee: parseFloat(registration.event.registrationFee || 0),
      guestCount: registration.guests.length,
      guestFee: parseFloat(registration.event.guestFee || 0),
      guests: registration.guests.map(g => g.name)
    };
  }

  /**
   * Get merchandise details for invoice
   */
  async getMerchandiseDetails(registrationId) {
    const orders = await prisma.eventMerchandiseOrder.findMany({
      where: {
        registrationId,
        paymentStatus: 'COMPLETED'
      },
      include: {
        merchandise: {
          select: { name: true, description: true }
        },
        registration: {
          include: {
            event: {
              select: { title: true }
            }
          }
        }
      }
    });

    if (orders.length === 0) return {};

    return {
      type: 'Merchandise Purchase',
      eventTitle: orders[0].registration.event.title,
      items: orders.map(order => ({
        name: order.merchandise.name,
        description: order.merchandise.description,
        quantity: order.quantity,
        size: order.sizeSelected,
        unitPrice: parseFloat(order.priceAtTime),
        totalPrice: parseFloat(order.priceAtTime) * order.quantity
      }))
    };
  }

  /**
   * Generate line items for invoice
   */
  generateLineItems(breakdown, referenceDetails) {
    const items = [];

    // Registration fee
    if (breakdown.registrationFee && breakdown.registrationFee > 0) {
      items.push({
        description: `Event Registration - ${referenceDetails.eventTitle || 'Event'}`,
        quantity: 1,
        unitPrice: breakdown.registrationFee,
        totalPrice: breakdown.registrationFee
      });
    }

    // Guest fees
    if (breakdown.guestFees && breakdown.guestFees > 0) {
      items.push({
        description: `Guest Fees (${breakdown.guestCount || 0} guests)`,
        quantity: breakdown.guestCount || 0,
        unitPrice: breakdown.guestFees / (breakdown.guestCount || 1),
        totalPrice: breakdown.guestFees
      });
    }

    // Merchandise items
    if (referenceDetails.items) {
      referenceDetails.items.forEach(item => {
        items.push({
          description: `${item.name}${item.size ? ` (${item.size})` : ''}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice
        });
      });
    }

    // Processing fee
    if (breakdown.processingFee && breakdown.processingFee > 0) {
      items.push({
        description: 'Processing Fee',
        quantity: 1,
        unitPrice: breakdown.processingFee,
        totalPrice: breakdown.processingFee
      });
    }

    return items;
  }

  /**
   * Generate invoice PDF (placeholder implementation)
   * In production, you'd use libraries like puppeteer, jsPDF, or PDFKit
   */
  async generateInvoicePDF(invoiceId, invoiceData) {
    try {
      // This is a placeholder implementation
      // In production, you would:
      // 1. Use a PDF generation library (puppeteer, jsPDF, PDFKit)
      // 2. Create HTML template and convert to PDF
      // 3. Upload to cloud storage (AWS S3, Cloudinary, etc.)
      // 4. Return the PDF URL

      const pdfPath = `/invoices/${invoiceData.invoiceNumber}.pdf`;
      
      // For now, return a placeholder URL
      // In production, implement actual PDF generation
      const pdfUrl = `${process.env.BACKEND_URL}/public${pdfPath}`;
      
      console.log(`PDF generation placeholder for invoice ${invoiceData.invoiceNumber}`);
      console.log('Invoice data:', JSON.stringify(invoiceData, null, 2));
      
      return pdfUrl;

    } catch (error) {
      console.error('PDF generation failed:', error);
      throw error;
    }
  }

  /**
   * Send invoice via email (placeholder implementation)
   */
  async sendInvoiceEmail(invoiceId, emailAddress, invoiceData) {
    try {
      // Update invoice record
      await prisma.paymentInvoice.update({
        where: { id: invoiceId },
        data: {
          emailSentTo: emailAddress,
          emailSentAt: new Date(),
          status: 'EMAILED'
        }
      });

      // This is a placeholder implementation
      // In production, you would:
      // 1. Use email service (SendGrid, AWS SES, Nodemailer)
      // 2. Create email template with invoice details
      // 3. Attach PDF if available
      // 4. Send email and handle failures

      console.log(`Email sent placeholder for invoice ${invoiceData.invoiceNumber} to ${emailAddress}`);
      
      return {
        success: true,
        emailSent: true,
        sentTo: emailAddress
      };

    } catch (error) {
      console.error('Email sending failed:', error);
      throw error;
    }
  }

  /**
   * Resend invoice email
   */
  async resendInvoiceEmail(transactionId, emailAddress) {
    try {
      const invoice = await prisma.paymentInvoice.findUnique({
        where: { transactionId }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Send email with existing invoice data
      await this.sendInvoiceEmail(invoice.id, emailAddress, invoice.invoiceData);

      // Update resend count
      await prisma.paymentInvoice.update({
        where: { id: invoice.id },
        data: {
          emailResendCount: { increment: 1 }
        }
      });

      return {
        success: true,
        message: 'Invoice email resent successfully'
      };

    } catch (error) {
      console.error('Invoice email resend failed:', error);
      throw error;
    }
  }

  /**
   * Get invoice by transaction ID
   */
  async getInvoiceByTransactionId(transactionId) {
    try {
      const invoice = await prisma.paymentInvoice.findUnique({
        where: { transactionId }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      return {
        success: true,
        invoice
      };

    } catch (error) {
      console.error('Get invoice failed:', error);
      throw error;
    }
  }

  /**
   * Download invoice PDF
   */
  async downloadInvoicePDF(transactionId) {
    try {
      const invoice = await prisma.paymentInvoice.findUnique({
        where: { transactionId }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (!invoice.pdfUrl) {
        // Generate PDF if not exists
        const pdfUrl = await this.generateInvoicePDF(invoice.id, invoice.invoiceData);
        
        await prisma.paymentInvoice.update({
          where: { id: invoice.id },
          data: { pdfUrl, pdfGeneratedAt: new Date() }
        });

        return { success: true, pdfUrl };
      }

      return {
        success: true,
        pdfUrl: invoice.pdfUrl
      };

    } catch (error) {
      console.error('Invoice PDF download failed:', error);
      throw error;
    }
  }

  /**
   * Generate invoice number following existing pattern
   */
  generateInvoiceNumber() {
    const prefix = this.config.transaction.invoicePrefix || 'INV';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}-${date}-${random}`;
  }
}

module.exports = new InvoiceService();