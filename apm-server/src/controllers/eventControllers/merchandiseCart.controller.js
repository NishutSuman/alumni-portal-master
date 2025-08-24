// src/controllers/eventControllers/merchandiseCart.controller.js
const { prisma } = require("../../config/database");
const { successResponse, errorResponse } = require("../../utils/response");
const EventService = require("../../services/event.service");

// Add item to cart (Authenticated users)
const addToCart = async (req, res) => {
	const { eventId } = req.params;
	const { merchandiseId, quantity, selectedSize } = req.body;
	const userId = req.user.id;
	const registration = req.userRegistration;

	try {
		// Check if merchandise item exists and is active
		const merchandise = await prisma.eventMerchandise.findFirst({
			where: {
				id: merchandiseId,
				eventId,
				isActive: true,
			},
		});

		if (!merchandise) {
			return errorResponse(res, "Merchandise item not found or inactive", 404);
		}

		// Validate size selection if item has sizes
		if (merchandise.availableSizes.length > 0 && !selectedSize) {
			return errorResponse(
				res,
				"Size selection is required for this item",
				400
			);
		}

		if (selectedSize && !merchandise.availableSizes.includes(selectedSize)) {
			return errorResponse(res, "Selected size is not available", 400);
		}

		// Check stock availability
		if (
			merchandise.stockQuantity !== null &&
			merchandise.stockQuantity < quantity
		) {
			return errorResponse(
				res,
				`Insufficient stock. Only ${merchandise.stockQuantity} items available`,
				400
			);
		}

		// Check if item already exists in cart
		const existingCartItem = await prisma.eventMerchandiseOrder.findFirst({
			where: {
				registrationId: registration.id,
				merchandiseId,
				selectedSize: selectedSize || null,
			},
		});

		let cartItem;

		if (existingCartItem) {
			// Update existing cart item
			const newQuantity = existingCartItem.quantity + quantity;

			// Check stock for new total quantity
			if (
				merchandise.stockQuantity !== null &&
				merchandise.stockQuantity < newQuantity
			) {
				return errorResponse(
					res,
					`Cannot add ${quantity} more. Stock limit exceeded. Available: ${merchandise.stockQuantity - existingCartItem.quantity}`,
					400
				);
			}

			cartItem = await prisma.eventMerchandiseOrder.update({
				where: { id: existingCartItem.id },
				data: {
					quantity: newQuantity,
					totalPrice: newQuantity * merchandise.price,
				},
				include: {
					merchandise: {
						select: {
							name: true,
							price: true,
							images: true,
						},
					},
				},
			});

			// Log activity
			await prisma.activityLog.create({
				data: {
					userId,
					action: "cart_item_update",
					details: {
						eventId,
						merchandiseId,
						quantityAdded: quantity,
						newQuantity: newQuantity,
					},
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
				},
			});
		} else {
			// Create new cart item
			cartItem = await prisma.eventMerchandiseOrder.create({
				data: {
					registrationId: registration.id,
					merchandiseId,
					quantity,
					selectedSize: selectedSize || null,
					unitPrice: merchandise.price,
					totalPrice: quantity * merchandise.price,
				},
				include: {
					merchandise: {
						select: {
							name: true,
							price: true,
							images: true,
						},
					},
				},
			});

			// Log activity
			await prisma.activityLog.create({
				data: {
					userId,
					action: "cart_item_add",
					details: {
						eventId,
						merchandiseId,
						quantity,
						selectedSize,
					},
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
				},
			});
		}

		return successResponse(
			res,
			{
				cartItem: {
					id: cartItem.id,
					merchandiseId: cartItem.merchandiseId,
					name: cartItem.merchandise.name,
					quantity: cartItem.quantity,
					selectedSize: cartItem.selectedSize,
					unitPrice: cartItem.unitPrice,
					totalPrice: cartItem.totalPrice,
					images: cartItem.merchandise.images,
				},
			},
			"Item added to cart successfully",
			201
		);
	} catch (error) {
		console.error("Add to cart error:", error);
		return errorResponse(res, "Failed to add item to cart", 500);
	}
};

