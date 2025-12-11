// src/routes/posts.route.js - COMPLETE VERSION
const express = require("express");
const router = express.Router();
const {
	authenticateToken,
	requireRole,
	optionalAuth,
} = require("../middleware/auth/auth.middleware");
const { asyncHandler } = require("../utils/response");
const { handleUploadError } = require("../middleware/upload.middleware");
const {
	requireAlumniVerification,
} = require("../middleware/auth/alumniVerification.middleware");

const {
	validateCreatePost,
	validateUpdatePost,
	validateApprovePost,
	validatePostIdParam,
	validateCreateComment,
	validateUpdateComment,
	validateCommentIdParam,
	validatePostAndCommentParams,
} = require("../middleware/validation/validation.middleware");
const {
	cachePosts,
	cachePost,
	invalidatePostCache,
	invalidatePostInteractionCache,
} = require("../middleware/cache/cache.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Import controllers
const postController = require("../controllers/post/post.controller");
const likeController = require("../controllers/post/like.controller");
const commentController = require("../controllers/post/comment.controller");
const commentLikeController = require("../controllers/post/commentLike.controller");

// Configure multer for post uploads (images and documents) - using memory storage for R2
const postUploadStorage = multer.memoryStorage();

const postFileFilter = (req, file, cb) => {
	// Allowed file types for posts
	const imageTypes = [
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/gif",
		"image/webp",
	];
	const documentTypes = [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	];

	const allowedTypes = [...imageTypes, ...documentTypes];

	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				"Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX, XLS, XLSX"
			),
			false
		);
	}
};

const uploadPostFiles = multer({
	storage: postUploadStorage,
	fileFilter: postFileFilter,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB per file
		files: 10, // Maximum 10 files total
	},
}).fields([
	{ name: "heroImage", maxCount: 1 },
	{ name: "images", maxCount: 9 }, // 9 additional images + 1 hero = 10 total
]);

// ==========================================
// POST MANAGEMENT ROUTES
// ==========================================

// Super Admin only routes (MUST come before parameterized routes)
router.get(
	"/admin/pending",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	asyncHandler(postController.getPendingPosts)
);

// Public routes (no auth required, but can be enhanced with optional auth)
router.get(
	"/",
	optionalAuth,
	cachePosts,
	asyncHandler(postController.getPosts)
);
router.get(
	"/:postId",
	optionalAuth,
	validatePostIdParam,
	cachePost,
	asyncHandler(postController.getPostById)
);

// Protected routes (authentication required)
router.post(
	"/",
	authenticateToken,
	requireAlumniVerification,
	uploadPostFiles,
	handleUploadError,
	validateCreatePost,
	invalidatePostCache,
	asyncHandler(postController.createPost)
);

router.put(
	"/:postId",
	authenticateToken,
	requireAlumniVerification,
	validatePostIdParam,
	uploadPostFiles,
	handleUploadError,
	validateUpdatePost,
	invalidatePostCache,
	asyncHandler(postController.updatePost)
);

router.patch(
	"/:postId/archive",
	authenticateToken,
	requireAlumniVerification,
	validatePostIdParam,
	invalidatePostCache,
	asyncHandler(postController.archivePost)
);

router.patch(
	"/:postId/approve",
	authenticateToken,
	requireRole("SUPER_ADMIN"),
	validatePostIdParam,
	validateApprovePost,
	invalidatePostCache,
	asyncHandler(postController.approvePost)
);

router.delete(
	"/:postId",
	authenticateToken,
	validatePostIdParam,
	invalidatePostCache,
	asyncHandler(postController.deletePost)
);

// ==========================================
// LIKE ROUTES
// ==========================================

// Toggle like on a post
router.post(
	"/:postId/like",
	authenticateToken,
	requireAlumniVerification,
	validatePostIdParam,
	invalidatePostInteractionCache,
	asyncHandler(likeController.toggleLike)
);

// Get users who liked a post (with pagination)
router.get(
	"/:postId/likes",
	optionalAuth,
	validatePostIdParam,
	asyncHandler(likeController.getPostLikes)
);

// Check if current user liked a post
router.get(
	"/:postId/like/status",
	authenticateToken,
	requireAlumniVerification,
	validatePostIdParam,
	asyncHandler(likeController.checkUserLike)
);

// ==========================================
// REACTION ROUTES (NEW)
// ==========================================

// Toggle reaction on a post (supports multiple reaction types)
router.post(
	"/:postId/reactions",
	authenticateToken,
	requireAlumniVerification,
	validatePostIdParam,
	invalidatePostInteractionCache,
	asyncHandler(likeController.toggleReaction)
);

// Get post reactions with counts
router.get(
	"/:postId/reactions",
	optionalAuth,
	validatePostIdParam,
	asyncHandler(likeController.getPostReactions)
);

// Get detailed reaction users for modal (LinkedIn-style)
router.get(
	"/:postId/reactions/users",
	optionalAuth,
	validatePostIdParam,
	asyncHandler(likeController.getPostReactionUsers)
);

// ==========================================
// COMMENT ROUTES
// ==========================================

// Get comments for a post (with nested replies and pagination)
router.get(
	"/:postId/comments",
	optionalAuth,
	validatePostIdParam,
	asyncHandler(commentController.getPostComments)
);

// Create a comment on a post
router.post(
	"/:postId/comments",
	authenticateToken,
	requireAlumniVerification,
	validatePostIdParam,
	validateCreateComment,
	invalidatePostInteractionCache,
	asyncHandler(commentController.createComment)
);

// Update a comment
router.put(
	"/:postId/comments/:commentId",
	authenticateToken,
	requireAlumniVerification,
	validatePostAndCommentParams,
	validateUpdateComment,
	invalidatePostInteractionCache,
	asyncHandler(commentController.updateComment)
);

// Delete a comment (works for both comments and replies)
router.delete(
	"/:postId/comments/:commentId",
	authenticateToken,
	requireAlumniVerification,
	validatePostAndCommentParams,
	invalidatePostInteractionCache,
	asyncHandler(commentController.deleteComment)
);

// Create a reply to a comment
router.post(
	"/:postId/comments/:commentId/replies",
	authenticateToken,
	requireAlumniVerification,
	validatePostAndCommentParams,
	validateCreateComment, // Same validation as regular comments
	invalidatePostInteractionCache,
	asyncHandler(commentController.createReply)
);

// ==========================================
// COMMENT REACTION ROUTES
// ==========================================

// Toggle reaction on a comment (supports multiple reaction types)
router.post(
	"/:postId/comments/:commentId/reactions",
	authenticateToken,
	requireAlumniVerification,
	validatePostAndCommentParams,
	invalidatePostInteractionCache,
	asyncHandler(commentLikeController.toggleCommentReaction)
);

// Get comment reactions with counts
router.get(
	"/:postId/comments/:commentId/reactions",
	optionalAuth,
	validatePostAndCommentParams,
	asyncHandler(commentLikeController.getCommentReactions)
);

// Get detailed comment reaction users for modal (LinkedIn-style)
router.get(
	"/:postId/comments/:commentId/reactions/users",
	optionalAuth,
	validatePostAndCommentParams,
	asyncHandler(commentLikeController.getCommentReactionUsers)
);

module.exports = router;
