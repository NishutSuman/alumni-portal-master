// src/controllers/merchandiseCart.controller.js
// Standalone Merchandise Cart Controller - Independent of Events

const MerchandiseService = require('../../services/merchandise/merchandise.service');
const PaymentService = require('../../services/payment/PaymentService');
const { prisma } = require('../../config/database');
const {
  successResponse,
  errorResponse,
  paginatedResponse,
  getPaginationParams,
  calculatePagination
} = require('../../utils/response');

/**
 * Get user's cart
 * GET /api/merchandise/cart
 * Access: Authenticated users
 */
const getUserCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await prisma.merchandiseCartItem.findMany({
      where: { userId },
      include: {
        merchandise: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            stock: true,
            availableSizes: true,
            isActive: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calculate cart totals
    const totals = MerchandiseService.calculateCartTotals(cartItems);

    // Check for any issues with cart items
    const issues = [];
    const validItems = [];

    for (const item of cartItems) {
      if (!item.merchandise.isActive) {
        issues.push({
          itemId: item.id,
          name: item.merchandise.name,
          issue: 'Item no longer available'
        });
      } else if (item.merchandise.stock < item.quantity) {
        issues.push({
          itemId: item.id,
          name: item.merchandise.name,
          issue: `Only ${item.merchandise.stock} items in stock`,
          availableStock: item.merchandise.stock,
          requestedQuantity: item.quantity
        });
      } else {
        validItems.push(item);
      }
    }

    return successResponse(res, {
      cart: {
        items: cartItems,
        totals,
        issues,
        hasIssues: issues.length > 0,
        canCheckout: issues.length === 0 && cartItems.length > 0
      }
    }, 'Cart retrieved successfully');

  } catch (error) {
    console.error('Get user cart error:', error);
    return errorResponse(res, 'Failed to retrieve cart', 500);
  }
};

/**
 * Add item to cart
 * POST /api/merchandise/cart/add
 * Access: Authenticated users
 */
const addToCart = async (req, res) => {
  try {
    const { merchandiseId, quantity, selectedSize } = req.body;
    const userId = req.user.id;

    // Check stock availability
    const stockCheck = await MerchandiseService.checkStock(
      merchandiseId, 
      selectedSize, 
      quantity
    );

    if (!stockCheck.available) {
      return res.status(400).json({
        success: false,
        message: stockCheck.reason,
        availableStock: stockCheck.availableStock
      });
    }

    // Check if item already exists in cart with same size
    const existingCartItem = await prisma.merchandiseCartItem.findFirst({
      where: {
        userId,
        merchandiseId,
        selectedSize: selectedSize || null
      }
    });

    let cartItem;

    if (existingCartItem) {
      // Update quantity of existing item
      const newQuantity = existingCartItem.quantity + quantity;
      
      // Check if new quantity exceeds stock
      const newStockCheck = await MerchandiseService.checkStock(
        merchandiseId,
        selectedSize,
        newQuantity
      );

      if (!newStockCheck.available) {
        return res.status(400).json({
          success: false,
          message: newStockCheck.reason,
          currentCartQuantity: existingCartItem.quantity,
          requestedQuantity: quantity,
          availableStock: newStockCheck.availableStock
        });
      }

      cartItem = await prisma.merchandiseCartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity },
        include: {
          merchandise: {
            select: {
              id: true,
              name: true,
              price: true,
              images: true
            }
          }
        }
      });
    } else {
      // Create new cart item
      cartItem = await prisma.merchandiseCartItem.create({
        data: {
          userId,
          merchandiseId,
          quantity,
          selectedSize
        },
        include: {
          merchandise: {
            select: {
              id: true,
              name: true,
              price: true,
              images: true
            }
          }
        }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_added_to_cart',
        details: {
          merchandiseId,
          merchandiseName: cartItem.merchandise.name,
          quantity,
          selectedSize,
          action: existingCartItem ? 'updated' : 'added'
        }
      }
    });

    // Clear user cart cache
    await MerchandiseService.clearUserCartCache(userId);

    return successResponse(res, {
      cartItem
    }, `Item ${existingCartItem ? 'updated in' : 'added to'} cart successfully`);

  } catch (error) {
    console.error('Add to cart error:', error);
    return errorResponse(res, 'Failed to add item to cart', 500);
  }
};