// Get user's cart (Authenticated users)
const getCart = async (req, res) => {
	const { eventId } = req.params;
	const registration = req.userRegistration;

	try {
		const cartItems = await prisma.eventMerchandiseOrder.findMany({
			where: { registrationId: registration.id },
			include: {
				merchandise: {
					select: {
						id: true,
						name: true,
						description: true,
						price: true,
						images: true,
						availableSizes: true,
						stockQuantity: true,
						isActive: true,
					},
				},
			},
			orderBy: { createdAt: "asc" },
		});

		// Calculate cart summary
		const cartSummary = {
			totalItems: cartItems.reduce((sum, item) => sum + item.quantity, 0),
			totalAmount: cartItems.reduce(
				(sum, item) => sum + Number(item.totalPrice),
				0
			),
			itemCount: cartItems.length,
		};

		// Format cart items with stock check
		const formattedItems = cartItems.map((item) => ({
			id: item.id,
			merchandiseId: item.merchandiseId,
			name: item.merchandise.name,
			description: item.merchandise.description,
			quantity: item.quantity,
			selectedSize: item.selectedSize,
			unitPrice: Number(item.unitPrice),
			totalPrice: Number(item.totalPrice),
			images: item.merchandise.images,
			availableSizes: item.merchandise.availableSizes,
			stockQuantity: item.merchandise.stockQuantity,
			isActive: item.merchandise.isActive,
			stockStatus:
				item.merchandise.stockQuantity !== null
					? item.merchandise.stockQuantity >= item.quantity
						? "AVAILABLE"
						: "INSUFFICIENT"
					: "UNLIMITED",
			createdAt: item.createdAt,
		}));

		return successResponse(
			res,
			{
				cart: formattedItems,
				summary: cartSummary,
				event: {
					id: eventId,
					registrationId: registration.id,
				},
			},
			"Cart retrieved successfully"
		);
	} catch (error) {
		console.error("Get cart error:", error);
		return errorResponse(res, "Failed to retrieve cart", 500);
	}
};

