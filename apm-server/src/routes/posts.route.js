// src/routes/posts.route.js - COMPLETE VERSION
const express = require("express");
const router = express.Router();
const { authenticateToken, requireRole, optionalAuth } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const { handleUploadError } = require('../middleware/upload.middleware');
const { 
  validateCreatePost, 
  validateUpdatePost, 
  validateApprovePost,
  validatePostIdParam,
  validateCreateComment,
  validateUpdateComment,
  validateCommentIdParam,
  validatePostAndCommentParams
} = require('../middleware/validation.middleware');
const { 
  cachePosts,
  cachePost,
  invalidatePostCache,
  invalidatePostInteractionCache
} = require('../middleware/cache.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import controllers
const postController = require('../controllers/post.controller');
const likeController = require('../controllers/like.controller');
const commentController = require('../controllers/comment.controller');

// Configure multer for post uploads (images and documents)
const postUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './public/uploads/posts/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${cleanBaseName}_${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

const postFileFilter = (req, file, cb) => {
  // Allowed file types for posts
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const documentTypes = [
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  const allowedTypes = [...imageTypes, ...documentTypes];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF, DOC, DOCX, XLS, XLSX'), false);
  }
};

const uploadPostFiles = multer({
  storage: postUploadStorage,
  fileFilter: postFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Maximum 10 files total
  }
}).fields([
  { name: 'heroImage', maxCount: 1 },
  { name: 'images', maxCount: 9 } // 9 additional images + 1 hero = 10 total
]);

// ==========================================
// POST MANAGEMENT ROUTES
// ==========================================

// Public routes (no auth required, but can be enhanced with optional auth)
router.get('/', optionalAuth, cachePosts, asyncHandler(postController.getPosts));
router.get('/:postId', optionalAuth, validatePostIdParam, cachePost, asyncHandler(postController.getPostById));

// Protected routes (authentication required)
router.post('/', 
  authenticateToken, 
  validateCreatePost, 
  uploadPostFiles,
  handleUploadError,
  invalidatePostCache,
  asyncHandler(postController.createPost)
);

router.put('/:postId', 
  authenticateToken, 
  validatePostIdParam,  
  validateUpdatePost,
  uploadPostFiles,
  handleUploadError,
  invalidatePostCache,
  asyncHandler(postController.updatePost)
);

router.patch('/:postId/archive', 
  authenticateToken, 
  validatePostIdParam,
  invalidatePostCache,
  asyncHandler(postController.archivePost)
);

// Super Admin only routes
router.get('/admin/pending', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  asyncHandler(postController.getPendingPosts)
);

router.patch('/:postId/approve', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validatePostIdParam,   
  validateApprovePost,
  invalidatePostCache,
  asyncHandler(postController.approvePost)
);

router.delete('/:postId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validatePostIdParam,
  invalidatePostCache,
  asyncHandler(postController.deletePost)
);

// ==========================================
// LIKE ROUTES
// ==========================================

// Toggle like on a post
router.post('/:postId/like', 
  authenticateToken, 
  validatePostIdParam,
  invalidatePostInteractionCache,
  asyncHandler(likeController.toggleLike)
);

// Get users who liked a post (with pagination)
router.get('/:postId/likes', 
  optionalAuth, 
  validatePostIdParam,
  asyncHandler(likeController.getPostLikes)
);

// Check if current user liked a post
router.get('/:postId/like/status', 
  authenticateToken, 
  validatePostIdParam,
  asyncHandler(likeController.checkUserLike)
);

// ==========================================
// COMMENT ROUTES
// ==========================================

// Get comments for a post (with nested replies and pagination)
router.get('/:postId/comments', 
  optionalAuth, 
  validatePostIdParam,
  asyncHandler(commentController.getPostComments)
);

// Create a comment on a post
router.post('/:postId/comments', 
  authenticateToken, 
  validatePostIdParam,
  validateCreateComment,
  invalidatePostInteractionCache,
  asyncHandler(commentController.createComment)
);

// Update a comment
router.put('/:postId/comments/:commentId', 
  authenticateToken, 
  validatePostAndCommentParams,
  validateUpdateComment,
  invalidatePostInteractionCache,
  asyncHandler(commentController.updateComment)
);

// Delete a comment (works for both comments and replies)
router.delete('/:postId/comments/:commentId', 
  authenticateToken, 
  validatePostAndCommentParams,
  invalidatePostInteractionCache,
  asyncHandler(commentController.deleteComment)
);

// Create a reply to a comment
router.post('/:postId/comments/:commentId/replies', 
  authenticateToken, 
  validatePostAndCommentParams,
  validateCreateComment, // Same validation as regular comments
  invalidatePostInteractionCache,
  asyncHandler(commentController.createReply)
);

module.exports = router;