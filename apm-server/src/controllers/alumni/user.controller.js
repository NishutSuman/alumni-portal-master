// src/controllers/user.controller.js - Enhanced with Profile Edit Validation Integration
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

// ==========================================
// PROFILE MANAGEMENT CONTROLLERS
// ==========================================

/**
 * Get current user profile - Enhanced for verification status
 */
const getProfile = async (req, res) => {
	try {
		const userId = req.user.id;

		// Get user with comprehensive data
		const user = await prisma.users.findUnique({
			where: { id: userId },
			select: {
				id: true,
				serialId: true,
				fullName: true,
				email: true,
				phone: true,
				batch: true,
				isAlumniVerified: true,
				pendingVerification: true,
				verificationRejectedReason: true,
				profilePicture: true,
				bio: true,
				linkedinUrl: true,
				instagramUrl: true,
				facebookUrl: true,
				twitterUrl: true,
				youtubeUrl: true,
				portfolioUrl: true,
				role: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
				// Include addresses
				addresses: {
					select: {
						id: true,
						type: true,
						street: true,
						city: true,
						state: true,
						zipCode: true,
						country: true,
						isPrimary: true,
					},
				},
				// Include membership status
				membershipStatus: true,
				membershipExpiresAt: true,
				currentMembershipYear: true,
			},
		});

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User profile not found",
			});
		}

		// Add verification context from optional middleware
		const verificationContext = {
			isVerified: user.isAlumniVerified,
			isPending: user.pendingVerification,
			canEditBatch:
				!user.isAlumniVerified ||
				req.user.role === "SUPER_ADMIN" ||
				req.user.role === "BATCH_ADMIN",
			rejectionReason: user.verificationRejectedReason || null,
		};

		res.json({
			success: true,
			data: {
				...user,
				verificationContext,
			},
		});
	} catch (error) {
		console.error("Get profile error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch user profile",
		});
	}
};

/**
 * Update user profile - Enhanced with batch correction logic
 */
const updateProfile = async (req, res) => {
	try {
		const userId = req.user.id;
		const updates = req.body;

		// Get validation context from middleware
		const profileEditContext = req.profileEditContext || {};

		console.log("Profile update context:", profileEditContext);

		// Start transaction for atomic updates
		const result = await prisma.$transaction(async (tx) => {
			// Get current user data
			const currentUser = await tx.users.findUnique({
				where: { id: userId },
			});

			if (!currentUser) {
				throw new Error("User not found");
			}

			// Prepare update data
			const updateData = { ...updates };

			// ==========================================
			// HANDLE BATCH CORRECTION LOGIC
			// ==========================================

			if (profileEditContext.hasBatchChange) {
				console.log(
					"Processing batch change:",
					profileEditContext.batchCorrection
				);

				// For unverified users changing batch
				if (profileEditContext.batchCorrection) {
					updateData.batch = profileEditContext.batchCorrection.newBatch;

					// Reset verification status if changing batch
					if (currentUser.isAlumniVerified) {
						updateData.isAlumniVerified = false;
						updateData.pendingVerification = true;
						updateData.verificationRejectedReason = null;

						console.log(
							"Verified user batch change - resetting verification status"
						);
					}

					// Log batch correction activity
					await tx.userActivity.create({
						data: {
							userId: userId,
							action: "BATCH_CORRECTED",
							details: {
								oldBatch: currentUser.batch,
								newBatch: profileEditContext.batchCorrection.newBatch,
								reason:
									profileEditContext.batchCorrection.reason ||
									"User correction",
								timestamp: new Date(),
							},
						},
					});
				}

				// For admin batch changes
				if (profileEditContext.adminBatchChange) {
					updateData.batch = profileEditContext.adminBatchChange.newBatch;

					await tx.userActivity.create({
						data: {
							userId: userId,
							action: "ADMIN_BATCH_CHANGE",
							details: {
								oldBatch: currentUser.batch,
								newBatch: profileEditContext.adminBatchChange.newBatch,
								adminId: req.user.id,
								adminName: req.user.fullName,
								timestamp: new Date(),
							},
						},
					});
				}
			}

			// ==========================================
			// HANDLE SENSITIVE FIELD UPDATES
			// ==========================================

			if (profileEditContext.sensitiveFieldUpdate) {
				console.log(
					"Sensitive fields being updated:",
					profileEditContext.sensitiveFieldUpdate.fields
				);

				// Log sensitive field changes
				await tx.userActivity.create({
					data: {
						userId: userId,
						action: "SENSITIVE_PROFILE_UPDATE",
						details: {
							fields: profileEditContext.sensitiveFieldUpdate.fields,
							warning: profileEditContext.sensitiveFieldUpdate.warning,
							timestamp: new Date(),
						},
					},
				});
			}

			// ==========================================
			// PERFORM THE UPDATE
			// ==========================================

			const updatedUser = await tx.users.update({
				where: { id: userId },
				data: updateData,
				select: {
					id: true,
					serialId: true,
					fullName: true,
					email: true,
					phone: true,
					batch: true,
					isAlumniVerified: true,
					pendingVerification: true,
					verificationRejectedReason: true,
					profilePicture: true,
					bio: true,
					linkedinUrl: true,
					instagramUrl: true,
					facebookUrl: true,
					twitterUrl: true,
					youtubeUrl: true,
					portfolioUrl: true,
					role: true,
					updatedAt: true,
				},
			});

			return updatedUser;
		});

		// ==========================================
		// PREPARE RESPONSE WITH CONTEXT
		// ==========================================

		const response = {
			success: true,
			message: "Profile updated successfully",
			data: result,
		};

		// Add batch correction feedback
		if (profileEditContext.hasBatchChange) {
			response.batchCorrection = {
				applied: true,
				message: profileEditContext.batchCorrection
					? "Batch corrected successfully. Verification status may be affected."
					: "Batch updated by admin successfully.",
			};
		}

		// Add sensitive field update warning
		if (profileEditContext.sensitiveFieldUpdate) {
			response.warning = {
				message: profileEditContext.sensitiveFieldUpdate.warning,
				fields: profileEditContext.sensitiveFieldUpdate.fields,
			};
		}

		// Add verification status update info
		if (result.pendingVerification && !result.isAlumniVerified) {
			response.verificationUpdate = {
				status: "pending",
				message: "Your profile changes may require re-verification",
			};
		}

		res.json(response);
	} catch (error) {
		console.error("Update profile error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update profile",
			error:
				process.env.NODE_ENV === "development"
					? error.message
					: "Internal server error",
		});
	}
};

