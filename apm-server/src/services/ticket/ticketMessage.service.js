// ============================================
// PHASE 2: ENHANCED MESSAGING SERVICES
// Enhanced service methods for messaging system
// ============================================

// ============================================
// FILE: src/services/ticketMessage.service.js (NEW)
// ============================================

// const { prisma } = require('../config/database');
const CacheService = require("../../config/redis");
const TicketAuditService = require("./ticketAudit.service");
const TicketFileService = require("./ticketFile.service");

class TicketMessageService {
	// ==========================================
	// MESSAGE CRUD OPERATIONS
	// ==========================================

	static async addMessage(ticketId, userId, messageData, attachments = []) {
		const {
			message,
			contentType = "PLAIN_TEXT",
			formattedContent,
			isInternalNote = false,
		} = messageData;

		const ticket = await prisma.ticket.findUnique({
			where: { id: ticketId },
			select: { userId: true, assignedToId: true, status: true },
		});

		if (!ticket) {
			throw new Error("Ticket not found");
		}

		// Determine if message is from admin
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true, fullName: true },
		});

		const isFromAdmin = user.role === "SUPER_ADMIN";

		const newMessage = await prisma.$transaction(async (tx) => {
			// Create the message
			const messageRecord = await tx.ticketMessage.create({
				data: {
					ticketId,
					senderId: userId,
					message: message.trim(),
					contentType,
					formattedContent,
					isFromAdmin,
					isInternalNote: isFromAdmin ? isInternalNote : false, // Only admins can create internal notes
				},
				include: {
					sender: {
						select: {
							id: true,
							fullName: true,
							role: true,
							profileImage: true,
						},
					},
				},
			});

			// Add attachments if any
			if (attachments.length > 0) {
				const attachmentRecords = await tx.ticketMessageAttachment.createMany({
					data: attachments.map((attachment) => ({
						messageId: messageRecord.id,
						filename: attachment.filename,
						originalName: attachment.originalName,
						fileSize: attachment.fileSize,
						mimeType: attachment.mimeType,
						filePath: attachment.filePath,
					})),
				});

				// Process file metadata for attachments
				for (const attachment of attachments) {
					await TicketFileService.processFileMetadata(
						attachment,
						"message_attachment"
					);
				}
			}

			// Update ticket's last activity and status if needed
			const statusUpdate = {};
			if (isFromAdmin && ticket.status === "OPEN") {
				statusUpdate.status = "IN_PROGRESS";
			} else if (!isFromAdmin && ticket.status === "WAITING_FOR_USER") {
				statusUpdate.status = "IN_PROGRESS";
			}

			await tx.ticket.update({
				where: { id: ticketId },
				data: {
					lastActivity: new Date(),
					...statusUpdate,
				},
			});

			return messageRecord;
		});

		// Create audit log
		await TicketAuditService.logAction(ticketId, userId, "MESSAGE_ADDED", {
			messageId: newMessage.id,
			isInternalNote,
			attachmentCount: attachments.length,
		});

		// Clear draft if exists
		await this.clearMessageDraft(ticketId, userId);

		// Invalidate caches
		await this.invalidateMessageCaches(ticketId);

		return newMessage;
	}

	static async editMessage(messageId, userId, newContent, editReason = null) {
		// Get message with permission check
		const message = await prisma.ticketMessage.findUnique({
			where: { id: messageId },
			include: {
				sender: { select: { id: true, role: true } },
				ticket: { select: { userId: true } },
			},
		});

		if (!message) {
			throw new Error("Message not found");
		}

		// Permission check: user can edit their own messages, admins can edit any
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});

		const canEdit = message.senderId === userId || user.role === "SUPER_ADMIN";
		if (!canEdit) {
			throw new Error("Permission denied to edit this message");
		}

		// Check if message is too old to edit (24 hours for users, unlimited for admins)
		const isAdmin = user.role === "SUPER_ADMIN";
		const messageAge = Date.now() - new Date(message.createdAt).getTime();
		const maxEditAge = 24 * 60 * 60 * 1000; // 24 hours

		if (!isAdmin && messageAge > maxEditAge) {
			throw new Error("Message is too old to edit");
		}

		const updatedMessage = await prisma.$transaction(async (tx) => {
			// Save edit history
			await tx.ticketMessageEdit.create({
				data: {
					messageId,
					previousContent: message.message,
					editReason,
					editedBy: userId,
				},
			});

			// Update message
			const updated = await tx.ticketMessage.update({
				where: { id: messageId },
				data: {
					message: newContent.trim(),
					isEdited: true,
					editedAt: new Date(),
				},
				include: {
					sender: {
						select: {
							id: true,
							fullName: true,
							role: true,
							profileImage: true,
						},
					},
					editHistory: {
						include: {
							editor: {
								select: { id: true, fullName: true },
							},
						},
						orderBy: { createdAt: "desc" },
					},
				},
			});

			return updated;
		});

		// Create audit log
		await TicketAuditService.logAction(
			message.ticket.id,
			userId,
			"MESSAGE_EDITED",
			{
				messageId,
				editReason,
			}
		);

		// Invalidate caches
		await this.invalidateMessageCaches(message.ticketId);

		return updatedMessage;
	}

	// ==========================================
	// MESSAGE REACTIONS
	// ==========================================

	static async addReaction(messageId, userId, reactionType) {
		// Check if message exists and user has access
		const message = await prisma.ticketMessage.findUnique({
			where: { id: messageId },
			include: {
				ticket: {
					select: { userId: true, assignedToId: true },
				},
				sender: {
					select: { id: true },
				},
			},
		});

		if (!message) {
			throw new Error("Message not found");
		}

		// Permission check: ticket owner, assigned admin, or message sender can react
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});

		const hasAccess =
			message.ticket.userId === userId ||
			message.ticket.assignedToId === userId ||
			user.role === "SUPER_ADMIN";

		if (!hasAccess) {
			throw new Error("Permission denied to react to this message");
		}

		// Add or toggle reaction
		const existingReaction = await prisma.ticketMessageReaction.findUnique({
			where: {
				messageId_userId_reaction: {
					messageId,
					userId,
					reaction: reactionType,
				},
			},
		});

		if (existingReaction) {
			// Remove existing reaction (toggle off)
			await prisma.ticketMessageReaction.delete({
				where: { id: existingReaction.id },
			});

			await this.invalidateMessageCaches(message.ticket.id);
			return { action: "removed", reaction: reactionType };
		} else {
			// Add new reaction
			const reaction = await prisma.ticketMessageReaction.create({
				data: {
					messageId,
					userId,
					reaction: reactionType,
				},
				include: {
					user: {
						select: { id: true, fullName: true, profileImage: true },
					},
				},
			});

			// Create audit log
			await TicketAuditService.logAction(
				message.ticket.id,
				userId,
				"MESSAGE_REACTION_ADDED",
				{
					messageId,
					reactionType,
				}
			);

			await this.invalidateMessageCaches(message.ticket.id);
			return { action: "added", reaction: reactionType, data: reaction };
		}
	}

	static async getMessageReactions(messageId) {
		const reactions = await prisma.ticketMessageReaction.findMany({
			where: { messageId },
			include: {
				user: {
					select: { id: true, fullName: true, profileImage: true },
				},
			},
			orderBy: { createdAt: "asc" },
		});

		// Group reactions by type
		const groupedReactions = {};
		reactions.forEach((reaction) => {
			if (!groupedReactions[reaction.reaction]) {
				groupedReactions[reaction.reaction] = [];
			}
			groupedReactions[reaction.reaction].push(reaction);
		});

		return groupedReactions;
	}

	// ==========================================
	// MESSAGE DRAFTS
	// ==========================================

	static async saveMessageDraft(ticketId, userId, content) {
		const draft = await prisma.ticketMessageDraft.upsert({
			where: {
				ticketId_userId: {
					ticketId,
					userId,
				},
			},
			update: {
				content: content.trim(),
				updatedAt: new Date(),
			},
			create: {
				ticketId,
				userId,
				content: content.trim(),
			},
		});

		return draft;
	}

	static async getMessageDraft(ticketId, userId) {
		const draft = await prisma.ticketMessageDraft.findUnique({
			where: {
				ticketId_userId: {
					ticketId,
					userId,
				},
			},
		});

		return draft;
	}

	static async clearMessageDraft(ticketId, userId) {
		try {
			await prisma.ticketMessageDraft.delete({
				where: {
					ticketId_userId: {
						ticketId,
						userId,
					},
				},
			});
		} catch (error) {
			// Ignore if draft doesn't exist
			if (error.code !== "P2025") {
				throw error;
			}
		}
	}

	// ==========================================
	// MESSAGE HISTORY & METADATA
	// ==========================================

	static async getMessageEditHistory(messageId, requesterId) {
		// Check access permission
		const message = await prisma.ticketMessage.findUnique({
			where: { id: messageId },
			include: {
				ticket: {
					select: { userId: true, assignedToId: true },
				},
			},
		});

		if (!message) {
			throw new Error("Message not found");
		}

		// Permission check
		const user = await prisma.user.findUnique({
			where: { id: requesterId },
			select: { role: true },
		});

		const hasAccess =
			message.ticket.userId === requesterId ||
			message.ticket.assignedToId === requesterId ||
			user.role === "SUPER_ADMIN";

		if (!hasAccess) {
			throw new Error("Permission denied");
		}

		const editHistory = await prisma.ticketMessageEdit.findMany({
			where: { messageId },
			include: {
				editor: {
					select: { id: true, fullName: true, role: true },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return editHistory;
	}

	// ==========================================
	// CACHE MANAGEMENT
	// ==========================================

	static async invalidateMessageCaches(ticketId) {
		const patterns = [
			`tickets:details:${ticketId}`,
			`tickets:messages:${ticketId}:*`,
			`tickets:user:*`,
			`tickets:admin:*`,
		];

		await Promise.all(
			patterns.map((pattern) => CacheService.delPattern(pattern))
		);
	}
}

module.exports = TicketMessageService;
