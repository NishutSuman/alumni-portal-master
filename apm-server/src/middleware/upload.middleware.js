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
    './public/uploads/documents'
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
  getFileUrl
};