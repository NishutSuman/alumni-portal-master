// src/services/merchandise.service.js
// Standalone Merchandise Service - Independent of Events

const { prisma } = require('../../config/database');
const { CacheService } = require('../../config/redis');

class MerchandiseService {
  /**
   * Generate unique order number
   * @returns {string} Order number in format ORD-YYYY-XXXX
   */
  static async generateOrderNumber() {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    
    // Get the latest order number for this year
    const latestOrder = await prisma.merchandiseOrder.findFirst({
      where: {
        orderNumber: {
          startsWith: prefix
        }
      },
      orderBy: { createdAt: 'desc' },
      select: { orderNumber: true }
    });
    
    let nextNumber = 1;
    if (latestOrder) {
      const currentNumber = parseInt(latestOrder.orderNumber.split('-')[2]);
      nextNumber = currentNumber + 1;
    }
    
    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Check merchandise stock availability
   * @param {string} merchandiseId 
   * @param {string} size 
   * @param {number} quantity 
   * @returns {Object} Stock check result
   */
  static async checkStock(merchandiseId, size, quantity) {
    try {
      const merchandise = await prisma.merchandise.findUnique({
        where: { id: merchandiseId },
        select: { 
          id: true, 
          name: true, 
          stock: true, 
          availableSizes: true,
          isActive: true 
        }
      });

      if (!merchandise) {
        return { available: false, reason: 'Merchandise not found' };
      }

      if (!merchandise.isActive) {
        return { available: false, reason: 'Merchandise not available' };
      }

      if (size && !merchandise.availableSizes.includes(size)) {
        return { available: false, reason: 'Size not available' };
      }

      // For simplicity, we're using global stock count
      // In a more complex system, you might have size-specific stock
      if (merchandise.stock < quantity) {
        return { 
          available: false, 
          reason: 'Insufficient stock',
          availableStock: merchandise.stock 
        };
      }

      return { 
        available: true, 
        merchandise,
        availableStock: merchandise.stock 
      };

    } catch (error) {
      console.error('Check stock error:', error);
      return { available: false, reason: 'Stock check failed' };
    }
  }

  /**
   * Calculate cart totals
   * @param {Array} cartItems 
   * @returns {Object} Cart calculation
   */
  static calculateCartTotals(cartItems) {
    const totals = {
      subtotal: 0,
      totalItems: 0,
      totalQuantity: 0,
      items: []
    };

    cartItems.forEach(item => {
      const itemTotal = parseFloat(item.merchandise.price) * item.quantity;
      
      totals.items.push({
        ...item,
        itemTotal
      });
      
      totals.subtotal += itemTotal;
      totals.totalItems++;
      totals.totalQuantity += item.quantity;
    });

    // Round to 2 decimal places
    totals.subtotal = Math.round(totals.subtotal * 100) / 100;

    return totals;
  }

  /**
   * Validate cart before checkout
   * @param {string} userId 
   * @returns {Object} Validation result
   */
  static async validateCartForCheckout(userId) {
    try {
      const cartItems = await prisma.merchandiseCartItem.findMany({
        where: { userId },
        include: {
          merchandise: {
            select: {
              id: true,
              name: true,
              price: true,
              stock: true,
              availableSizes: true,
              isActive: true
            }
          }
        }
      });

      if (cartItems.length === 0) {
        return { valid: false, reason: 'Cart is empty' };
      }

      const issues = [];
      const validItems = [];

      for (const item of cartItems) {
        const stockCheck = await this.checkStock(
          item.merchandiseId,
          item.selectedSize,
          item.quantity
        );

        if (!stockCheck.available) {
          issues.push({
            item: item.merchandise.name,
            size: item.selectedSize,
            reason: stockCheck.reason,
            availableStock: stockCheck.availableStock
          });
        } else {
          validItems.push(item);
        }
      }

      if (issues.length > 0) {
        return {
          valid: false,
          reason: 'Some items are no longer available',
          issues,
          validItems
        };
      }

      const totals = this.calculateCartTotals(validItems);

      return {
        valid: true,
        cartItems: validItems,
        totals
      };

    } catch (error) {
      console.error('Validate cart error:', error);
      return { valid: false, reason: 'Cart validation failed' };
    }
  }

  /**
   * Process merchandise order (transaction-safe)
   * @param {string} userId 
   * @param {Object} orderData 
   * @returns {Object} Created order
   */
  static async processOrder(userId, orderData = {}) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Validate cart
        const cartValidation = await this.validateCartForCheckout(userId);
        if (!cartValidation.valid) {
          throw new Error(cartValidation.reason);
        }

        const { cartItems, totals } = cartValidation;

        // Generate order number
        const orderNumber = await this.generateOrderNumber();

        // Generate QR code data
        const qrData = {
          type: 'MERCHANDISE_ORDER',
          orderNumber,
          userId,
          totalAmount: totals.subtotal,
          itemCount: totals.totalItems,
          generatedAt: new Date().toISOString()
        };

        // Create order
        const order = await tx.merchandiseOrder.create({
          data: {
            orderNumber,
            userId,
            totalAmount: totals.subtotal,
            qrData,
            status: 'PENDING'
          }
        });

        // Create order items and update stock
        const orderItems = [];
        for (const cartItem of cartItems) {
          // Create order item
          const orderItem = await tx.merchandiseOrderItem.create({
            data: {
              orderId: order.id,
              merchandiseId: cartItem.merchandiseId,
              quantity: cartItem.quantity,
              selectedSize: cartItem.selectedSize,
              unitPrice: cartItem.merchandise.price,
              totalPrice: cartItem.merchandise.price * cartItem.quantity
            }
          });

          orderItems.push(orderItem);

          // Update stock
          await tx.merchandise.update({
            where: { id: cartItem.merchandiseId },
            data: {
              stock: {
                decrement: cartItem.quantity
              }
            }
          });
        }

        // Clear cart
        await tx.merchandiseCartItem.deleteMany({
          where: { userId }
        });

        // Log activity
        await tx.activityLog.create({
          data: {
            userId,
            action: 'merchandise_order_created',
            details: {
              orderId: order.id,
              orderNumber,
              totalAmount: totals.subtotal,
              itemCount: totals.totalItems
            }
          }
        });

        console.log(`✅ Merchandise order created: ${orderNumber} for user ${userId}`);

        return {
          order: {
            ...order,
            items: orderItems
          },
          totals
        };
      });

    } catch (error) {
      console.error('Process order error:', error);
      throw error;
    }
  }

  /**
   * Update merchandise stock
   * @param {string} merchandiseId 
   * @param {number} newStock 
   * @param {string} adminId 
   * @returns {Object} Updated merchandise
   */
  static async updateStock(merchandiseId, newStock, adminId) {
    try {
      const currentMerchandise = await prisma.merchandise.findUnique({
        where: { id: merchandiseId },
        select: { stock: true, name: true }
      });

      if (!currentMerchandise) {
        throw new Error('Merchandise not found');
      }

      const updatedMerchandise = await prisma.merchandise.update({
        where: { id: merchandiseId },
        data: { stock: newStock }
      });

      // Log stock update
      await prisma.activityLog.create({
        data: {
          userId: adminId,
          action: 'merchandise_stock_updated',
          details: {
            merchandiseId,
            merchandiseName: currentMerchandise.name,
            oldStock: currentMerchandise.stock,
            newStock: newStock,
            stockChange: newStock - currentMerchandise.stock
          }
        }
      });

      console.log(`📦 Stock updated for ${currentMerchandise.name}: ${currentMerchandise.stock} → ${newStock}`);
      
      return updatedMerchandise;

    } catch (error) {
      console.error('Update stock error:', error);
      throw error;
    }
  }

  /**
   * Mark order as delivered
   * @param {string} orderId 
   * @param {string} adminId 
   * @param {string} notes 
   * @returns {Object} Updated order
   */
  static async markOrderDelivered(orderId, adminId, notes = '') {
    try {
      return await prisma.$transaction(async (tx) => {
        const order = await tx.merchandiseOrder.findUnique({
          where: { id: orderId },
          select: { 
            id: true, 
            orderNumber: true, 
            userId: true,
            deliveryStatus: true 
          }
        });

        if (!order) {
          throw new Error('Order not found');
        }

        if (order.deliveryStatus === 'DELIVERED') {
          throw new Error('Order already marked as delivered');
        }

        const updatedOrder = await tx.merchandiseOrder.update({
          where: { id: orderId },
          data: {
            deliveryStatus: 'DELIVERED',
            deliveredBy: adminId,
            deliveredAt: new Date(),
            deliveryNotes: notes
          }
        });

        // Log delivery
        await tx.activityLog.create({
          data: {
            userId: adminId,
            action: 'merchandise_order_delivered',
            details: {
              orderId,
              orderNumber: order.orderNumber,
              deliveredTo: order.userId,
              deliveryNotes: notes
            }
          }
        });

        console.log(`📦 Order delivered: ${order.orderNumber} by admin ${adminId}`);
        
        return updatedOrder;
      });

    } catch (error) {
      console.error('Mark order delivered error:', error);
      throw error;
    }
  }

  /**
   * Get merchandise analytics
   * @param {Object} filters 
   * @returns {Object} Analytics data
   */
  static async getMerchandiseAnalytics(filters = {}) {
    try {
      const { startDate, endDate, category } = filters;
      
      let whereClause = {};
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate);
        if (endDate) whereClause.createdAt.lte = new Date(endDate);
      }

      const [
        totalOrders,
        totalRevenue,
        ordersByStatus,
        topSellingItems,
        revenueByCategory
      ] = await Promise.all([
        // Total orders
        prisma.merchandiseOrder.count({ where: whereClause }),

        // Total revenue from completed orders  
        prisma.merchandiseOrder.aggregate({
          where: {
            ...whereClause,
            paymentStatus: 'COMPLETED'
          },
          _sum: { totalAmount: true }
        }),

        // Orders by status
        prisma.merchandiseOrder.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true,
          _sum: { totalAmount: true }
        }),

        // Top selling items
        prisma.merchandiseOrderItem.groupBy({
          by: ['merchandiseId'],
          where: {
            order: whereClause
          },
          _sum: { 
            quantity: true,
            totalPrice: true 
          },
          orderBy: {
            _sum: {
              quantity: 'desc'
            }
          },
          take: 10
        }),

        // Revenue by category (if categories are implemented)
        category ? null : prisma.merchandise.groupBy({
          by: ['category'],
          _count: true,
          _sum: { stock: true }
        })
      ]);

      return {
        summary: {
          totalOrders,
          totalRevenue: totalRevenue._sum.totalAmount || 0,
          averageOrderValue: totalOrders > 0 
            ? (totalRevenue._sum.totalAmount || 0) / totalOrders 
            : 0
        },
        ordersByStatus: ordersByStatus.reduce((acc, item) => {
          acc[item.status] = {
            count: item._count,
            revenue: item._sum.totalAmount || 0
          };
          return acc;
        }, {}),
        topSellingItems,
        revenueByCategory: revenueByCategory || []
      };

    } catch (error) {
      console.error('Get merchandise analytics error:', error);
      throw error;
    }
  }

  /**
   * Clear merchandise caches
   * @param {string} merchandiseId 
   */
  static async clearMerchandiseCaches(merchandiseId = null) {
    try {
      const patterns = [
        'merchandise:catalog:*',
        'merchandise:stats:*',
        'user:*:cart'
      ];

      if (merchandiseId) {
        patterns.push(`merchandise:${merchandiseId}:*`);
      }

      await Promise.all(
        patterns.map(pattern => 
          CacheService.delPattern ? 
          CacheService.delPattern(pattern) : 
          CacheService.del(pattern)
        )
      );

      console.log('🗑️ Cleared merchandise caches');
    } catch (error) {
      console.error('Clear merchandise caches error:', error);
    }
  }

  /**
   * Clear user cart cache
   * @param {string} userId 
   */
  static async clearUserCartCache(userId) {
    try {
      await CacheService.del(`user:${userId}:cart`);
      await CacheService.del(`user:${userId}:orders`);
    } catch (error) {
      console.error('Clear user cart cache error:', error);
    }
  }
}

module.exports = MerchandiseService;