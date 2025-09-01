// src/controllers/sponsor.controller.js
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../../utils/response");
const { CacheService } = require("../../config/redis");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate file URL for response
const getFileUrl = (req, filename, subfolder = "") => {
	const baseUrl = `${req.protocol}://${req.get("host")}`;
	return `${baseUrl}/uploads/sponsors${subfolder ? "/" + subfolder : ""}/${filename}`;
};

// Delete uploaded file (for cleanup on errors)
const deleteUploadedFile = (filePath) => {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			console.log(`Deleted file: ${filePath}`);
		}
	} catch (error) {
		console.error(`Error deleting file ${filePath}:`, error);
	}
};

// Format sponsor data for response
const formatSponsorData = (sponsor) => {
	return {
		id: sponsor.id,
		name: sponsor.name,
		category: sponsor.category,
		description: sponsor.description,
		logoUrl: sponsor.logoUrl,
		headPhotoUrl: sponsor.headPhotoUrl,
		website: sponsor.website,
		contactEmail: sponsor.contactEmail,
		isActive: sponsor.isActive,
		displayOrder: sponsor.displayOrder,
		createdBy: sponsor.createdBy,
		createdAt: sponsor.createdAt,
		updatedAt: sponsor.updatedAt,
	};
};

// ============================================
// SPONSOR MANAGEMENT CONTROLLERS
// ============================================

/**
 * Get all sponsors with filtering and pagination
 * GET /api/sponsors
 * Access: SUPER_ADMIN
 */
