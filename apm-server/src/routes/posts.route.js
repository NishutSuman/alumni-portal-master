// src/routes/posts.route.js
const express = require("express");
const router = express.Router();
const { authenticateToken, requireRole, optionalAuth } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const { handleUploadError } = require('../middleware/upload.middleware');
const { 
  validateCreatePost, 
  validateUpdatePost, 
  validateApprovePost,
  validatePostIdParam 
} = require('../middleware/validation.middleware');
const { 
  cachePosts,
  cachePost,
  invalidatePostCache 
} = require('../middleware/cache.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Import post controller
const postController = require('../controllers/post.controller');

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

// Public routes (no auth required, but can be enhanced with optional auth)
router.get('/', optionalAuth, cachePosts, asyncHandler(postController.getPosts));
router.get('/:postId', optionalAuth, cachePost, asyncHandler(postController.getPostById));

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
  asyncHandler(postController.approvePost)
);

router.delete('/:postId', 
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  validatePostIdParam,
  asyncHandler(postController.deletePost)
);

module.exports = router;