/**
 * Get public user profile
 */
const getPublicProfile = async (req, res) => {
	try {
		const { userId } = req.params;

		const user = await prisma.users.findUnique({
			where: {
				id: userId,
				isActive: true,
			},
			select: {
				id: true,
				serialId: true,
				fullName: true,
				batch: true,
				profilePicture: true,
				bio: true,
				linkedinUrl: true,
				instagramUrl: true,
				facebookUrl: true,
				twitterUrl: true,
				youtubeUrl: true,
				portfolioUrl: true,
				isAlumniVerified: true,
				// Only show education/work for verified users
				educations: {
					where: { isVisible: true },
					select: {
						id: true,
						institution: true,
						degree: true,
						fieldOfStudy: true,
						startYear: true,
						endYear: true,
						description: true,
					},
				},
				workExperiences: {
					where: { isVisible: true },
					select: {
						id: true,
						company: true,
						position: true,
						startDate: true,
						endDate: true,
						description: true,
						isCurrentJob: true,
					},
				},
			},
		});

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User profile not found",
			});
		}

		// Filter data based on verification status
		if (!user.isAlumniVerified) {
			delete user.educations;
			delete user.workExperiences;
		}

		res.json({
			success: true,
			data: user,
		});
	} catch (error) {
		console.error("Get public profile error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch public profile",
		});
	}
};

/**
 * Get membership status - Allow unverified users
 */
const getMembershipStatus = async (req, res) => {
	try {
		const userId = req.user.id;

		const user = await prisma.users.findUnique({
			where: { id: userId },
			select: {
				id: true,
				batch: true,
				membershipStatus: true,
				membershipExpiresAt: true,
				currentMembershipYear: true,
				membershipPaidAt: true,
				membershipAmountPaid: true,
				isAlumniVerified: true,
				pendingVerification: true,
			},
		});

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		// Get applicable membership fee (even for unverified users)
		let applicableFee = null;
		try {
			// Try to get batch-specific fee
			const batchFee = await prisma.batchMembershipSettings.findFirst({
				where: {
					batchYear: user.batch,
					isActive: true,
				},
			});

			if (batchFee) {
				applicableFee = batchFee.membershipFee;
			} else {
				// Fallback to global fee
				const globalFee = await prisma.globalMembershipSettings.findFirst({
					where: { isActive: true },
				});

				if (globalFee) {
					applicableFee = globalFee.membershipFee;
				}
			}
		} catch (feeError) {
			console.log("Could not fetch membership fee:", feeError);
		}

		const response = {
			success: true,
			data: {
				userId: user.id,
				batch: user.batch,
				membershipStatus: user.membershipStatus || "INACTIVE",
				membershipExpiresAt: user.membershipExpiresAt,
				currentMembershipYear: user.currentMembershipYear,
				lastPayment: user.membershipPaidAt
					? {
							date: user.membershipPaidAt,
							amount: user.membershipAmountPaid,
						}
					: null,
				applicableFee: applicableFee,
				verificationStatus: {
					isVerified: user.isAlumniVerified,
					isPending: user.pendingVerification,
					canPay: user.isAlumniVerified, // Only verified users can pay
				},
			},
		};

		res.json(response);
	} catch (error) {
		console.error("Get membership status error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch membership status",
		});
	}
};

