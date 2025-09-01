const TicketMessageService = require("../../services/ticket/ticketMessage.service");
const TicketAuditService = require("../../services/ticket/ticketAudit.service");
const { successResponse, errorResponse } = require("../../utils/response");
const { prisma } = require("../../config/database");

/**
 * Edit existing message
 * PUT /api/tickets/:ticketId/messages/:messageId
 */
const editMessage = async (req, res) => {
	try {
		const { messageId } = req.params;
		const { message, editReason } = req.body;
		const userId = req.user.id;

		const updatedMessage = await TicketMessageService.editMessage(
			messageId,
			userId,
			message,
			editReason
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "ticket_message_edited",
				details: {
					messageId,
					ticketId: req.params.ticketId,
					editReason,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(res, updatedMessage, "Message updated successfully");
	} catch (error) {
		console.error("Edit message error:", error);
		return errorResponse(res, error.message || "Failed to edit message", 500);
	}
};

/**
 * Add reaction to message
 * POST /api/tickets/:ticketId/messages/:messageId/react
 */
const addReaction = async (req, res) => {
	try {
		const { messageId } = req.params;
		const { reaction } = req.body;
		const userId = req.user.id;

		const result = await TicketMessageService.addReaction(
			messageId,
			userId,
			reaction
		);

		// Log activity only for added reactions (not removed)
		if (result.action === "added") {
			await prisma.activityLog.create({
				data: {
					userId,
					action: "ticket_message_reaction",
					details: {
						messageId,
						ticketId: req.params.ticketId,
						reaction: result.reaction,
						action: result.action,
					},
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
				},
			});
		}

		return successResponse(
			res,
			result,
			`Reaction ${result.action} successfully`
		);
	} catch (error) {
		console.error("Add reaction error:", error);
		return errorResponse(res, error.message || "Failed to add reaction", 500);
	}
};

/**
 * Get message reactions
 * GET /api/tickets/:ticketId/messages/:messageId/reactions
 */
const getMessageReactions = async (req, res) => {
	try {
		const { messageId } = req.params;

		const reactions = await TicketMessageService.getMessageReactions(messageId);

		return successResponse(
			res,
			reactions,
			"Message reactions retrieved successfully"
		);
	} catch (error) {
		console.error("Get message reactions error:", error);
		return errorResponse(res, "Failed to retrieve reactions", 500);
	}
};

/**
 * Get message edit history
 * GET /api/tickets/:ticketId/messages/:messageId/history
 */
const getMessageEditHistory = async (req, res) => {
	try {
		const { messageId } = req.params;
		const userId = req.user.id;

		const history = await TicketMessageService.getMessageEditHistory(
			messageId,
			userId
		);

		return successResponse(
			res,
			history,
			"Message edit history retrieved successfully"
		);
	} catch (error) {
		console.error("Get message edit history error:", error);
		return errorResponse(
			res,
			error.message || "Failed to retrieve edit history",
			500
		);
	}
};

/**
 * Save message draft
 * POST /api/tickets/:ticketId/messages/draft
 */
const saveMessageDraft = async (req, res) => {
	try {
		const { ticketId } = req.params;
		const { content } = req.body;
		const userId = req.user.id;

		const draft = await TicketMessageService.saveMessageDraft(
			ticketId,
			userId,
			content
		);

		return successResponse(res, draft, "Draft saved successfully");
	} catch (error) {
		console.error("Save message draft error:", error);
		return errorResponse(res, error.message || "Failed to save draft", 500);
	}
};

/**
 * Get saved message draft
 * GET /api/tickets/:ticketId/messages/draft
 */
const getMessageDraft = async (req, res) => {
	try {
		const { ticketId } = req.params;
		const userId = req.user.id;

		const draft = await TicketMessageService.getMessageDraft(ticketId, userId);

		return successResponse(res, draft, "Draft retrieved successfully");
	} catch (error) {
		console.error("Get message draft error:", error);
		return errorResponse(res, "Failed to retrieve draft", 500);
	}
};

/**
 * Clear message draft
 * DELETE /api/tickets/:ticketId/messages/draft
 */
const clearMessageDraft = async (req, res) => {
	try {
		const { ticketId } = req.params;
		const userId = req.user.id;

		await TicketMessageService.clearMessageDraft(ticketId, userId);

		return successResponse(res, null, "Draft cleared successfully");
	} catch (error) {
		console.error("Clear message draft error:", error);
		return errorResponse(res, "Failed to clear draft", 500);
	}
};

module.exports = {
	editMessage,
	addReaction,
	getMessageReactions,
	getMessageEditHistory,
	saveMessageDraft,
	getMessageDraft,
	clearMessageDraft,
};
