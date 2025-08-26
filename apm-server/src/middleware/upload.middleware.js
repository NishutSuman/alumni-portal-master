// src/middleware/upload.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createUploadDirs = () => {
  const dirs = [
    './public/uploads',
    './public/uploads/profiles',
    './public/uploads/posts',
    './public/uploads/events',
    './public/uploads/documents',
    './public/uploads/tickets',           
    './public/uploads/tickets/messages' 
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize upload directories
createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = './public/uploads/';
    
    // Determine upload path based on fieldname or route
    if (file.fieldname === 'profileImage' || req.route.path.includes('profile-picture')) {
      uploadPath += 'profiles/';
    } else if (file.fieldname === 'postImages' || req.route.path.includes('posts')) {
      uploadPath += 'posts/';
    } else if (file.fieldname === 'eventImages' || req.route.path.includes('events')) {
      uploadPath += 'events/';
    } else if (file.fieldname === 'document' || file.fieldname === 'receipt') {
      uploadPath += 'documents/';
    } else {
      uploadPath += 'general/';
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    
    // Clean filename (remove special characters)
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const filename = `${cleanBaseName}_${uniqueSuffix}${extension}`;
    
    cb(null, filename);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types for different upload types
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const documentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const excelTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  
  let allowedTypes = [];
  
  // Determine allowed types based on field name or route
  if (file.fieldname === 'profileImage' || 
      file.fieldname === 'postImages' || 
      file.fieldname === 'eventImages' ||
      req.route.path.includes('profile-picture') ||
      req.route.path.includes('image')) {
    allowedTypes = imageTypes;
  } else if (file.fieldname === 'document' || file.fieldname === 'receipt') {
    allowedTypes = [...imageTypes, ...documentTypes, ...excelTypes];
  } else {
    // Default to images for unknown types
    allowedTypes = imageTypes;
  }
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const allowedExtensions = allowedTypes.map(type => {
      switch(type) {
        case 'image/jpeg':
        case 'image/jpg': return 'jpg';
        case 'image/png': return 'png';
        case 'image/gif': return 'gif';
        case 'image/webp': return 'webp';
        case 'application/pdf': return 'pdf';
        case 'application/msword': return 'doc';
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'docx';
        case 'application/vnd.ms-excel': return 'xls';
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return 'xlsx';
        default: return type;
      }
    }).join(', ');
    
    cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions}`), false);
  }
};

// Base multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB default limit
    files: 10 // Maximum 10 files
  }
});

// Specific upload configurations for different use cases

// Profile picture upload (single file, 5MB limit)
const uploadProfilePicture = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB for profile pictures
    files: 1
  }
}).single('profileImage');

// Post images upload (multiple files, 5MB each)
const uploadPostImages = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 5 // Maximum 5 images per post
  }
}).array('postImages', 5);

// Single post image upload
const uploadSinglePostImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  }
}).single('image');

// Event images upload (multiple files)
const uploadEventImages = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 10 // Maximum 10 images per event
  }
}).array('eventImages', 10);

// Document upload (receipts, invoices, etc.)
const uploadDocument = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for documents
    files: 1
  }
}).single('document');

// Receipt upload for transactions
const uploadReceipt = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for receipts
    files: 1
  }
}).single('receipt');

// General file upload
const uploadGeneral = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  }
}).array('files', 5);

// 🎫 TICKET ATTACHMENTS - Add to existing upload configurations
const uploadTicketAttachments = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per attachment
    files: 5
  }
}).array('attachments', 5);  // Uses 'attachments' field name for tickets

// 🎫 MESSAGE ATTACHMENTS - Add to existing upload configurations  
const uploadMessageAttachments = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB per message attachment
    files: 3
  }
}).array('attachments', 3);  // Uses 'attachments' field name for messages

// Error handling middleware for multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum allowed size varies by file type.',
          error: err.message
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files uploaded.',
          error: err.message
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected field name for file upload.',
          error: err.message
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error.',
          error: err.message
        });
    }
  } else if (err) {
    // Custom file filter errors
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error.'
    });
  }
  
  next();
};

// Utility function to delete uploaded file (for cleanup on errors)
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

// Utility function to get file URL for response
const getFileUrl = (req, filename, subfolder = '') => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads${subfolder ? '/' + subfolder : ''}/${filename}`;
};

// ============================================
// PHOTO & ALBUM UPLOAD CONFIGURATIONS
// ============================================