const getSponsors = async (req, res) => {
	try {
		const {
			category,
			isActive,
			search,
			page = 1,
			limit = 10,
			sortBy = "displayOrder",
			sortOrder = "asc",
		} = req.query;

		// Build where clause
		const where = {};

		if (category) {
			where.category = category;
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

		// Execute queries
		const [sponsors, totalCount] = await Promise.all([
			prisma.sponsor.findMany({
				where,
				include: {
					creator: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
						},
					},
				},
				orderBy,
				skip,
				take: parseInt(limit),
			}),
			prisma.sponsor.count({ where }),
		]);

		// Format response data
		const formattedSponsors = sponsors.map((sponsor) => ({
			...formatSponsorData(sponsor),
			creator: sponsor.creator,
		}));

		const responseData = {
			sponsors: formattedSponsors,
			pagination: {
				currentPage: parseInt(page),
				totalPages: Math.ceil(totalCount / parseInt(limit)),
				totalCount,
				hasNext: parseInt(page) * parseInt(limit) < totalCount,
				hasPrev: parseInt(page) > 1,
			},
			filters: {
				category,
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

		return successResponse(
			res,
			responseData,
			"Sponsors retrieved successfully"
		);
	} catch (error) {
		console.error("Get sponsors error:", error);
		return errorResponse(res, "Failed to retrieve sponsors", 500);
	}
};

/**
 * Get single sponsor with details
 * GET /api/sponsors/:sponsorId
 * Access: SUPER_ADMIN
 */
const getSponsor = async (req, res) => {
	try {
		const { sponsorId } = req.params;

		const sponsor = await prisma.sponsor.findUnique({
			where: { id: sponsorId },
			include: {
				creator: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		if (!sponsor) {
			return errorResponse(res, "Sponsor not found", 404);
		}

		const responseData = {
			...formatSponsorData(sponsor),
			creator: sponsor.creator,
		};

		// Cache the result
		if (req.cacheKey && req.cacheTTL) {
			await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
		}

		return successResponse(res, responseData, "Sponsor retrieved successfully");
	} catch (error) {
		console.error("Get sponsor error:", error);
		return errorResponse(res, "Failed to retrieve sponsor", 500);
	}
};

/**
 * Create new sponsor
 * POST /api/sponsors
 * Access: SUPER_ADMIN
 */
const createSponsor = async (req, res) => {
	try {
		const { name, category, description, website, contactEmail, displayOrder } =
			req.body;
		const userId = req.user.id;

		// Get next display order if not provided
		let finalDisplayOrder = displayOrder;
		if (finalDisplayOrder === undefined) {
			const lastSponsor = await prisma.sponsor.findFirst({
				where: { category },
				orderBy: { displayOrder: "desc" },
				select: { displayOrder: true },
			});
			finalDisplayOrder = (lastSponsor?.displayOrder || 0) + 1;
		}

		// Handle file uploads
		let logoUrl = null;
		let headPhotoUrl = null;

		if (req.files) {
			const baseUrl = `${req.protocol}://${req.get("host")}`;

			if (req.files.logoFile && req.files.logoFile[0]) {
				const logoFile = req.files.logoFile[0];
				logoUrl = `${baseUrl}${logoFile.path.replace(process.cwd(), "").replace(/\\/g, "/")}`;
			}

			if (req.files.headPhotoFile && req.files.headPhotoFile[0]) {
				const headPhotoFile = req.files.headPhotoFile[0];
				headPhotoUrl = `${baseUrl}${headPhotoFile.path.replace(process.cwd(), "").replace(/\\/g, "/")}`;
			}
		}

		// Create sponsor
		const sponsor = await prisma.sponsor.create({
			data: {
				name: name.trim(),
				category,
				description: description?.trim() || null,
				website: website?.trim() || null,
				contactEmail: contactEmail?.trim() || null,
				logoUrl,
				headPhotoUrl,
				displayOrder: finalDisplayOrder,
				createdBy: userId,
			},
			include: {
				creator: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "sponsor_create",
				details: {
					sponsorId: sponsor.id,
					sponsorName: sponsor.name,
					category: sponsor.category,
					hasLogo: !!logoUrl,
					hasHeadPhoto: !!headPhotoUrl,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		const responseData = {
			...formatSponsorData(sponsor),
			creator: sponsor.creator,
		};

		return successResponse(
			res,
			responseData,
			"Sponsor created successfully",
			201
		);
	} catch (error) {
		console.error("Create sponsor error:", error);

		// Cleanup uploaded files on error
		if (req.files) {
			Object.values(req.files)
				.flat()
				.forEach((file) => {
					deleteUploadedFile(file.path);
				});
		}

		return errorResponse(res, "Failed to create sponsor", 500);
	}
};

/**
 * Update sponsor
 * PUT /api/sponsors/:sponsorId
 * Access: SUPER_ADMIN
 */
const updateSponsor = async (req, res) => {
	try {
		const { sponsorId } = req.params;
		const {
			name,
			category,
			description,
			website,
			contactEmail,
			isActive,
			displayOrder,
		} = req.body;
		const userId = req.user.id;

		// Build update data
		const updateData = {};
		if (name !== undefined) updateData.name = name.trim();
		if (category !== undefined) updateData.category = category;
		if (description !== undefined)
			updateData.description = description?.trim() || null;
		if (website !== undefined) updateData.website = website?.trim() || null;
		if (contactEmail !== undefined)
			updateData.contactEmail = contactEmail?.trim() || null;
		if (isActive !== undefined) updateData.isActive = isActive;
		if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

		// Update sponsor
		const sponsor = await prisma.sponsor.update({
			where: { id: sponsorId },
			data: updateData,
			include: {
				creator: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
					},
				},
			},
		});

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "sponsor_update",
				details: {
					sponsorId: sponsor.id,
					sponsorName: sponsor.name,
					updatedFields: Object.keys(updateData),
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		const responseData = {
			...formatSponsorData(sponsor),
			creator: sponsor.creator,
		};

		return successResponse(res, responseData, "Sponsor updated successfully");
	} catch (error) {
		console.error("Update sponsor error:", error);
		return errorResponse(res, "Failed to update sponsor", 500);
	}
};

/**
 * Delete sponsor
 * DELETE /api/sponsors/:sponsorId
 * Access: SUPER_ADMIN
 */
const deleteSponsor = async (req, res) => {
	try {
		const { sponsorId } = req.params;
		const userId = req.user.id;

		// Get sponsor details for logging and file cleanup
		const sponsor = await prisma.sponsor.findUnique({
			where: { id: sponsorId },
			select: {
				id: true,
				name: true,
				category: true,
				logoUrl: true,
				headPhotoUrl: true,
			},
		});

		if (!sponsor) {
			return errorResponse(res, "Sponsor not found", 404);
		}

		// Delete sponsor
		await prisma.sponsor.delete({
			where: { id: sponsorId },
		});

		// Clean up uploaded files
		if (sponsor.logoUrl) {
			const logoPath = sponsor.logoUrl.replace(
				`${req.protocol}://${req.get("host")}`,
				process.cwd()
			);
			deleteUploadedFile(logoPath);
		}

		if (sponsor.headPhotoUrl) {
			const headPhotoPath = sponsor.headPhotoUrl.replace(
				`${req.protocol}://${req.get("host")}`,
				process.cwd()
			);
			deleteUploadedFile(headPhotoPath);
		}

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "sponsor_delete",
				details: {
					sponsorId: sponsor.id,
					sponsorName: sponsor.name,
					category: sponsor.category,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{
				deletedSponsor: {
					id: sponsor.id,
					name: sponsor.name,
					category: sponsor.category,
				},
			},
			"Sponsor deleted successfully"
		);
	} catch (error) {
		console.error("Delete sponsor error:", error);
		return errorResponse(res, "Failed to delete sponsor", 500);
	}
};

/**
 * Reorder sponsors
 * POST /api/sponsors/reorder
 * Access: SUPER_ADMIN
 */
const reorderSponsors = async (req, res) => {
	try {
		const { sponsors } = req.body;
		const userId = req.user.id;

		// Validate all sponsor IDs exist
		const existingSponsors = await prisma.sponsor.findMany({
			where: {
				id: { in: sponsors.map((s) => s.id) },
			},
			select: { id: true, name: true },
		});

		if (existingSponsors.length !== sponsors.length) {
			return errorResponse(res, "One or more sponsors not found", 404);
		}

		// Update display orders in transaction
		await prisma.$transaction(
			sponsors.map((sponsor) =>
				prisma.sponsor.update({
					where: { id: sponsor.id },
					data: { displayOrder: sponsor.displayOrder },
				})
			)
		);

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "sponsors_reorder",
				details: {
					reorderedSponsors: sponsors.length,
					sponsorIds: sponsors.map((s) => s.id),
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{ reorderedCount: sponsors.length },
			"Sponsors reordered successfully"
		);
	} catch (error) {
		console.error("Reorder sponsors error:", error);
		return errorResponse(res, "Failed to reorder sponsors", 500);
	}
};

// ============================================
// FILE UPLOAD CONTROLLERS
// ============================================

/**
 * Upload sponsor logo
 * POST /api/sponsors/:sponsorId/logo
 * Access: SUPER_ADMIN
 */
const uploadSponsorLogo = async (req, res) => {
	try {
		const { sponsorId } = req.params;
		const userId = req.user.id;
		const file = req.file;

		if (!file) {
			return errorResponse(res, "No logo file uploaded", 400);
		}

		// Generate URL for uploaded file
		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const logoUrl = `${baseUrl}${file.path.replace(process.cwd(), "").replace(/\\/g, "/")}`;

		// Get current sponsor to clean up old logo
		const currentSponsor = await prisma.sponsor.findUnique({
			where: { id: sponsorId },
			select: { logoUrl: true },
		});

		// Update sponsor with new logo URL
		const sponsor = await prisma.sponsor.update({
			where: { id: sponsorId },
			data: { logoUrl },
			select: {
				id: true,
				name: true,
				logoUrl: true,
			},
		});

		// Clean up old logo file
		if (currentSponsor?.logoUrl) {
			const oldLogoPath = currentSponsor.logoUrl.replace(
				`${req.protocol}://${req.get("host")}`,
				process.cwd()
			);
			deleteUploadedFile(oldLogoPath);
		}

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "sponsor_logo_upload",
				details: {
					sponsorId: sponsor.id,
					sponsorName: sponsor.name,
					logoUrl,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{
				sponsor: {
					id: sponsor.id,
					name: sponsor.name,
					logoUrl: sponsor.logoUrl,
				},
			},
			"Logo uploaded successfully"
		);
	} catch (error) {
		console.error("Upload sponsor logo error:", error);

		// Cleanup uploaded file on error
		if (req.file) {
			deleteUploadedFile(req.file.path);
		}

		return errorResponse(res, "Failed to upload logo", 500);
	}
};

/**
 * Upload sponsor head photo
 * POST /api/sponsors/:sponsorId/head-photo
 * Access: SUPER_ADMIN
 */
const uploadSponsorHeadPhoto = async (req, res) => {
	try {
		const { sponsorId } = req.params;
		const userId = req.user.id;
		const file = req.file;

		if (!file) {
			return errorResponse(res, "No head photo file uploaded", 400);
		}

		// Generate URL for uploaded file
		const baseUrl = `${req.protocol}://${req.get("host")}`;
		const headPhotoUrl = `${baseUrl}${file.path.replace(process.cwd(), "").replace(/\\/g, "/")}`;

		// Get current sponsor to clean up old head photo
		const currentSponsor = await prisma.sponsor.findUnique({
			where: { id: sponsorId },
			select: { headPhotoUrl: true },
		});

		// Update sponsor with new head photo URL
		const sponsor = await prisma.sponsor.update({
			where: { id: sponsorId },
			data: { headPhotoUrl },
			select: {
				id: true,
				name: true,
				headPhotoUrl: true,
			},
		});

		// Clean up old head photo file
		if (currentSponsor?.headPhotoUrl) {
			const oldHeadPhotoPath = currentSponsor.headPhotoUrl.replace(
				`${req.protocol}://${req.get("host")}`,
				process.cwd()
			);
			deleteUploadedFile(oldHeadPhotoPath);
		}

		// Log activity
		await prisma.activityLog.create({
			data: {
				userId,
				action: "sponsor_head_photo_upload",
				details: {
					sponsorId: sponsor.id,
					sponsorName: sponsor.name,
					headPhotoUrl,
				},
				ipAddress: req.ip,
				userAgent: req.get("User-Agent"),
			},
		});

		return successResponse(
			res,
			{
				sponsor: {
					id: sponsor.id,
					name: sponsor.name,
					headPhotoUrl: sponsor.headPhotoUrl,
				},
			},
			"Head photo uploaded successfully"
		);
	} catch (error) {
		console.error("Upload sponsor head photo error:", error);

		// Cleanup uploaded file on error
		if (req.file) {
			deleteUploadedFile(req.file.path);
		}

		return errorResponse(res, "Failed to upload head photo", 500);
	}
};

// ============================================
// PUBLIC/STATISTICS CONTROLLERS
// ============================================

/**
 * Get sponsor statistics
 * GET /api/sponsors/statistics
 * Access: SUPER_ADMIN
 */
const getSponsorStatistics = async (req, res) => {
	try {
		const [
			totalSponsors,
			activeSponsors,
			sponsorsByCategory,
			sponsorsWithLogos,
			sponsorsWithHeadPhotos,
		] = await Promise.all([
			prisma.sponsor.count(),
			prisma.sponsor.count({ where: { isActive: true } }),
			prisma.sponsor.groupBy({
				by: ["category"],
				_count: { id: true },
				where: { isActive: true },
			}),
			prisma.sponsor.count({ where: { logoUrl: { not: null } } }),
			prisma.sponsor.count({ where: { headPhotoUrl: { not: null } } }),
		]);

		const responseData = {
			sponsors: {
				total: totalSponsors,
				active: activeSponsors,
				inactive: totalSponsors - activeSponsors,
				withLogos: sponsorsWithLogos,
				withHeadPhotos: sponsorsWithHeadPhotos,
				byCategory: sponsorsByCategory.reduce((acc, item) => {
					acc[item.category] = item._count.id;
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
			"Sponsor statistics retrieved successfully"
		);
	} catch (error) {
		console.error("Get sponsor statistics error:", error);
		return errorResponse(res, "Failed to retrieve sponsor statistics", 500);
	}
};

/**
 * Get public sponsors (for website display)
 * GET /api/sponsors/public
 * Access: Public
 */
const getPublicSponsors = async (req, res) => {
	try {
		const { category } = req.query;

		const where = { isActive: true };
		if (category) {
			where.category = category;
		}

		const sponsors = await prisma.sponsor.findMany({
			where,
			select: {
				id: true,
				name: true,
				category: true,
				description: true,
				logoUrl: true,
				headPhotoUrl: true,
				website: true,
				displayOrder: true,
				// Note: Not including contactEmail for privacy
			},
			orderBy: [
				{ category: "asc" }, // GOLD, SILVER, BRONZE order
				{ displayOrder: "asc" },
			],
		});

		const responseData = {
			sponsors,
			categories: ["GOLD", "SILVER", "BRONZE"],
			generatedAt: new Date().toISOString(),
		};

		// Cache the result
		if (req.cacheKey && req.cacheTTL) {
			await CacheService.set(req.cacheKey, responseData, req.cacheTTL);
		}

		return successResponse(
			res,
			responseData,
			"Public sponsors retrieved successfully"
		);
	} catch (error) {
		console.error("Get public sponsors error:", error);
		return errorResponse(res, "Failed to retrieve public sponsors", 500);
	}
};

/**
 * Get sponsors grouped by category
 * GET /api/sponsors/by-category
 * Access: Public
 */
const getSponsorsByCategory = async (req, res) => {
	try {
		const sponsors = await prisma.sponsor.findMany({
			where: { isActive: true },
			select: {
				id: true,
				name: true,
				category: true,
				description: true,
				logoUrl: true,
				headPhotoUrl: true,
				website: true,
				displayOrder: true,
			},
			orderBy: [{ displayOrder: "asc" }],
		});

		// Group sponsors by category
		const sponsorsByCategory = {
			GOLD: sponsors.filter((s) => s.category === "GOLD"),
			SILVER: sponsors.filter((s) => s.category === "SILVER"),
			BRONZE: sponsors.filter((s) => s.category === "BRONZE"),
		};

		const responseData = {
			sponsorsByCategory,
			totalCount: sponsors.length,
			categoryCounts: {
				GOLD: sponsorsByCategory.GOLD.length,
				SILVER: sponsorsByCategory.SILVER.length,
				BRONZE: sponsorsByCategory.BRONZE.length,
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
			"Sponsors by category retrieved successfully"
		);
	} catch (error) {
		console.error("Get sponsors by category error:", error);
		return errorResponse(res, "Failed to retrieve sponsors by category", 500);
	}
};

// ============================================
// EXPORTED CONTROLLERS
// ============================================

module.exports = {
	// Sponsor management
	getSponsors,
	getSponsor,
	createSponsor,
	updateSponsor,
	deleteSponsor,
	reorderSponsors,

	// File uploads
	uploadSponsorLogo,
	uploadSponsorHeadPhoto,

	// Statistics and public
	getSponsorStatistics,
	getPublicSponsors,
	getSponsorsByCategory,
};