// Update cart item (Authenticated users)
const updateCartItem = async (req, res) => {
	const { eventId, itemId } = req.params;
	const { quantity, selectedSize } = req.body;
	const userId = req.user.id;
	const registration = req.userRegistration;

	try {
		// Find cart item
		const cartItem = await prisma.eventMerchandiseOrder.findFirst({
			where: {
				id: itemId,
				registrationId: registration.id,
			},
			include: {
				merchandise: {
					select: {
						availableSizes: true,
						stockQuantity: true,
						price: true,
						isActive: true,
					},
				},
			},
		});

		if (!cartItem) {
			return errorResponse(res, "Cart item not found", 404);
		}

		if (!cartItem.merchandise.isActive) {
			return errorResponse(res, "This item is no longer available", 400);
		}

		// Prepare update data
		const updateData = {};

		if (quantity !== undefined) {
			if (
				cartItem.merchandise.stockQuantity !== null &&
				cartItem.merchandise.stockQuantity < quantity
			) {
				return errorResponse(
					res,
					`Insufficient stock. Only ${cartItem.merchandise.stockQuantity} items available`,
					400
				);
			}
			updateData.quantity = quantity;
			updateData.totalPrice = quantity * cartItem.merchandise.price;
		}

		if (selectedSize !== undefined) {
			if (
				cartItem.merchandise.availableSizes.length > 0 &&
				!cartItem.merchandise.availableSizes.includes(selectedSize)
			) {
				return errorResponse(res, "Selected size is not available", 400);
			}
			updateData.selectedSize = selectedSize || null;
		}

		// Update cart item
		const updatedItem = await prisma.eventMerchandiseOrder.update({
			where: { id: itemId },
			data: updateData,
			include: {
				merchandise: {
					select: {
						name: true,
						images: true,
					},
				},
			},
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "cart_item_update",
				details: {
					eventId,
					cartItemId: itemId,
					updates: updateData,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{
				cartItem: {
					id: updatedItem.id,
					quantity: updatedItem.quantity,
					selectedSize: updatedItem.selectedSize,
					totalPrice: Number(updatedItem.totalPrice),
					merchandise: updatedItem.merchandise,
				},
			},
			"Cart item updated successfully"
		);
	} catch (error) {
		console.error("Update cart item error:", error);
		return errorResponse(res, "Failed to update cart item", 500);
	}
};

// Remove item from cart (Authenticated users)
const removeFromCart = async (req, res) => {
	const { eventId, itemId } = req.params;
	const userId = req.user.id;
	const registration = req.userRegistration;

	try {
		// Check if cart item exists
		const cartItem = await prisma.eventMerchandiseOrder.findFirst({
			where: {
				id: itemId,
				registrationId: registration.id,
			},
			select: {
				id: true,
				merchandiseId: true,
			},
		});

		if (!cartItem) {
			return errorResponse(res, "Cart item not found", 404);
		}

		// Delete cart item
		await prisma.eventMerchandiseOrder.delete({
			where: { id: itemId },
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "cart_item_remove",
				details: {
					eventId,
					cartItemId: itemId,
					merchandiseId: cartItem.merchandiseId,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(res, null, "Item removed from cart successfully");
	} catch (error) {
		console.error("Remove from cart error:", error);
		return errorResponse(res, "Failed to remove item from cart", 500);
	}
};

// Checkout cart - Place order (Authenticated users)
const checkoutCart = async (req, res) => {
	const { eventId } = req.params;
	const { paymentReference, notes } = req.body;
	const userId = req.user.id;
	const registration = req.userRegistration;

	try {
		// Get all cart items
		const cartItems = await prisma.eventMerchandiseOrder.findMany({
			where: { registrationId: registration.id },
			include: {
				merchandise: {
					select: {
						name: true,
						stockQuantity: true,
						isActive: true,
					},
				},
			},
		});

		if (cartItems.length === 0) {
			return errorResponse(res, "Cart is empty", 400);
		}

		// Validate all items are still available and in stock
		for (const item of cartItems) {
			if (!item.merchandise.isActive) {
				return errorResponse(
					res,
					`Item "${item.merchandise.name}" is no longer available`,
					400
				);
			}

			if (
				item.merchandise.stockQuantity !== null &&
				item.merchandise.stockQuantity < item.quantity
			) {
				return errorResponse(
					res,
					`Insufficient stock for "${item.merchandise.name}". Available: ${item.merchandise.stockQuantity}`,
					400
				);
			}
		}

		// Calculate total amount
		const totalAmount = cartItems.reduce(
			(sum, item) => sum + Number(item.totalPrice),
			0
		);

		// Process in transaction
		const result = await prisma.$transaction(async (tx) => {
			// Update stock quantities
			for (const item of cartItems) {
				if (item.merchandise.stockQuantity !== null) {
					await tx.eventMerchandise.update({
						where: { id: item.merchandiseId },
						data: {
							stockQuantity: {
								decrement: item.quantity,
							},
						},
					});
				}
			}

			// Update registration's merchandise total
			await tx.eventRegistration.update({
				where: { id: registration.id },
				data: {
					merchandiseTotal: {
						increment: totalAmount,
					},
					totalAmount: {
						increment: totalAmount,
					},
				},
			});

			return {
				orderCount: cartItems.length,
				totalAmount,
				items: cartItems.map((item) => ({
					id: item.id,
					name: item.merchandise.name,
					quantity: item.quantity,
					selectedSize: item.selectedSize,
					totalPrice: Number(item.totalPrice),
				})),
			};
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "merchandise_checkout",
				details: {
					eventId,
					registrationId: registration.id,
					orderCount: result.orderCount,
					totalAmount: result.totalAmount,
					paymentReference,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		// ✅ ADD THIS: Send merchandise confirmation email
		try {
			if (emailManager.isInitialized) {
				const emailService = emailManager.getService();

        const orderData = {
          items: cartItems,
          totalAmount: totalOrderAmount,
          orderDate: new Date()
        };

				// You'll need to create this method in EmailService.js
				await emailService.sendMerchandiseConfirmation(
					req.user,
					orderData,
					registration.event,
				);
        console.log('✅ Merchandise confirmation email sent');
			}
		} catch (emailError) {
			console.error("Merchandise confirmation email failed:", emailError);
			// Don't fail the checkout if email fails
		}

		return successResponse(
			res,
			{
				order: {
					registrationId: registration.id,
					items: result.items,
					totalAmount: result.totalAmount,
					orderDate: new Date(),
					paymentReference,
					notes,
				},
			},
			"Order placed successfully! Items will be delivered at the event."
		);
	} catch (error) {
		console.error("Checkout cart error:", error);
		return errorResponse(res, "Failed to place order", 500);
	}
};

// Get user's orders (Authenticated users)
const getMyOrders = async (req, res) => {
	const { eventId } = req.params;
	const registration = req.userRegistration;

	try {
		const orders = await prisma.eventMerchandiseOrder.findMany({
			where: { registrationId: registration.id },
			include: {
				merchandise: {
					select: {
						name: true,
						description: true,
						images: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// Calculate summary
		const orderSummary = {
			totalItems: orders.reduce((sum, order) => sum + order.quantity, 0),
			totalAmount: orders.reduce(
				(sum, order) => sum + Number(order.totalPrice),
				0
			),
			orderCount: orders.length,
		};

		const formattedOrders = orders.map((order) => ({
			id: order.id,
			merchandiseId: order.merchandiseId,
			name: order.merchandise.name,
			description: order.merchandise.description,
			quantity: order.quantity,
			selectedSize: order.selectedSize,
			unitPrice: Number(order.unitPrice),
			totalPrice: Number(order.totalPrice),
			images: order.merchandise.images,
			orderDate: order.createdAt,
		}));

		return successResponse(
			res,
			{
				orders: formattedOrders,
				summary: orderSummary,
				deliveryInfo: {
					method: "MANUAL_DELIVERY_AT_EVENT",
					message:
						"Your merchandise will be delivered manually at the event venue.",
				},
			},
			"Orders retrieved successfully"
		);
	} catch (error) {
		console.error("Get my orders error:", error);
		return errorResponse(res, "Failed to retrieve orders", 500);
	}
};

// Get all orders for event (Admin only)
const getAllEventOrders = async (req, res) => {
	const { eventId } = req.params;
	const { page = 1, limit = 20, search } = req.query;

	try {
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Build where clause
		const whereClause = {
			registration: {
				eventId,
			},
		};

		// Add search filter
		if (search) {
			whereClause.OR = [
				{ merchandise: { name: { contains: search, mode: "insensitive" } } },
				{
					registration: {
						user: { fullName: { contains: search, mode: "insensitive" } },
					},
				},
				{
					registration: {
						user: { email: { contains: search, mode: "insensitive" } },
					},
				},
			];
		}

		// Get orders with pagination
		const [orders, totalCount] = await Promise.all([
			prisma.eventMerchandiseOrder.findMany({
				where: whereClause,
				include: {
					merchandise: {
						select: {
							name: true,
							images: true,
						},
					},
					registration: {
						select: {
							id: true,
							user: {
								select: {
									fullName: true,
									email: true,
								},
							},
						},
					},
				},
				orderBy: { createdAt: "desc" },
				skip,
				take: parseInt(limit),
			}),

			prisma.eventMerchandiseOrder.count({ where: whereClause }),
		]);

		// Calculate totals
		const totalAmount = await prisma.eventMerchandiseOrder.aggregate({
			where: { registration: { eventId } },
			_sum: { totalPrice: true },
		});

		const orderStats = {
			totalOrders: totalCount,
			totalAmount: Number(totalAmount._sum.totalPrice || 0),
			totalPages: Math.ceil(totalCount / parseInt(limit)),
			currentPage: parseInt(page),
		};

		const formattedOrders = orders.map((order) => ({
			id: order.id,
			merchandise: {
				id: order.merchandiseId,
				name: order.merchandise.name,
				images: order.merchandise.images,
			},
			customer: {
				name: order.registration.user.fullName,
				email: order.registration.user.email,
				registrationId: order.registration.id,
			},
			quantity: order.quantity,
			selectedSize: order.selectedSize,
			unitPrice: Number(order.unitPrice),
			totalPrice: Number(order.totalPrice),
			orderDate: order.createdAt,
		}));

		return successResponse(
			res,
			{
				orders: formattedOrders,
				stats: orderStats,
				pagination: {
					currentPage: parseInt(page),
					totalPages: orderStats.totalPages,
					totalCount,
					limit: parseInt(limit),
				},
			},
			"Event orders retrieved successfully"
		);
	} catch (error) {
		console.error("Get all event orders error:", error);
		return errorResponse(res, "Failed to retrieve event orders", 500);
	}
};

module.exports = {
	addToCart,
	getCart,
	updateCartItem,
	removeFromCart,
	checkoutCart,
	getMyOrders,
	getAllEventOrders,
};
