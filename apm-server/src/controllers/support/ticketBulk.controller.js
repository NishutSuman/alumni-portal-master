const TicketBulkService = require("../../services/ticket/ticketBulk.service");
const { successResponse, errorResponse } = require("../../utils/response");
const { prisma } = require("../../config/database");

/**
 * Bulk assign tickets to admin
 * POST /api/tickets/admin/bulk/assign
 */
const bulkAssignTickets = async (req, res) => {
	try {
		const { ticketIds, assignedToId } = req.body;
		const adminId = req.user.id;

		if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
			return errorResponse(res, "Ticket IDs array is required", 400);
		}

		// Validate assigned admin
		const assignedAdmin = await prisma.user.findUnique({
			where: { id: assignedToId },
			select: { id: true, fullName: true, role: true, isActive: true },
		});

		if (
			!assignedAdmin ||
			assignedAdmin.role !== "SUPER_ADMIN" ||
			!assignedAdmin.isActive
		) {
			return errorResponse(res, "Invalid admin selection", 400);
		}

		const operationData = {
			assignedToId,
			adminName: assignedAdmin.fullName,
		};

		const result = await TicketBulkService.performBulkOperation(
			adminId,
			"ASSIGN_TO_ADMIN",
			ticketIds,
			operationData
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "ticket_bulk_assign",
				details: {
					operationId: result.operationId,
					ticketCount: ticketIds.length,
					assignedToId,
					assignedToName: assignedAdmin.fullName,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			result,
			"Bulk assignment operation started",
			202
		);
	} catch (error) {
		console.error("Bulk assign tickets error:", error);
		return errorResponse(
			res,
			error.message || "Failed to start bulk assignment",
			500
		);
	}
};

/**
 * Bulk change ticket status
 * POST /api/tickets/admin/bulk/status
 */
const bulkChangeStatus = async (req, res) => {
	try {
		const { ticketIds, status } = req.body;
		const adminId = req.user.id;

		if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
			return errorResponse(res, "Ticket IDs array is required", 400);
		}

		const validStatuses = [
			"OPEN",
			"IN_PROGRESS",
			"WAITING_FOR_USER",
			"RESOLVED",
			"CLOSED",
		];
		if (!validStatuses.includes(status)) {
			return errorResponse(res, "Invalid status value", 400);
		}

		const operationData = { status };

		const result = await TicketBulkService.performBulkOperation(
			adminId,
			"CHANGE_STATUS",
			ticketIds,
			operationData
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "ticket_bulk_status_change",
				details: {
					operationId: result.operationId,
					ticketCount: ticketIds.length,
					newStatus: status,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			result,
			"Bulk status change operation started",
			202
		);
	} catch (error) {
		console.error("Bulk change status error:", error);
		return errorResponse(
			res,
			error.message || "Failed to start bulk status change",
			500
		);
	}
};

/**
 * Bulk change ticket priority
 * POST /api/tickets/admin/bulk/priority
 */
const bulkChangePriority = async (req, res) => {
	try {
		const { ticketIds, priority } = req.body;
		const adminId = req.user.id;

		if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
			return errorResponse(res, "Ticket IDs array is required", 400);
		}

		const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
		if (!validPriorities.includes(priority)) {
			return errorResponse(res, "Invalid priority value", 400);
		}

		const operationData = { priority };

		const result = await TicketBulkService.performBulkOperation(
			adminId,
			"CHANGE_PRIORITY",
			ticketIds,
			operationData
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "ticket_bulk_priority_change",
				details: {
					operationId: result.operationId,
					ticketCount: ticketIds.length,
					newPriority: priority,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			result,
			"Bulk priority change operation started",
			202
		);
	} catch (error) {
		console.error("Bulk change priority error:", error);
		return errorResponse(
			res,
			error.message || "Failed to start bulk priority change",
			500
		);
	}
};

/**
 * Bulk close tickets with resolution
 * POST /api/tickets/admin/bulk/close
 */
const bulkCloseTickets = async (req, res) => {
	try {
		const { ticketIds, resolutionNote } = req.body;
		const adminId = req.user.id;

		if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
			return errorResponse(res, "Ticket IDs array is required", 400);
		}

		if (!resolutionNote || resolutionNote.trim().length < 5) {
			return errorResponse(
				res,
				"Resolution note is required (minimum 5 characters)",
				400
			);
		}

		const operationData = {
			resolutionNote: resolutionNote.trim(),
		};

		const result = await TicketBulkService.performBulkOperation(
			adminId,
			"CLOSE_WITH_RESOLUTION",
			ticketIds,
			operationData
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "ticket_bulk_close",
				details: {
					operationId: result.operationId,
					ticketCount: ticketIds.length,
					resolutionNote,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(res, result, "Bulk close operation started", 202);
	} catch (error) {
		console.error("Bulk close tickets error:", error);
		return errorResponse(
			res,
			error.message || "Failed to start bulk close operation",
			500
		);
	}
};

/**
 * Bulk change ticket category
 * POST /api/tickets/admin/bulk/category
 */
const bulkChangeCategory = async (req, res) => {
	try {
		const { ticketIds, categoryId } = req.body;
		const adminId = req.user.id;

		if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
			return errorResponse(res, "Ticket IDs array is required", 400);
		}

		// Validate category
		const category = await prisma.ticketCategory.findUnique({
			where: { id: categoryId },
			select: { id: true, name: true, isActive: true },
		});

		if (!category || !category.isActive) {
			return errorResponse(res, "Invalid category selection", 400);
		}

		const operationData = {
			categoryId,
			categoryName: category.name,
		};

		const result = await TicketBulkService.performBulkOperation(
			adminId,
			"CHANGE_CATEGORY",
			ticketIds,
			operationData
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "ticket_bulk_category_change",
				details: {
					operationId: result.operationId,
					ticketCount: ticketIds.length,
					newCategoryId: categoryId,
					newCategoryName: category.name,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			result,
			"Bulk category change operation started",
			202
		);
	} catch (error) {
		console.error("Bulk change category error:", error);
		return errorResponse(
			res,
			error.message || "Failed to start bulk category change",
			500
		);
	}
};

/**
 * Get bulk operation status
 * GET /api/tickets/admin/bulk/operations/:operationId
 */
const getBulkOperationStatus = async (req, res) => {
	try {
		const { operationId } = req.params;
		const adminId = req.user.id;

		const operation = await TicketBulkService.getBulkOperationStatus(
			operationId,
			adminId
		);

		return successResponse(
			res,
			operation,
			"Bulk operation status retrieved successfully"
		);
	} catch (error) {
		console.error("Get bulk operation status error:", error);
		return errorResponse(
			res,
			error.message || "Failed to get operation status",
			500
		);
	}
};

/**
 * Get admin's bulk operation history
 * GET /api/tickets/admin/bulk/history
 */
const getBulkOperationHistory = async (req, res) => {
	try {
		const { limit = 20 } = req.query;
		const adminId = req.user.id;

		const history = await TicketBulkService.getAdminBulkOperationHistory(
			adminId,
			parseInt(limit)
		);

		return successResponse(
			res,
			history,
			"Bulk operation history retrieved successfully"
		);
	} catch (error) {
		console.error("Get bulk operation history error:", error);
		return errorResponse(res, "Failed to retrieve operation history", 500);
	}
};

module.exports = {
	bulkAssignTickets,
	bulkChangeStatus,
	bulkChangePriority,
	bulkCloseTickets,
	bulkChangeCategory,
	getBulkOperationStatus,
	getBulkOperationHistory,
};
