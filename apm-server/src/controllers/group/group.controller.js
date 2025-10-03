// src/controllers/group.controller.js
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../../utils/response");
const { CacheService } = require("../../config/redis");

const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get role validation for group type
const getRolesByGroupType = (groupType) => {
	const roleMapping = {
		CELL: ["CONVENER", "CO_CONVENER", "STAKE_HOLDER"],
		COMMITTEE: ["CONVENER", "CO_CONVENER", "STAKE_HOLDER"],
		OFFICE_BEARERS: [
			"PRESIDENT",
			"VICE_PRESIDENT",
			"SECRETARY",
			"JOINT_SECRETARY",
			"TREASURER",
			"JOINT_TREASURER",
		],
		ADVISORS: ["CHIEF_ADVISOR", "JOINT_ADVISOR"],
	};
	return roleMapping[groupType] || [];
};

// Format group data for response
const formatGroupData = (group, includeMembers = false) => {
	const formatted = {
		id: group.id,
		name: group.name,
		type: group.type,
		description: group.description,
		isActive: group.isActive,
		displayOrder: group.displayOrder,
		createdBy: group.createdBy,
		createdAt: group.createdAt,
		updatedAt: group.updatedAt,
		membersCount: group.members?.length || group._count?.members || 0,
		allowedRoles: getRolesByGroupType(group.type),
	};

	if (includeMembers && group.members) {
		formatted.members = group.members.map((member) => ({
			id: member.id,
			role: member.role,
			isActive: member.isActive,
			addedAt: member.createdAt,
			user: {
				id: member.user.id,
				fullName: member.user.fullName, 
				profileImage: member.user.profileImage,
				batch: member.user.batch,
			},
		}));
	}

	return formatted;
};

// ============================================
// GROUP MANAGEMENT CONTROLLERS
// ============================================

/**
 * Get all groups with filtering and pagination
 * GET /api/groups
 * Access: SUPER_ADMIN
 */