// Album cover image upload (single file, 3MB limit)
const uploadAlbumCover = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = './public/uploads/albums/covers/';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension);
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `album_cover_${cleanBaseName}_${uniqueSuffix}${extension}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for album covers'), false);
    }
  },
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB for album covers
    files: 1
  }
}).single('coverImage');

// Album photos upload (multiple files, 5MB each)
const uploadAlbumPhotos = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = './public/uploads/albums/photos/';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension);
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `photo_${cleanBaseName}_${uniqueSuffix}${extension}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, WebP, and GIF images are allowed for photos'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per photo
    files: 20 // Maximum 20 photos at once
  }
}).array('photos', 20);

// Single photo upload
const uploadSinglePhoto = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = './public/uploads/albums/photos/';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension);
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `photo_${cleanBaseName}_${uniqueSuffix}${extension}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per photo
    files: 1
  }
}).single('photo');

// ============================================
// PHOTO METADATA EXTRACTION UTILITIES
// ============================================

/**
 * Extract basic metadata from uploaded file
 */
const extractPhotoMetadata = (file) => {
  if (!file) return null;

  const metadata = {
    originalName: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString()
  };

  // Add image-specific metadata if available
  if (file.mimetype.startsWith('image/')) {
    metadata.imageInfo = {
      format: file.mimetype.split('/')[1].toUpperCase(),
      sizeFormatted: formatFileSize(file.size)
    };
  }

  return metadata;
};

/**
 * Format file size in human readable format
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate photo URL from file path
 */
const generatePhotoUrl = (req, file) => {
  if (!file) return null;
  
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const relativePath = file.path.replace('./public', '').replace(/\\/g, '/');
  return `${baseUrl}${relativePath}`;
};

/**
 * Validate photo file before processing
 */
const validatePhotoFile = (file, maxSizeMB = 5) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }
  
  // Check file size
  const maxSize = maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push(`File size exceeds ${maxSizeMB}MB limit`);
  }
  
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Clean up uploaded files on error
 */
const cleanupUploadedFiles = (files) => {
  if (!files) return;
  
  const filesToClean = Array.isArray(files) ? files : [files];
  
  filesToClean.forEach(file => {
    if (file && file.path) {
      deleteUploadedFile(file.path);
    }
  });
};

// Sponsor logo upload (single file, 3MB limit)
const uploadSponsorLogo = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = './public/uploads/sponsors/logos/';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension);
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `sponsor_logo_${cleanBaseName}_${uniqueSuffix}${extension}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for sponsor logos'), false);
    }
  },
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB for sponsor logos
    files: 1
  }
}).single('logoFile');

// ============================================
// SPONSOR UPLOAD CONFIGURATIONS
// ============================================

// Sponsor head photo upload (single file, 3MB limit)
const uploadSponsorHeadPhoto = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = './public/uploads/sponsors/heads/';
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension);
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const filename = `sponsor_head_${cleanBaseName}_${uniqueSuffix}${extension}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for head photos'), false);
    }
  },
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB for head photos
    files: 1
  }
}).single('headPhotoFile');

// Combined sponsor files upload (logo + head photo)
const uploadSponsorFiles = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      let uploadPath = './public/uploads/sponsors/';
      
      // Determine subfolder based on fieldname
      if (file.fieldname === 'logoFile') {
        uploadPath += 'logos/';
      } else if (file.fieldname === 'headPhotoFile') {
        uploadPath += 'heads/';
      } else {
        uploadPath += 'general/';
      }
      
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, extension);
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      
      let prefix = 'sponsor_';
      if (file.fieldname === 'logoFile') {
        prefix = 'sponsor_logo_';
      } else if (file.fieldname === 'headPhotoFile') {
        prefix = 'sponsor_head_';
      }
      
      const filename = `${prefix}${cleanBaseName}_${uniqueSuffix}${extension}`;
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Only JPEG, JPG, PNG, and WebP images are allowed for ${file.fieldname}`), false);
    }
  },
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB per file
    files: 2 // Maximum 2 files (logo + head photo)
  }
}).fields([
  { name: 'logoFile', maxCount: 1 },
  { name: 'headPhotoFile', maxCount: 1 }
]);

module.exports = {
  upload,
  uploadProfilePicture,
  uploadPostImages,
  uploadSinglePostImage,
  uploadEventImages,
  uploadDocument,
  uploadReceipt,
  uploadGeneral,
  handleUploadError,
  deleteUploadedFile,
  getFileUrl,

  // Photo & Album uploads
  uploadAlbumCover,
  uploadAlbumPhotos,
  uploadSinglePhoto,
  
  // Photo utilities
  extractPhotoMetadata,
  formatFileSize,
  generatePhotoUrl,
  validatePhotoFile,
  cleanupUploadedFiles,

  // Sponsor uploads
  uploadSponsorLogo,
  uploadSponsorHeadPhoto,
  uploadSponsorFiles,

  // Ticket Uploads
  uploadTicketAttachments,     // For ticket creation & admin responses
  uploadMessageAttachments,    // For message attachments
};