// ==========================================
// ADDRESS MANAGEMENT CONTROLLERS
// ==========================================

const getAddresses = async (req, res) => {
	try {
		const userId = req.user.id;

		const addresses = await prisma.userAddresses.findMany({
			where: { userId: userId },
			orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
		});

		res.json({
			success: true,
			data: addresses,
		});
	} catch (error) {
		console.error("Get addresses error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch addresses",
		});
	}
};

const updateAddress = async (req, res) => {
	try {
		const userId = req.user.id;
		const { addressType } = req.params;
		const addressData = req.body;

		const address = await prisma.userAddresses.upsert({
			where: {
				userId_type: {
					userId: userId,
					type: addressType.toUpperCase(),
				},
			},
			update: addressData,
			create: {
				userId: userId,
				type: addressType.toUpperCase(),
				...addressData,
			},
		});

		res.json({
			success: true,
			message: `${addressType} address updated successfully`,
			data: address,
		});
	} catch (error) {
		console.error("Update address error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update address",
		});
	}
};

// ==========================================
// PROFILE PICTURE MANAGEMENT
// ==========================================

const uploadProfilePicture = async (req, res) => {
	try {
		const userId = req.user.id;

		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "No image file provided",
			});
		}

		const profilePicturePath = `/uploads/profile-pictures/${req.file.filename}`;

		await prisma.users.update({
			where: { id: userId },
			data: { profilePicture: profilePicturePath },
		});

		res.json({
			success: true,
			message: "Profile picture uploaded successfully",
			data: {
				profilePicture: profilePicturePath,
			},
		});
	} catch (error) {
		console.error("Upload profile picture error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to upload profile picture",
		});
	}
};

const updateProfilePicture = async (req, res) => {
	try {
		const userId = req.user.id;

		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "No image file provided",
			});
		}

		const profilePicturePath = `/uploads/profile-pictures/${req.file.filename}`;

		await prisma.users.update({
			where: { id: userId },
			data: { profilePicture: profilePicturePath },
		});

		res.json({
			success: true,
			message: "Profile picture updated successfully",
			data: {
				profilePicture: profilePicturePath,
			},
		});
	} catch (error) {
		console.error("Update profile picture error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update profile picture",
		});
	}
};

const deleteProfilePicture = async (req, res) => {
	try {
		const userId = req.user.id;

		await prisma.users.update({
			where: { id: userId },
			data: { profilePicture: null },
		});

		res.json({
			success: true,
			message: "Profile picture deleted successfully",
		});
	} catch (error) {
		console.error("Delete profile picture error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to delete profile picture",
		});
	}
};

// ==========================================
// EDUCATION MANAGEMENT
// ==========================================

const getEducationHistory = async (req, res) => {
	try {
		const userId = req.user.id;

		const educations = await prisma.userEducations.findMany({
			where: { userId: userId },
			orderBy: { startYear: "desc" },
		});

		res.json({
			success: true,
			data: educations,
		});
	} catch (error) {
		console.error("Get education history error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch education history",
		});
	}
};

const addEducation = async (req, res) => {
	try {
		const userId = req.user.id;
		const educationData = req.body;

		const education = await prisma.userEducations.create({
			data: {
				userId: userId,
				...educationData,
			},
		});

		res.json({
			success: true,
			message: "Education added successfully",
			data: education,
		});
	} catch (error) {
		console.error("Add education error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to add education",
		});
	}
};

const updateEducation = async (req, res) => {
	try {
		const userId = req.user.id;
		const { educationId } = req.params;
		const educationData = req.body;

		const education = await prisma.userEducations.updateMany({
			where: {
				id: educationId,
				userId: userId,
			},
			data: educationData,
		});

		if (education.count === 0) {
			return res.status(404).json({
				success: false,
				message: "Education record not found",
			});
		}

		res.json({
			success: true,
			message: "Education updated successfully",
		});
	} catch (error) {
		console.error("Update education error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update education",
		});
	}
};