/**
 * Update cart item
 * PUT /api/merchandise/cart/:cartItemId
 * Access: Authenticated users (own cart items only)
 */
const updateCartItem = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const { quantity, selectedSize } = req.body;
    const userId = req.user.id;

    // Get current cart item
    const cartItem = await prisma.merchandiseCartItem.findFirst({
      where: { 
        id: cartItemId,
        userId 
      },
      include: {
        merchandise: {
          select: {
            id: true,
            name: true,
            availableSizes: true
          }
        }
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Validate new size if provided
    if (selectedSize && !cartItem.merchandise.availableSizes.includes(selectedSize)) {
      return res.status(400).json({
        success: false,
        message: `Size '${selectedSize}' is not available`,
        availableSizes: cartItem.merchandise.availableSizes
      });
    }

    // Check stock for new quantity
    const stockCheck = await MerchandiseService.checkStock(
      cartItem.merchandiseId,
      selectedSize || cartItem.selectedSize,
      quantity
    );

    if (!stockCheck.available) {
      return res.status(400).json({
        success: false,
        message: stockCheck.reason,
        availableStock: stockCheck.availableStock
      });
    }

    // Update cart item
    const updatedCartItem = await prisma.merchandiseCartItem.update({
      where: { id: cartItemId },
      data: {
        quantity,
        selectedSize: selectedSize || cartItem.selectedSize
      },
      include: {
        merchandise: {
          select: {
            id: true,
            name: true,
            price: true,
            images: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_cart_item_updated',
        details: {
          cartItemId,
          merchandiseId: cartItem.merchandiseId,
          merchandiseName: cartItem.merchandise.name,
          oldQuantity: cartItem.quantity,
          newQuantity: quantity,
          oldSize: cartItem.selectedSize,
          newSize: selectedSize || cartItem.selectedSize
        }
      }
    });

    // Clear user cart cache
    await MerchandiseService.clearUserCartCache(userId);

    return successResponse(res, {
      cartItem: updatedCartItem
    }, 'Cart item updated successfully');

  } catch (error) {
    console.error('Update cart item error:', error);
    return errorResponse(res, 'Failed to update cart item', 500);
  }
};

/**
 * Remove item from cart
 * DELETE /api/merchandise/cart/:cartItemId
 * Access: Authenticated users (own cart items only)
 */
const removeFromCart = async (req, res) => {
  try {
    const { cartItemId } = req.params;
    const userId = req.user.id;

    // Get cart item details for logging
    const cartItem = await prisma.merchandiseCartItem.findFirst({
      where: { 
        id: cartItemId,
        userId 
      },
      include: {
        merchandise: {
          select: { name: true }
        }
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Delete cart item
    await prisma.merchandiseCartItem.delete({
      where: { id: cartItemId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_removed_from_cart',
        details: {
          cartItemId,
          merchandiseId: cartItem.merchandiseId,
          merchandiseName: cartItem.merchandise.name,
          quantity: cartItem.quantity
        }
      }
    });

    // Clear user cart cache
    await MerchandiseService.clearUserCartCache(userId);

    return successResponse(res, {
      cartItemId
    }, 'Item removed from cart successfully');

  } catch (error) {
    console.error('Remove from cart error:', error);
    return errorResponse(res, 'Failed to remove item from cart', 500);
  }
};

/**
 * Clear entire cart
 * DELETE /api/merchandise/cart/clear
 * Access: Authenticated users
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get cart items count for logging
    const cartItemsCount = await prisma.merchandiseCartItem.count({
      where: { userId }
    });

    // Delete all cart items for user
    await prisma.merchandiseCartItem.deleteMany({
      where: { userId }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'merchandise_cart_cleared',
        details: {
          itemsCleared: cartItemsCount
        }
      }
    });

    // Clear user cart cache
    await MerchandiseService.clearUserCartCache(userId);

    return successResponse(res, {
      itemsCleared: cartItemsCount
    }, 'Cart cleared successfully');

  } catch (error) {
    console.error('Clear cart error:', error);
    return errorResponse(res, 'Failed to clear cart', 500);
  }
};

/**
 * Place order from cart
 * POST /api/merchandise/order
 * Access: Authenticated users
 */
const placeOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    // Process order using service
    const orderResult = await MerchandiseService.processOrder(userId);

    // Create payment transaction
    const paymentData = {
      userId: userId,
      referenceType: 'MERCHANDISE_ORDER',
      referenceId: orderResult.order.id,
      amount: orderResult.order.totalAmount,
      description: `Merchandise Order - ${orderResult.order.orderNumber}`,
      metadata: {
        orderNumber: orderResult.order.orderNumber,
        itemCount: orderResult.totals.totalItems
      }
    };

    const paymentTransaction = await PaymentService.initiate(paymentData);

    // Update order with payment transaction ID
    const updatedOrder = await prisma.merchandiseOrder.update({
      where: { id: orderResult.order.id },
      data: { paymentTransactionId: paymentTransaction.id },
      include: {
        items: {
          include: {
            merchandise: {
              select: {
                id: true,
                name: true,
                images: true
              }
            }
          }
        }
      }
    });

    // Clear user cart and order caches
    await MerchandiseService.clearUserCartCache(userId);

    return successResponse(res, {
      order: {
        ...updatedOrder,
        qrCode: updatedOrder.qrData ? JSON.stringify(updatedOrder.qrData) : null
      },
      payment: paymentTransaction,
      totals: orderResult.totals
    }, 'Order placed successfully', 201);

  } catch (error) {
    console.error('Place order error:', error);
    
    if (error.message.includes('Cart is empty')) {
      return res.status(400).json({
        success: false,
        message: 'Cannot place order with empty cart'
      });
    }

    if (error.message.includes('no longer available')) {
      return res.status(400).json({
        success: false,
        message: 'Some items in your cart are no longer available. Please review your cart.'
      });
    }

    return errorResponse(res, 'Failed to place order', 500);
  }
};

/**
 * Get user's orders
 * GET /api/merchandise/my-orders
 * Access: Authenticated users
 */
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, skip } = getPaginationParams(req.query, 10);

    const [total, orders] = await Promise.all([
      prisma.merchandiseOrder.count({ 
        where: { userId } 
      }),
      prisma.merchandiseOrder.findMany({
        where: { userId },
        include: {
          items: {
            include: {
              merchandise: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                  price: true
                }
              }
            }
          },
          paymentTransaction: {
            select: {
              id: true,
              status: true,
              transactionNumber: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    // Transform orders for response
    const transformedOrders = orders.map(order => ({
      ...order,
      itemCount: order.items.length,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      formattedAmount: `₹${order.totalAmount}`,
      canTrack: order.status !== 'CANCELLED',
      qrCode: order.qrData ? JSON.stringify(order.qrData) : null
    }));

    const pagination = calculatePagination(total, page, limit);

    return paginatedResponse(res, transformedOrders, pagination, 'Orders retrieved successfully');

  } catch (error) {
    console.error('Get user orders error:', error);
    return errorResponse(res, 'Failed to retrieve orders', 500);
  }
};

/**
 * Get order details by order number
 * GET /api/merchandise/orders/:orderNumber
 * Access: Authenticated users (own orders) or SUPER_ADMIN
 */
const getOrderDetails = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build where clause based on user role
    let whereClause = { orderNumber };
    if (userRole !== 'SUPER_ADMIN') {
      whereClause.userId = userId;
    }

    const order = await prisma.merchandiseOrder.findFirst({
      where: whereClause,
      include: {
        items: {
          include: {
            merchandise: {
              select: {
                id: true,
                name: true,
                description: true,
                images: true,
                category: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        paymentTransaction: {
          select: {
            id: true,
            status: true,
            transactionNumber: true,
            razorpayOrderId: true,
            completedAt: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Add computed fields
    const orderWithDetails = {
      ...order,
      itemCount: order.items.length,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      formattedAmount: `₹${order.totalAmount}`,
      qrCode: order.qrData ? JSON.stringify(order.qrData) : null
    };

    return successResponse(res, {
      order: orderWithDetails
    }, 'Order details retrieved successfully');

  } catch (error) {
    console.error('Get order details error:', error);
    return errorResponse(res, 'Failed to retrieve order details', 500);
  }
};

module.exports = {
  // Cart operations
  getUserCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  
  // Order operations
  placeOrder,
  getUserOrders,
  getOrderDetails
};