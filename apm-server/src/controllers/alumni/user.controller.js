// src/controllers/user.controller.js - Enhanced with Profile Edit Validation Integration
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { cloudflareR2Service } = require('../../services/cloudflare-r2.service');
const { invalidateAllCelebrationCaches } = require('../../middleware/cache/celebration.cache.middleware');
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
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				serialId: true,
				fullName: true,
				email: true,
				whatsappNumber: true,
				alternateNumber: true,
				batch: true,
				admissionYear: true,
				passoutYear: true,
				dateOfBirth: true,
				isAlumniVerified: true,
				pendingVerification: true,
				isRejected: true,
				rejectionReason: true,
				rejectedAt: true,
				profileImage: true,
				bio: true,
				employmentStatus: true,
				linkedinUrl: true,
				instagramUrl: true,
				facebookUrl: true,
				twitterUrl: true,
				youtubeUrl: true,
				portfolioUrl: true,
				isProfilePublic: true,
				showEmail: true,
				showPhone: true,
				role: true,
				isActive: true,
				membershipStatus: true,
				membershipExpiresAt: true,
				currentMembershipYear: true,
				membershipPaidAt: true,
				membershipAmountPaid: true,
				bloodGroup: true,
				isBloodDonor: true,
				lastBloodDonationDate: true,
				totalBloodDonations: true,
				lastLoginAt: true,
				createdAt: true,
				updatedAt: true,
				// Include addresses
				addresses: {
					select: {
						id: true,
						addressType: true,
						addressLine1: true,
						addressLine2: true,
						city: true,
						state: true,
						postalCode: true,
						country: true,
						createdAt: true,
						updatedAt: true,
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

		// Check if user email is blacklisted
		const blacklistEntry = await prisma.blacklistedEmail.findFirst({
			where: { 
				email: user.email.toLowerCase(),
				isActive: true 
			},
			select: {
				id: true,
				reason: true,
				blacklistedAt: true,
				blacklistedAdmin: {
					select: { fullName: true }
				}
			}
		});

		// Transform addresses to the requested format
		const transformedAddresses = [];
		const permanentAddr = user.addresses?.find(addr => addr.addressType === 'PERMANENT');
		const currentAddr = user.addresses?.find(addr => addr.addressType === 'CURRENT');

		if (permanentAddr || currentAddr) {
			const addressObj = {};
			
			if (permanentAddr) {
				addressObj.permanent = {
					address: permanentAddr.addressLine1 + (permanentAddr.addressLine2 ? ', ' + permanentAddr.addressLine2 : ''),
					city: permanentAddr.city,
					dist: permanentAddr.city, // Using city as district for now
					state: permanentAddr.state,
					pincode: parseInt(permanentAddr.postalCode) || permanentAddr.postalCode
				};
			}

			if (currentAddr) {
				addressObj.current = {
					address: currentAddr.addressLine1 + (currentAddr.addressLine2 ? ', ' + currentAddr.addressLine2 : ''),
					city: currentAddr.city,
					dist: currentAddr.city, // Using city as district for now
					state: currentAddr.state,
					pincode: parseInt(currentAddr.postalCode) || currentAddr.postalCode
				};
			}

			transformedAddresses.push(addressObj);
		}

		// Add verification context from optional middleware
		const verificationContext = {
			isVerified: user.isAlumniVerified,
			isPending: user.pendingVerification,
			canEditBatch:
				!blacklistEntry && // Cannot edit batch if blacklisted
				(!user.isAlumniVerified ||
				req.user.role === "SUPER_ADMIN" ||
				req.user.role === "BATCH_ADMIN"),
			rejectionReason: user.rejectionReason || null,
			isBlacklisted: !!blacklistEntry,
			blacklistInfo: blacklistEntry ? {
				reason: blacklistEntry.reason,
				blacklistedAt: blacklistEntry.blacklistedAt,
				blacklistedBy: blacklistEntry.blacklistedAdmin?.fullName
			} : null
		};

		res.json({
			success: true,
			data: {
				...user,
				address: transformedAddresses, // Use the new address format
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
			const currentUser = await tx.user.findUnique({
				where: { id: userId },
			});

			if (!currentUser) {
				throw new Error("User not found");
			}

			// Prepare update data
			const updateData = { ...updates };
			
			// Remove non-database fields
			delete updateData.resetVerificationStatus;

			// ==========================================
			// VALIDATE AND CLEAN DATA
			// ==========================================
			
			console.log("🔍 Raw updateData received:", JSON.stringify(updateData, null, 2));
			
			// Handle dateOfBirth - convert empty strings to null for Prisma
			if (updateData.dateOfBirth === "") {
				console.log("🔧 Converting empty dateOfBirth string to null");
				updateData.dateOfBirth = null;
			}
			
			// Convert dateOfBirth to ISO string if it's a valid date
			if (updateData.dateOfBirth && updateData.dateOfBirth !== null) {
				try {
					// If it's already an ISO string, validate it
					const date = new Date(updateData.dateOfBirth);
					if (isNaN(date.getTime())) {
						throw new Error("Invalid date format");
					}
					// Ensure it's in ISO format for Prisma
					updateData.dateOfBirth = date.toISOString();
				} catch (error) {
					console.error("Invalid dateOfBirth format:", updateData.dateOfBirth);
					delete updateData.dateOfBirth; // Remove invalid date from update
				}
			}

			// ==========================================
			// HANDLE BATCH CORRECTION LOGIC
			// ==========================================
			
			// Handle rejected user batch change and verification reset
			if (updates.resetVerificationStatus && currentUser.isRejected) {
				console.log("Resetting verification status for rejected user");
				updateData.pendingVerification = true;
				updateData.isRejected = false;
				updateData.rejectionReason = null;
				updateData.rejectedAt = null;
				updateData.rejectedBy = null;
				
				// Log the reset activity
				await tx.activityLog.create({
					data: {
						userId: userId,
						action: "VERIFICATION_STATUS_RESET",
						details: {
							oldBatch: currentUser.batch,
							newBatch: updates.batch,
							reason: "User requested batch change and verification reset",
							timestamp: new Date(),
						},
					},
				});
			}

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
						updateData.isRejected = false;
						updateData.rejectionReason = null;

						console.log(
							"Verified user batch change - resetting verification status"
						);
					}

					// Log batch correction activity
					await tx.activityLog.create({
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

					await tx.activityLog.create({
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
				await tx.activityLog.create({
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

			const updatedUser = await tx.user.update({
				where: { id: userId },
				data: updateData,
				select: {
					id: true,
					serialId: true,
					fullName: true,
					email: true,
					whatsappNumber: true,
					alternateNumber: true,
					batch: true,
					isAlumniVerified: true,
					pendingVerification: true,
					rejectionReason: true,
					profileImage: true,
					bio: true,
					linkedinUrl: true,
					instagramUrl: true,
					facebookUrl: true,
					twitterUrl: true,
					youtubeUrl: true,
					portfolioUrl: true,
					showEmail: true,
					showPhone: true,
					role: true,
					updatedAt: true,
				},
			});

			return updatedUser;
		});

		// ==========================================
		// HANDLE CACHE INVALIDATION
		// ==========================================
		
		// If dateOfBirth was updated, clear celebration caches
		if (updates.dateOfBirth !== undefined) {
			try {
				await invalidateAllCelebrationCaches();
				console.log('✅ Celebration caches invalidated after dateOfBirth update');
			} catch (error) {
				console.error('❌ Failed to invalidate celebration caches:', error);
			}
		}

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

		const user = await prisma.user.findUnique({
			where: {
				id: userId,
				isActive: true,
			},
			select: {
				id: true,
				serialId: true,
				fullName: true,
				batch: true,
				profileImage: true,
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

		const user = await prisma.user.findUnique({
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

		const addresses = await prisma.userAddress.findMany({
			where: { userId: userId },
			orderBy: [{ createdAt: "asc" }],
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

		const address = await prisma.userAddress.upsert({
			where: {
				userId_addressType: {
					userId: userId,
					addressType: addressType.toUpperCase(),
				},
			},
			update: addressData,
			create: {
				userId: userId,
				addressType: addressType.toUpperCase(),
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
		const file = req.file;
		
		console.log('🔍 Profile picture POST request:');
		console.log('Content-Type:', req.get('Content-Type'));
		console.log('req.file:', req.file);
		console.log('req.body:', req.body);
		console.log('User ID:', userId);

		if (!file) {
			return res.status(400).json({
				success: false,
				message: "No image file provided",
			});
		}

		// Check if Cloudflare R2 is configured
		if (!cloudflareR2Service.isConfigured()) {
			return res.status(500).json({
				success: false,
				message: 'File storage (Cloudflare R2) is not configured. Please contact administrator.',
			});
		}

		// Validate profile picture file
		const validation = cloudflareR2Service.validateProfilePicture(file);
		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: `Profile picture validation failed: ${validation.errors.join(', ')}`,
			});
		}

		// Upload to R2
		const uploadResult = await cloudflareR2Service.uploadProfilePicture(file);

		// Update user profile picture URL in database
		await prisma.user.update({
			where: { id: userId },
			data: { profileImage: uploadResult.url },
		});

		console.log('✅ Profile picture uploaded to R2:', uploadResult.url);

		res.json({
			success: true,
			message: "Profile picture uploaded successfully",
			data: {
				imageUrl: uploadResult.url,
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
		const file = req.file;
		
		console.log('🔍 Profile picture PUT request:');
		console.log('Content-Type:', req.get('Content-Type'));
		console.log('req.file:', req.file);
		console.log('req.body:', req.body);
		console.log('User ID:', userId);

		if (!file) {
			return res.status(400).json({
				success: false,
				message: "No image file provided",
			});
		}

		// Check if Cloudflare R2 is configured
		if (!cloudflareR2Service.isConfigured()) {
			return res.status(500).json({
				success: false,
				message: 'File storage (Cloudflare R2) is not configured. Please contact administrator.',
			});
		}

		// Validate profile picture file
		const validation = cloudflareR2Service.validateProfilePicture(file);
		if (!validation.isValid) {
			return res.status(400).json({
				success: false,
				message: `Profile picture validation failed: ${validation.errors.join(', ')}`,
			});
		}

		// Get existing user to delete old profile picture from R2
		const existingUser = await prisma.user.findUnique({
			where: { id: userId },
			select: { profileImage: true }
		});

		// Upload new profile picture to R2
		const uploadResult = await cloudflareR2Service.uploadProfilePicture(file);

		// Update user profile picture URL in database
		await prisma.user.update({
			where: { id: userId },
			data: { profileImage: uploadResult.url },
		});

		// Delete old profile picture from R2 if exists
		if (existingUser?.profileImage) {
			try {
				const oldKey = cloudflareR2Service.extractKeyFromUrl(existingUser.profileImage);
				if (oldKey) {
					await cloudflareR2Service.deleteFile(oldKey);
				}
			} catch (cleanupError) {
				console.warn('Failed to cleanup old profile picture:', cleanupError);
			}
		}

		console.log('✅ Profile picture uploaded to R2:', uploadResult.url);

		res.json({
			success: true,
			message: "Profile picture updated successfully",
			data: {
				imageUrl: uploadResult.url,
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

		// First, get the current user to retrieve the profile image URL
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { profileImage: true }
		});

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		// If user has a profile image, delete it from R2 storage
		if (user.profileImage) {
			try {
				console.log('🗑️ Deleting profile picture from R2:', user.profileImage);
				await cloudflareR2Service.deleteFileByUrl(user.profileImage);
				console.log('✅ Profile picture deleted from R2 successfully');
			} catch (r2Error) {
				console.error('⚠️ Failed to delete from R2 (continuing with DB update):', r2Error.message);
				// Continue with database update even if R2 deletion fails
				// This prevents orphaned database records
			}
		}

		// Update database to remove profile image reference
		await prisma.user.update({
			where: { id: userId },
			data: { profileImage: null },
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

		const educations = await prisma.userEducation.findMany({
			where: { userId: userId },
			orderBy: { fromYear: "desc" },
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

		const education = await prisma.userEducation.create({
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

		const education = await prisma.userEducation.updateMany({
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

		const education = await prisma.userEducation.deleteMany({
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

		const workExperiences = await prisma.userWorkExperience.findMany({
			where: { userId: userId },
			orderBy: [{ isCurrentJob: "desc" }, { fromYear: "desc" }],
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

		const workExperience = await prisma.userWorkExperience.create({
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

		const workExperience = await prisma.userWorkExperience.updateMany({
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

		const workExperience = await prisma.userWorkExperience.deleteMany({
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
// USER SEARCH FOR MENTIONS
// ==========================================

/**
 * Search users for mentions - @username functionality
 */
const searchUsersForMentions = async (req, res) => {
	try {
		const { query } = req.query;
		
		if (!query || query.length < 2) {
			return res.json({
				success: true,
				data: [],
				message: "Query too short. Minimum 2 characters required."
			});
		}

		// Search users by fullName, allowing only verified and active users
		const users = await prisma.user.findMany({
			where: {
				AND: [
					{
						fullName: {
							contains: query,
							mode: 'insensitive'
						}
					},
					{
						isActive: true
					},
					{
						isAlumniVerified: true
					},
					{
						isProfilePublic: true
					}
				]
			},
			select: {
				id: true,
				fullName: true,
				batch: true,
				profileImage: true,
				serialId: true
			},
			orderBy: [
				{
					fullName: 'asc'
				}
			],
			take: 10 // Limit to 10 results
		});

		res.json({
			success: true,
			data: users,
			total: users.length
		});
	} catch (error) {
		console.error("Search users for mentions error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to search users",
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

		const activities = await prisma.activityLog.findMany({
			where: { userId: userId },
			orderBy: { createdAt: "desc" },
			take: parseInt(limit),
			skip: (parseInt(page) - 1) * parseInt(limit),
		});

		const total = await prisma.activityLog.count({
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

// ==========================================
// EVENT REGISTRATIONS - VERIFIED USERS ONLY
// ==========================================

const getMyEventRegistrations = async (req, res) => {
	try {
		const userId = req.user.id;
		const { page = 1, limit = 20, status, upcoming } = req.query;
		
		let whereConditions = {
			userId: userId,
			status: {
				in: ["CONFIRMED", "WAITLIST"] // Show confirmed and waitlist registrations
			}
		};

		// Filter by payment status if provided
		if (status) {
			whereConditions.paymentStatus = status;
		}

		// Filter by upcoming/past events
		if (upcoming !== undefined) {
			const now = new Date();
			if (upcoming === 'true') {
				whereConditions.event = {
					eventDate: { gte: now }
				};
			} else if (upcoming === 'false') {
				whereConditions.event = {
					eventDate: { lt: now }
				};
			}
		}

		const registrations = await prisma.eventRegistration.findMany({
			where: whereConditions,
			include: {
				event: {
					select: {
						id: true,
						title: true,
						description: true,
						eventDate: true,
						startTime: true,
						endTime: true,
						venue: true,
						meetingLink: true,
						eventMode: true,
						status: true,
						registrationFee: true,
						guestFee: true,
						heroImage: true,
						category: {
							select: {
								name: true
							}
						}
					}
				},
				guests: {
					where: { status: "ACTIVE" },
					select: {
						id: true,
						name: true,
						email: true,
						phone: true,
						mealPreference: true
					}
				},
				qr: {
					select: {
						id: true,
						qrCode: true,
						qrImageUrl: true,
						generatedAt: true,
						scanCount: true,
						isActive: true
					}
				},
				paymentTransaction: {
					select: {
						id: true,
						provider: true,
						status: true,
						amount: true,
						razorpayOrderId: true,
						createdAt: true
					}
				}
			},
			orderBy: { createdAt: "desc" },
			take: parseInt(limit),
			skip: (parseInt(page) - 1) * parseInt(limit),
		});

		const total = await prisma.eventRegistration.count({
			where: whereConditions,
		});

		// Format the response to include useful computed fields
		const formattedRegistrations = registrations.map(registration => ({
			...registration,
			hasQRCode: !!registration.qr,
			isUpcoming: new Date(registration.event.eventDate) >= new Date(),
			totalGuests: registration.guests?.length || 0,
		}));

		const responseData = {
			success: true,
			data: formattedRegistrations,
			pagination: {
				page: parseInt(page),
				limit: parseInt(limit),
				total,
				pages: Math.ceil(total / parseInt(limit)),
			},
		};

		res.json(responseData);
	} catch (error) {
		console.error("Get my event registrations error:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch event registrations",
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

	// User search for mentions
	searchUsersForMentions,

	// Premium features
	getUserSettings,
	updateUserSettings,
	getUserActivity,

	// Event registrations
	getMyEventRegistrations,
};