const deleteEducation = async (req, res) => {
	try {
		const userId = req.user.id;
		const { educationId } = req.params;

		const education = await prisma.userEducations.deleteMany({
			where: {
				id: educationId,
				userId: userId,
			},
		});

		if (education.count === 0) {
			return res.status(404).json({
				success: false,
				message: "Education record not found",
			});
		}

		res.json({
			success: true,
			message: "Education deleted successfully",
		});
	} catch (error) {
		console.error("Delete education error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to delete education",
		});
	}
};

// ==========================================
// WORK EXPERIENCE MANAGEMENT
// ==========================================

const getWorkHistory = async (req, res) => {
	try {
		const userId = req.user.id;

		const workExperiences = await prisma.userWorkExperiences.findMany({
			where: { userId: userId },
			orderBy: [{ isCurrentJob: "desc" }, { startDate: "desc" }],
		});

		res.json({
			success: true,
			data: workExperiences,
		});
	} catch (error) {
		console.error("Get work history error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch work history",
		});
	}
};

const addWorkExperience = async (req, res) => {
	try {
		const userId = req.user.id;
		const workData = req.body;

		const workExperience = await prisma.userWorkExperiences.create({
			data: {
				userId: userId,
				...workData,
			},
		});

		res.json({
			success: true,
			message: "Work experience added successfully",
			data: workExperience,
		});
	} catch (error) {
		console.error("Add work experience error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to add work experience",
		});
	}
};

const updateWorkExperience = async (req, res) => {
	try {
		const userId = req.user.id;
		const { workId } = req.params;
		const workData = req.body;

		const workExperience = await prisma.userWorkExperiences.updateMany({
			where: {
				id: workId,
				userId: userId,
			},
			data: workData,
		});

		if (workExperience.count === 0) {
			return res.status(404).json({
				success: false,
				message: "Work experience not found",
			});
		}

		res.json({
			success: true,
			message: "Work experience updated successfully",
		});
	} catch (error) {
		console.error("Update work experience error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update work experience",
		});
	}
};

const deleteWorkExperience = async (req, res) => {
	try {
		const userId = req.user.id;
		const { workId } = req.params;

		const workExperience = await prisma.userWorkExperiences.deleteMany({
			where: {
				id: workId,
				userId: userId,
			},
		});

		if (workExperience.count === 0) {
			return res.status(404).json({
				success: false,
				message: "Work experience not found",
			});
		}

		res.json({
			success: true,
			message: "Work experience deleted successfully",
		});
	} catch (error) {
		console.error("Delete work experience error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to delete work experience",
		});
	}
};

// ==========================================
// PREMIUM FEATURES - VERIFIED USERS ONLY
// ==========================================

const getUserSettings = async (req, res) => {
	try {
		const userId = req.user.id;

		const settings = await prisma.userSettings.findUnique({
			where: { userId: userId },
		});

		res.json({
			success: true,
			data: settings || {},
		});
	} catch (error) {
		console.error("Get user settings error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch user settings",
		});
	}
};

const updateUserSettings = async (req, res) => {
	try {
		const userId = req.user.id;
		const settingsData = req.body;

		const settings = await prisma.userSettings.upsert({
			where: { userId: userId },
			update: settingsData,
			create: {
				userId: userId,
				...settingsData,
			},
		});

		res.json({
			success: true,
			message: "Settings updated successfully",
			data: settings,
		});
	} catch (error) {
		console.error("Update user settings error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to update settings",
		});
	}
};

const getUserActivity = async (req, res) => {
	try {
		const userId = req.user.id;
		const { page = 1, limit = 20 } = req.query;

		const activities = await prisma.userActivity.findMany({
			where: { userId: userId },
			orderBy: { createdAt: "desc" },
			take: parseInt(limit),
			skip: (parseInt(page) - 1) * parseInt(limit),
		});

		const total = await prisma.userActivity.count({
			where: { userId: userId },
		});

		res.json({
			success: true,
			data: activities,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / parseInt(limit)),
			},
		});
	} catch (error) {
		console.error("Get user activity error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch user activity",
		});
	}
};

module.exports = {
	// Profile management
	getProfile,
	updateProfile,
	getPublicProfile,
	getMembershipStatus,

	// Address management
	getAddresses,
	updateAddress,

	// Profile picture management
	uploadProfilePicture,
	updateProfilePicture,
	deleteProfilePicture,

	// Education management
	getEducationHistory,
	addEducation,
	updateEducation,
	deleteEducation,

	// Work experience management
	getWorkHistory,
	addWorkExperience,
	updateWorkExperience,
	deleteWorkExperience,

	// Premium features
	getUserSettings,
	updateUserSettings,
	getUserActivity,
};
