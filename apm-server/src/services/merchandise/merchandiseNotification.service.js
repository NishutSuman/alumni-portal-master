// src/services/merchandiseNotification.service.js
// Email and Notification Service for Merchandise Orders

const { EmailService } = require('../email/EmailService'); // Assuming you have existing email service
const { prisma } = require('../../config/database');

class MerchandiseNotificationService {
  
  /**
   * Send order confirmation email after successful payment
   * @param {string} orderId - Order ID
   */
  static async sendOrderConfirmationEmail(orderId) {
    try {
      // Get order details with user and items
      const order = await prisma.merchandiseOrder.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              graduationYear: true
            }
          },
          items: {
            include: {
              merchandise: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  images: true,
                  category: true
                }
              }
            }
          },
          paymentTransaction: {
            select: {
              id: true,
              transactionId: true,
              paymentMethod: true,
              paidAt: true
            }
          }
        }
      });

      if (!order) {
        console.error(`Order not found: ${orderId}`);
        return false;
      }

      // Prepare email data
      const emailData = {
        to: order.user.email,
        subject: `Order Confirmation - ${order.orderNumber}`,
        template: 'merchandise-order-confirmation',
        data: {
          customerName: order.user.fullName,
          orderNumber: order.orderNumber,
          orderDate: order.createdAt,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentTransaction?.paymentMethod || 'Online',
          transactionId: order.paymentTransaction?.transactionId,
          paidAt: order.paymentTransaction?.paidAt,
          
          // Order items
          items: order.items.map(item => ({
            name: item.merchandise.name,
            quantity: item.quantity,
            size: item.selectedSize || 'FREE SIZE',
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            image: item.merchandise.images[0] || null
          })),
          
          // QR Code for order tracking
          qrCode: order.qrData ? JSON.stringify(order.qrData) : null,
          
          // Additional info
          graduationYear: order.user.graduationYear,
          deliveryStatus: order.deliveryStatus,
          
          // URLs
          orderTrackingUrl: `${process.env.FRONTEND_URL}/orders/${order.orderNumber}`,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@yourportal.com'
        }
      };

      // Send email
      const emailResult = await EmailService.sendEmail(emailData);

      if (emailResult.success) {
        // Log successful email
        await prisma.activityLog.create({
          data: {
            userId: order.user.id,
            action: 'merchandise_order_confirmation_email_sent',
            details: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              email: order.user.email,
              emailId: emailResult.messageId
            }
          }
        });

        console.log(`Order confirmation email sent successfully for order: ${order.orderNumber}`);
        return true;
      } else {
        console.error(`Failed to send order confirmation email for order: ${order.orderNumber}`, emailResult.error);
        return false;
      }

    } catch (error) {
      console.error('Send order confirmation email error:', error);
      return false;
    }
  }

  /**
   * Send delivery confirmation email
   * @param {string} orderId - Order ID
   */
  static async sendDeliveryConfirmationEmail(orderId) {
    try {
      const order = await prisma.merchandiseOrder.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true
            }
          },
          items: {
            include: {
              merchandise: {
                select: { name: true }
              }
            }
          }
        }
      });

      if (!order) {
        console.error(`Order not found for delivery confirmation: ${orderId}`);
        return false;
      }

      const emailData = {
        to: order.user.email,
        subject: `Order Delivered - ${order.orderNumber}`,
        template: 'merchandise-delivery-confirmation',
        data: {
          customerName: order.user.fullName,
          orderNumber: order.orderNumber,
          deliveredAt: order.deliveredAt,
          deliveredBy: order.deliveredBy,
          deliveryNotes: order.deliveryNotes,
          items: order.items.map(item => ({
            name: item.merchandise.name,
            quantity: item.quantity,
            size: item.selectedSize || 'FREE SIZE'
          })),
          supportEmail: process.env.SUPPORT_EMAIL || 'support@yourportal.com'
        }
      };

      const emailResult = await EmailService.sendEmail(emailData);

      if (emailResult.success) {
        await prisma.activityLog.create({
          data: {
            userId: order.user.id,
            action: 'merchandise_delivery_confirmation_email_sent',
            details: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              email: order.user.email,
              deliveredAt: order.deliveredAt
            }
          }
        });

        console.log(`Delivery confirmation email sent for order: ${order.orderNumber}`);
        return true;
      } else {
        console.error(`Failed to send delivery confirmation email for order: ${order.orderNumber}`, emailResult.error);
        return false;
      }

    } catch (error) {
      console.error('Send delivery confirmation email error:', error);
      return false;
    }
  }

  /**
   * Send low stock alert to admins
   * @param {string} merchandiseId - Merchandise ID
   */
  static async sendLowStockAlert(merchandiseId) {
    try {
      const merchandise = await prisma.merchandise.findUnique({
        where: { id: merchandiseId },
        select: {
          id: true,
          name: true,
          stock: true,
          lowStockThreshold: true,
          category: true
        }
      });

      if (!merchandise || merchandise.stock > merchandise.lowStockThreshold) {
        return false;
      }

      // Get all super admins
      const admins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { email: true, fullName: true }
      });

      const adminEmails = admins.map(admin => admin.email);

      if (adminEmails.length === 0) {
        console.log('No admin emails found for low stock alert');
        return false;
      }

      const emailData = {
        to: adminEmails,
        subject: `Low Stock Alert - ${merchandise.name}`,
        template: 'merchandise-low-stock-alert',
        data: {
          merchandiseName: merchandise.name,
          currentStock: merchandise.stock,
          threshold: merchandise.lowStockThreshold,
          category: merchandise.category,
          merchandiseId: merchandise.id,
          adminUrl: `${process.env.ADMIN_FRONTEND_URL}/merchandise/${merchandise.id}`,
          isOutOfStock: merchandise.stock === 0
        }
      };

      const emailResult = await EmailService.sendEmail(emailData);

      if (emailResult.success) {
        await prisma.activityLog.create({
          data: {
            userId: 'SYSTEM',
            action: 'merchandise_low_stock_alert_sent',
            details: {
              merchandiseId: merchandise.id,
              name: merchandise.name,
              currentStock: merchandise.stock,
              threshold: merchandise.lowStockThreshold,
              adminCount: adminEmails.length
            }
          }
        });

        console.log(`Low stock alert sent for merchandise: ${merchandise.name}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Send low stock alert error:', error);
      return false;
    }
  }

  /**
   * Send order status update notification
   * @param {string} orderId - Order ID
   * @param {string} previousStatus - Previous order status
   * @param {string} newStatus - New order status
   */
  static async sendOrderStatusUpdate(orderId, previousStatus, newStatus) {
    try {
      const order = await prisma.merchandiseOrder.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              fullName: true,
              email: true
            }
          }
        }
      });

      if (!order) {
        return false;
      }

      // Only send notification for significant status changes
      const notifiableStatuses = ['CONFIRMED', 'CANCELLED', 'REFUNDED'];
      if (!notifiableStatuses.includes(newStatus)) {
        return false;
      }

      let subject = `Order Update - ${order.orderNumber}`;
      let template = 'merchandise-order-status-update';

      // Customize based on status
      if (newStatus === 'CANCELLED') {
        subject = `Order Cancelled - ${order.orderNumber}`;
        template = 'merchandise-order-cancelled';
      } else if (newStatus === 'CONFIRMED') {
        subject = `Order Confirmed - ${order.orderNumber}`;
        template = 'merchandise-order-confirmed';
      }

      const emailData = {
        to: order.user.email,
        subject,
        template,
        data: {
          customerName: order.user.fullName,
          orderNumber: order.orderNumber,
          previousStatus,
          newStatus,
          orderDate: order.createdAt,
          totalAmount: order.totalAmount,
          orderTrackingUrl: `${process.env.FRONTEND_URL}/orders/${order.orderNumber}`,
          supportEmail: process.env.SUPPORT_EMAIL || 'support@yourportal.com'
        }
      };

      const emailResult = await EmailService.sendEmail(emailData);

      if (emailResult.success) {
        await prisma.activityLog.create({
          data: {
            userId: order.user.id,
            action: 'merchandise_order_status_email_sent',
            details: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              previousStatus,
              newStatus,
              email: order.user.email
            }
          }
        });

        console.log(`Order status update email sent for order: ${order.orderNumber}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Send order status update error:', error);
      return false;
    }
  }

  /**
   * Handle payment webhook for merchandise orders
   * @param {Object} paymentData - Payment webhook data
   */
  static async handlePaymentWebhook(paymentData) {
    try {
      const { transactionId, status, referenceType, referenceId } = paymentData;

      // Only handle merchandise payments
      if (referenceType !== 'MERCHANDISE_ORDER') {
        return false;
      }

      // Find the order
      const order = await prisma.merchandiseOrder.findUnique({
        where: { id: referenceId }
      });

      if (!order) {
        console.error(`Order not found for payment webhook: ${referenceId}`);
        return false;
      }

      // Handle successful payment
      if (status === 'COMPLETED' || status === 'SUCCESS') {
        // Update order status
        await prisma.merchandiseOrder.update({
          where: { id: referenceId },
          data: {
            status: 'CONFIRMED',
            paymentStatus: 'COMPLETED'
          }
        });

        // Send order confirmation email
        await this.sendOrderConfirmationEmail(referenceId);

        // Update stock quantities
        const orderItems = await prisma.merchandiseOrderItem.findMany({
          where: { orderId: referenceId }
        });

        for (const item of orderItems) {
          await prisma.merchandise.update({
            where: { id: item.merchandiseId },
            data: {
              stock: {
                decrement: item.quantity
              }
            }
          });

          // Check for low stock and send alert
          const updatedMerchandise = await prisma.merchandise.findUnique({
            where: { id: item.merchandiseId },
            select: { stock: true, lowStockThreshold: true }
          });

          if (updatedMerchandise.stock <= updatedMerchandise.lowStockThreshold) {
            await this.sendLowStockAlert(item.merchandiseId);
          }
        }

        // Clear user cart after successful order
        await prisma.merchandiseCartItem.deleteMany({
          where: { userId: order.userId }
        });

        console.log(`Payment successful for merchandise order: ${order.orderNumber}`);
        return true;

      } else if (status === 'FAILED' || status === 'CANCELLED') {
        // Update order status for failed payment
        await prisma.merchandiseOrder.update({
          where: { id: referenceId },
          data: {
            status: 'CANCELLED',
            paymentStatus: 'FAILED'
          }
        });

        // Send order cancellation notification
        await this.sendOrderStatusUpdate(referenceId, 'PENDING', 'CANCELLED');

        console.log(`Payment failed for merchandise order: ${order.orderNumber}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Handle payment webhook error:', error);
      return false;
    }
  }
}

module.exports = MerchandiseNotificationService;