const getGroups = async (req, res) => {
	try {
		const {
			type,
			isActive,
			search,
			page = 1,
			limit = 10,
			sortBy = "displayOrder",
			sortOrder = "asc",
			includeMembers = "false",
		} = req.query;

		// Build where clause
		const where = {};

		if (type) {
			where.type = type;
		}

		if (isActive !== undefined) {
			where.isActive = isActive === "true";
		}

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
			];
		}

		// Build order clause
		const orderBy = {};
		orderBy[sortBy] = sortOrder;

		// Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Build include clause
		const include = {
			_count: { 
				select: { 
					members: { where: { isActive: true } } 
				} 
			},
		};

		if (includeMembers === "true") {
			include.members = {
				where: { isActive: true },
				select: {
					id: true,
					role: true,
					isActive: true,
					createdAt: true,
					user: {
						select: {
							id: true,
							fullName: true,
							profileImage: true,
							batch: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			};
		}

		// Execute queries
		const [groups, totalCount] = await Promise.all([
			prisma.organizationGroup.findMany({
				where,
				include,
				orderBy,
				skip,
				take: parseInt(limit),
			}),
			prisma.organizationGroup.count({ where }),
		]);

		// Format response data
		const formattedGroups = groups.map((group) =>
			formatGroupData(group, includeMembers === "true")
		);

		const responseData = {
			groups: formattedGroups,
			pagination: {
				currentPage: parseInt(page),
				totalPages: Math.ceil(totalCount / parseInt(limit)),
				totalCount,
				hasNext: parseInt(page) * parseInt(limit) < totalCount,
				hasPrev: parseInt(page) > 1,
			},
			filters: {
				type,
				isActive,
				search,
				sortBy,
				sortOrder,
			},
		};

		// Cache the result
		if (req.cacheKey && req.cacheTTL) {
			await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
		}

		return successResponse(res, responseData, "Groups retrieved successfully");
	} catch (error) {
		console.error("Get groups error:", error);
		return errorResponse(res, "Failed to retrieve groups", 500);
	}
};

/**
 * Get single group with details
 * GET /api/groups/:groupId
 * Access: SUPER_ADMIN
 */
const getGroup = async (req, res) => {
	try {
		const { groupId } = req.params;
		const { includeMembers = "true" } = req.query;

		const include = {
			creator: {
				select: {
					id: true,
					fullName: true,
				},
			},
			_count: { 
				select: { 
					members: { where: { isActive: true } } 
				} 
			},
		};

		if (includeMembers === "true") {
			include.members = {
				where: {
					isActive: true, // Only fetch active members for better performance
				},
				select: {
					id: true,
					role: true,
					isActive: true,
					createdAt: true,
					user: {
						select: {
							id: true,
							fullName: true,
							profileImage: true,
							batch: true,
						},
					},
				},
				orderBy: { createdAt: "desc" },
			};
		}

		const group = await prisma.organizationGroup.findUnique({
			where: { id: groupId },
			include,
		});

		if (!group) {
			return errorResponse(res, "Group not found", 404);
		}

		const responseData = {
			...formatGroupData(group, includeMembers === "true"),
			creator: group.creator,
		};

		// Cache the result
		if (req.cacheKey && req.cacheTTL) {
			await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
		}

		return successResponse(res, responseData, "Group retrieved successfully");
	} catch (error) {
		console.error("Get group error:", error);
		return errorResponse(res, "Failed to retrieve group", 500);
	}
};

/**
 * Create new group
 * POST /api/groups
 * Access: SUPER_ADMIN
 */
const createGroup = async (req, res) => {
	try {
		const { name, type, description, displayOrder } = req.body;
		const userId = req.user.id;

		// Get next display order if not provided
		let finalDisplayOrder = displayOrder;
		if (finalDisplayOrder === undefined) {
			const lastGroup = await prisma.organizationGroup.findFirst({
				where: { type },
				orderBy: { displayOrder: "desc" },
				select: { displayOrder: true },
			});
			finalDisplayOrder = (lastGroup?.displayOrder || 0) + 1;
		}

		// Create group
		const group = await prisma.organizationGroup.create({
			data: {
				name: name.trim(),
				type,
				description: description?.trim() || null,
				displayOrder: finalDisplayOrder,
				createdBy: userId,
			},
			include: {
				creator: {
					select: {
						id: true,
						fullName: true,
					},
				},
				_count: { select: { members: true } },
			},
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "group_create",
				details: {
					groupId: group.id,
					groupName: group.name,
					groupType: group.type,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		const responseData = {
			...formatGroupData(group),
			creator: group.creator,
		};

		return successResponse(
			res,
			responseData,
			"Group created successfully",
			201
		);
	} catch (error) {
		console.error("Create group error:", error);
		return errorResponse(res, "Failed to create group", 500);
	}
};

/**
 * Update group
 * PUT /api/groups/:groupId
 * Access: SUPER_ADMIN
 */
const updateGroup = async (req, res) => {
	try {
		const { groupId } = req.params;
		const { name, description, isActive, displayOrder } = req.body;
		const userId = req.user.id;

		// Build update data
		const updateData = {};
		if (name !== undefined) updateData.name = name.trim();
		if (description !== undefined)
			updateData.description = description?.trim() || null;
		if (isActive !== undefined) updateData.isActive = isActive;
		if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

		// Update group
		const group = await prisma.organizationGroup.update({
			where: { id: groupId },
			data: updateData,
			include: {
				creator: {
					select: {
						id: true,
						fullName: true,
					},
				},
				_count: { select: { members: true } },
			},
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "group_update",
				details: {
					groupId: group.id,
					groupName: group.name,
					updatedFields: Object.keys(updateData),
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		const responseData = {
			...formatGroupData(group),
			creator: group.creator,
		};

		return successResponse(res, responseData, "Group updated successfully");
	} catch (error) {
		console.error("Update group error:", error);
		return errorResponse(res, "Failed to update group", 500);
	}
};

/**
 * Delete group
 * DELETE /api/groups/:groupId
 * Access: SUPER_ADMIN
 */
const deleteGroup = async (req, res) => {
	try {
		const { groupId } = req.params;
		const userId = req.user.id;

		// Get group details for logging
		const group = await prisma.organizationGroup.findUnique({
			where: { id: groupId },
			select: {
				id: true,
				name: true,
				type: true,
				_count: { select: { members: true } },
			},
		});

		if (!group) {
			return errorResponse(res, "Group not found", 404);
		}

		// Delete group (cascade will handle members)
		await prisma.organizationGroup.delete({
			where: { id: groupId },
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "group_delete",
				details: {
					groupId: group.id,
					groupName: group.name,
					groupType: group.type,
					memberCount: group._count.members,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{ deletedGroup: { id: group.id, name: group.name } },
			"Group deleted successfully"
		);
	} catch (error) {
		console.error("Delete group error:", error);
		return errorResponse(res, "Failed to delete group", 500);
	}
};

/**
 * Reorder groups
 * POST /api/groups/reorder
 * Access: SUPER_ADMIN
 */
const reorderGroups = async (req, res) => {
	try {
		const { groups } = req.body;
		const userId = req.user.id;

		// Validate all group IDs exist
		const existingGroups = await prisma.organizationGroup.findMany({
			where: {
				id: { in: groups.map((g) => g.id) },
			},
			select: { id: true, name: true },
		});

		if (existingGroups.length !== groups.length) {
			return errorResponse(res, "One or more groups not found", 404);
		}

		// Update display orders in transaction
		await prisma.$transaction(
			groups.map((group) =>
				prisma.organizationGroup.update({
					where: { id: group.id },
					data: { displayOrder: group.displayOrder },
				})
			)
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "groups_reorder",
				details: {
					reorderedGroups: groups.length,
					groupIds: groups.map((g) => g.id),
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{ reorderedCount: groups.length },
			"Groups reordered successfully"
		);
	} catch (error) {
		console.error("Reorder groups error:", error);
		return errorResponse(res, "Failed to reorder groups", 500);
	}
};

// ============================================
// MEMBER MANAGEMENT CONTROLLERS
// ============================================

/**
 * Get group members
 * GET /api/groups/:groupId/members
 * Access: SUPER_ADMIN
 */
const getGroupMembers = async (req, res) => {
	try {
		const { groupId } = req.params;
		const {
			isActive,
			role,
			search,
			page = 1,
			limit = 20,
			sortBy = "createdAt",
			sortOrder = "desc",
		} = req.query;

		// Build where clause
		const where = { groupId };

		if (isActive !== undefined) {
			where.isActive = isActive === "true";
		}

		if (role) {
			where.role = role;
		}

		if (search) {
			where.user = {
				OR: [
					{ fullName: { contains: search, mode: "insensitive" } },
					{ email: { contains: search, mode: "insensitive" } },
				],
			};
		}

		// Build order clause
		const orderBy = {};
		if (sortBy === "name") {
			orderBy.user = { fullName: sortOrder };
		} else {
			orderBy[sortBy] = sortOrder;
		}

		// Calculate pagination
		const skip = (parseInt(page) - 1) * parseInt(limit);

		// Execute queries
		const [members, totalCount] = await Promise.all([
			prisma.groupMember.findMany({
				where,
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							profileImage: true,
							batch: true,
							isActive: true,
						},
					},
					adder: {
						select: {
							id: true,
							fullName: true,
						},
					},
				},
				orderBy,
				skip,
				take: parseInt(limit),
			}),
			prisma.groupMember.count({ where }),
		]);

		const responseData = {
			members: members.map((member) => ({
				id: member.id,
				role: member.role,
				isActive: member.isActive,
				addedAt: member.createdAt,
				user: member.user,
				addedBy: member.adder,
			})),
			pagination: {
				currentPage: parseInt(page),
				totalPages: Math.ceil(totalCount / parseInt(limit)),
				totalCount,
				hasNext: parseInt(page) * parseInt(limit) < totalCount,
				hasPrev: parseInt(page) > 1,
			},
			filters: {
				isActive,
				role,
				search,
				sortBy,
				sortOrder,
			},
		};

		// Cache the result
		if (req.cacheKey && req.cacheTTL) {
			await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
		}

		return successResponse(
			res,
			responseData,
			"Group members retrieved successfully"
		);
	} catch (error) {
		console.error("Get group members error:", error);
		return errorResponse(res, "Failed to retrieve group members", 500);
	}
};

/**
 * Add member to group
 * POST /api/groups/:groupId/members
 * Access: SUPER_ADMIN
 */
const addGroupMember = async (req, res) => {
	try {
		const { groupId } = req.params;
		const { userId, role } = req.body;
		const adminId = req.user.id;

		// Check if member already exists (including inactive ones)
		const existingMember = await prisma.groupMember.findUnique({
			where: {
				groupId_userId: { groupId, userId },
			},
		});

		let member;

		if (existingMember) {
			// Reactivate existing member with new role
			member = await prisma.groupMember.update({
				where: { id: existingMember.id },
				data: {
					role,
					isActive: true,
					addedBy: adminId,
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							profileImage: true,
							batch: true,
						},
					},
					adder: {
						select: {
							id: true,
							fullName: true,
						},
					},
				},
			});
		} else {
			// Create new member
			member = await prisma.groupMember.create({
				data: {
					groupId,
					userId,
					role,
					addedBy: adminId,
				},
				include: {
					user: {
						select: {
							id: true,
							fullName: true,
							email: true,
							profileImage: true,
							batch: true,
						},
					},
					adder: {
						select: {
							id: true,
							fullName: true,
						},
					},
				},
			});
		}

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "group_member_add",
				details: {
					groupId,
					memberId: member.id,
					memberUserId: userId,
					role,
					wasReactivated: !!existingMember,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		const responseData = {
			id: member.id,
			role: member.role,
			isActive: member.isActive,
			addedAt: member.createdAt,
			user: member.user,
			addedBy: member.adder,
		};

		return successResponse(
			res,
			responseData,
			existingMember
				? "Member reactivated successfully"
				: "Member added successfully",
			201
		);
	} catch (error) {
		console.error("Add group member error:", error);
		return errorResponse(res, "Failed to add group member", 500);
	}
};

/**
 * Update group member
 * PUT /api/groups/:groupId/members/:userId
 * Access: SUPER_ADMIN
 */
const updateGroupMember = async (req, res) => {
	try {
		const { groupId, userId } = req.params;
		const { role, isActive } = req.body;
		const adminId = req.user.id;

		// Build update data
		const updateData = {};
		if (role !== undefined) updateData.role = role;
		if (isActive !== undefined) updateData.isActive = isActive;

		// Update member
		const member = await prisma.groupMember.update({
			where: {
				groupId_userId: { groupId, userId },
			},
			data: updateData,
			include: {
				user: {
					select: {
						id: true,
						fullName: true,
						email: true,
						profileImage: true,
						batch: true,
					},
				},
				adder: {
					select: {
						id: true,
						fullName: true,
					},
				},
			},
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "group_member_update",
				details: {
					groupId,
					memberId: member.id,
					memberUserId: userId,
					updatedFields: Object.keys(updateData),
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		const responseData = {
			id: member.id,
			role: member.role,
			isActive: member.isActive,
			addedAt: member.createdAt,
			user: member.user,
			addedBy: member.adder,
		};

		return successResponse(res, responseData, "Member updated successfully");
	} catch (error) {
		console.error("Update group member error:", error);
		return errorResponse(res, "Failed to update group member", 500);
	}
};

/**
 * Remove member from group
 * DELETE /api/groups/:groupId/members/:userId
 * Access: SUPER_ADMIN
 */
const removeGroupMember = async (req, res) => {
	try {
		const { groupId, userId } = req.params;
		const adminId = req.user.id;

		// Get member details for logging
		const member = await prisma.groupMember.findUnique({
			where: {
				groupId_userId: { groupId, userId },
			},
			include: {
				user: {
					select: {
						id: true,
						fullName: true,
					},
				},
			},
		});

		if (!member) {
			return errorResponse(res, "Member not found in this group", 404);
		}

		// Soft delete - set as inactive
		await prisma.groupMember.update({
			where: { id: member.id },
			data: { isActive: false },
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "group_member_remove",
				details: {
					groupId,
					memberId: member.id,
					memberUserId: userId,
					memberName: `${member.user.fullName}`,
					role: member.role,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{
				removedMember: {
					id: member.user.id,
					name: `${member.user.fullName}`,
					role: member.role,
				},
			},
			"Member removed successfully"
		);
	} catch (error) {
		console.error("Remove group member error:", error);
		return errorResponse(res, "Failed to remove group member", 500);
	}
};

/**
 * Bulk member operations
 * POST /api/groups/:groupId/members/bulk
 * Access: SUPER_ADMIN
 */
const bulkMemberOperations = async (req, res) => {
	try {
		const { groupId } = req.params;
		const { action, members } = req.body;
		const adminId = req.user.id;

		const results = {
			successful: [],
			failed: [],
		};

		// Process each member
		for (const memberData of members) {
			try {
				const { userId, role } = memberData;

				switch (action) {
					case "add":
						const existingMember = await prisma.groupMember.findUnique({
							where: { groupId_userId: { groupId, userId } },
						});

						if (existingMember) {
							await prisma.groupMember.update({
								where: { id: existingMember.id },
								data: { role, isActive: true, addedBy: adminId },
							});
						} else {
							await prisma.groupMember.create({
								data: { groupId, userId, role, addedBy: adminId },
							});
						}
						results.successful.push({ userId, action: "added", role });
						break;

					case "remove":
						await prisma.groupMember.updateMany({
							where: { groupId, userId },
							data: { isActive: false },
						});
						results.successful.push({ userId, action: "removed" });
						break;

					case "update":
						await prisma.groupMember.update({
							where: { groupId_userId: { groupId, userId } },
							data: { role },
						});
						results.successful.push({ userId, action: "updated", role });
						break;
				}
			} catch (error) {
				results.failed.push({
					userId: memberData.userId,
					error: error.message,
				});
			}
		}

		// Log bulk activity
		await prisma.activityLog.create({
			data: {
				userId: adminId,
				action: "group_members_bulk",
				details: {
					groupId,
					action,
					totalProcessed: members.length,
					successful: results.successful.length,
					failed: results.failed.length,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(res, results, `Bulk ${action} operation completed`);
	} catch (error) {
		console.error("Bulk member operations error:", error);
		return errorResponse(res, "Failed to process bulk member operations", 500);
	}
};

// ============================================
// PUBLIC/STATISTICS CONTROLLERS
// ============================================

/**
 * Get group statistics
 * GET /api/groups/statistics
 * Access: SUPER_ADMIN
 */
const getGroupStatistics = async (req, res) => {
	try {
		const [
			totalGroups,
			activeGroups,
			groupsByType,
			totalMembers,
			activeMembers,
			membersByRole,
		] = await Promise.all([
			prisma.organizationGroup.count(),
			prisma.organizationGroup.count({ where: { isActive: true } }),
			prisma.organizationGroup.groupBy({
				by: ["type"],
				_count: { id: true },
				where: { isActive: true },
			}),
			prisma.groupMember.count(),
			prisma.groupMember.count({ where: { isActive: true } }),
			prisma.groupMember.groupBy({
				by: ["role"],
				_count: { id: true },
				where: { isActive: true },
			}),
		]);

		const responseData = {
			groups: {
				total: totalGroups,
				active: activeGroups,
				inactive: totalGroups - activeGroups,
				byType: groupsByType.reduce((acc, item) => {
					acc[item.type] = item._count.id;
					return acc;
				}, {}),
			},
			members: {
				total: totalMembers,
				active: activeMembers,
				inactive: totalMembers - activeMembers,
				byRole: membersByRole.reduce((acc, item) => {
					acc[item.role] = item._count.id;
					return acc;
				}, {}),
			},
			generatedAt: new Date().toISOString(),
		};

		// Cache the result
		if (req.cacheKey && req.cacheTTL) {
			await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
		}

		return successResponse(
			res,
			responseData,
			"Group statistics retrieved successfully"
		);
	} catch (error) {
		console.error("Get group statistics error:", error);
		return errorResponse(res, "Failed to retrieve group statistics", 500);
	}
};

/**
 * Get public groups (for public display)
 * GET /api/groups/public
 * Access: Public
 */
const getPublicGroups = async (req, res) => {
	try {
		const groups = await prisma.organizationGroup.findMany({
			where: { isActive: true },
			include: {
				members: {
					where: { isActive: true },
					include: {
						user: {
							select: {
								id: true,
								fullName: true,
								profileImage: true,
								batch: true,
								// Note: Not including email for privacy
							},
						},
					},
					orderBy: [
						{ role: "asc" }, // Order by role hierarchy
						{ createdAt: "desc" },
					],
				},
			},
			orderBy: [{ type: "asc" }, { displayOrder: "asc" }],
		});

		const responseData = {
			groups: groups.map((group) => ({
				id: group.id,
				name: group.name,
				type: group.type,
				description: group.description,
				members: group.members.map((member) => ({
					id: member.user.id,
					name: `${member.user.fullName}`,
					role: member.role,
					profileImage: member.user.profileImage,
					batch: member.user.batch,
				})),
			})),
			generatedAt: new Date().toISOString(),
		};

		// Cache the result
		if (req.cacheKey && req.cacheTTL) {
			await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
		}

		return successResponse(
			res,
			responseData,
			"Public groups retrieved successfully"
		);
	} catch (error) {
		console.error("Get public groups error:", error);
		return errorResponse(res, "Failed to retrieve public groups", 500);
	}
};

// ============================================
// EXPORTED CONTROLLERS
// ============================================

module.exports = {
	// Group management
	getGroups,
	getGroup,
	createGroup,
	updateGroup,
	deleteGroup,
	reorderGroups,

	// Member management
	getGroupMembers,
	addGroupMember,
	updateGroupMember,
	removeGroupMember,
	bulkMemberOperations,

	// Statistics and public
	getGroupStatistics,
	getPublicGroups,
};
