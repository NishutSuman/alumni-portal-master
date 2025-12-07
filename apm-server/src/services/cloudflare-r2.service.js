// src/services/cloudflare-r2.service.js
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

class CloudflareR2Service {
  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });
    
    this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    this.publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  }

  /**
   * Generate a unique filename with proper extension
   */
  generateUniqueFilename(originalFilename, prefix = '') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, extension);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    
    return `${prefix}${prefix ? '_' : ''}${cleanBaseName}_${timestamp}_${randomString}${extension}`;
  }

  /**
   * Upload file to Cloudflare R2
   */
  async uploadFile(file, folder = 'organization', filename = null) {
    try {
      if (!file || !file.buffer) {
        throw new Error('Invalid file object. Buffer is required.');
      }

      const key = `${folder}/${filename || this.generateUniqueFilename(file.originalname)}`;
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
        Metadata: {
          'original-name': file.originalname,
          'upload-timestamp': Date.now().toString(),
        },
      });

      const response = await this.client.send(command);
      
      return {
        success: true,
        key,
        url: `${this.publicUrl}/${key}`,
        etag: response.ETag,
        filename: filename || this.generateUniqueFilename(file.originalname),
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      console.error('Cloudflare R2 upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload organization logo
   */
  async uploadOrganizationLogo(file) {
    const filename = this.generateUniqueFilename(file.originalname, 'logo');
    return this.uploadFile(file, 'organization/logos', filename);
  }

  /**
   * Upload organization bylaw document
   */
  async uploadOrganizationBylaw(file) {
    const filename = this.generateUniqueFilename(file.originalname, 'bylaw');
    return this.uploadFile(file, 'organization/bylaws', filename);
  }

  /**
   * Upload organization registration certificate
   */
  async uploadOrganizationCertificate(file) {
    const filename = this.generateUniqueFilename(file.originalname, 'cert');
    return this.uploadFile(file, 'organization/certificates', filename);
  }

  /**
   * Upload user profile picture
   */
  async uploadProfilePicture(file) {
    const filename = this.generateUniqueFilename(file.originalname, 'profile');
    return this.uploadFile(file, 'alumni-portal/profile-pictures', filename);
  }

  /**
   * Validate profile picture file
   */
  validateProfilePicture(file) {
    const errors = [];
    
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Size limit - 5MB for profile pictures
    const sizeLimit = 5 * 1024 * 1024;
    if (file.size > sizeLimit) {
      errors.push(`File size exceeds 5MB limit for profile pictures`);
    }

    // Allowed types for profile pictures
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Upload post image (hero or gallery)
   */
  async uploadPostImage(file, type = 'gallery') {
    const prefix = type === 'hero' ? 'hero' : 'post';
    const filename = this.generateUniqueFilename(file.originalname, prefix);
    return this.uploadFile(file, 'alumni-portal/post-images', filename);
  }

  /**
   * Upload event image (hero or gallery)
   */
  async uploadEventImage(file, type = 'hero') {
    const prefix = type === 'hero' ? 'hero' : 'event';
    const filename = this.generateUniqueFilename(file.originalname, prefix);
    return this.uploadFile(file, 'alumni-portal/event-images', filename);
  }

  /**
   * Validate event image file
   */
  validateEventImage(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, error: 'No file provided' };
    }

    // Size limit - 10MB for event images (same as post images)
    const sizeLimit = 10 * 1024 * 1024;
    if (file.size > sizeLimit) {
      errors.push(`File size exceeds 10MB limit for event images`);
    }

    // Allowed types for event images
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : null
    };
  }

  /**
   * Upload album cover image
   */
  async uploadAlbumCover(file) {
    const filename = this.generateUniqueFilename(file.originalname, 'album_cover');
    return this.uploadFile(file, 'alumni-portal/album-covers', filename);
  }

  /**
   * Upload album photo
   */
  async uploadAlbumPhoto(file) {
    const filename = this.generateUniqueFilename(file.originalname, 'photo');
    return this.uploadFile(file, 'alumni-portal/album-photos', filename);
  }

  /**
   * Validate album cover image
   */
  validateAlbumCover(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, error: 'No file provided' };
    }

    // Size limit - 3MB for album covers
    const sizeLimit = 3 * 1024 * 1024;
    if (file.size > sizeLimit) {
      errors.push(`File size exceeds 3MB limit for album covers`);
    }

    // Allowed types for album covers
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : null
    };
  }

  /**
   * Validate album photo
   */
  validateAlbumPhoto(file) {
    const errors = [];

    if (!file) {
      errors.push('No file provided');
      return { valid: false, error: 'No file provided' };
    }

    // Size limit - 5MB for album photos
    const sizeLimit = 5 * 1024 * 1024;
    if (file.size > sizeLimit) {
      errors.push(`File size exceeds 5MB limit for album photos`);
    }

    // Allowed types for album photos
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : null
    };
  }

  /**
   * Validate post image file
   */
  validatePostImage(file) {
    const errors = [];
    
    if (!file) {
      errors.push('No file provided');
      return { valid: false, error: 'No file provided' };
    }

    // Size limit - 10MB for post images
    const sizeLimit = 10 * 1024 * 1024;
    if (file.size > sizeLimit) {
      errors.push(`File size exceeds 10MB limit for post images`);
    }

    // Allowed types for post images (more permissive than profile pictures)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return { 
      valid: errors.length === 0, 
      error: errors.length > 0 ? errors.join(', ') : null
    };
  }

  /**
   * Delete file from Cloudflare R2
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      
      return {
        success: true,
        message: `File ${key} deleted successfully`,
      };
    } catch (error) {
      console.error('Cloudflare R2 delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get signed URL for private file access
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      
      return {
        success: true,
        url: signedUrl,
        expiresIn,
      };
    } catch (error) {
      console.error('Cloudflare R2 signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Validate file for organization uploads
   */
  validateOrganizationFile(file, fileType) {
    const errors = [];
    
    if (!file) {
      errors.push('No file provided');
      return { isValid: false, errors };
    }

    // Size limits based on file type
    const sizeLimits = {
      logo: 5 * 1024 * 1024,     // 5MB for logos
      bylaw: 10 * 1024 * 1024,   // 10MB for bylaws
      certificate: 10 * 1024 * 1024, // 10MB for certificates
    };

    if (file.size > sizeLimits[fileType]) {
      errors.push(`File size exceeds ${sizeLimits[fileType] / (1024 * 1024)}MB limit for ${fileType}`);
    }

    // Allowed types based on file type
    const allowedTypes = {
      logo: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      bylaw: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      certificate: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    };

    if (!allowedTypes[fileType].includes(file.mimetype)) {
      errors.push(`Invalid file type for ${fileType}. Allowed types: ${allowedTypes[fileType].join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract key from URL for deletion
   */
  extractKeyFromUrl(url) {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch (error) {
      console.error('Failed to extract key from URL:', error);
      return null;
    }
  }

  /**
   * Get file info from key
   */
  async getFileInfo(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      
      return {
        success: true,
        key,
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error('Cloudflare R2 file info error:', error);
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  /**
   * Get file content from R2
   */
  async getFile(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      return {
        success: true,
        data: buffer,
        contentType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength,
        lastModified: response.LastModified,
      };
    } catch (error) {
      console.error('Cloudflare R2 get file error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if service is properly configured
   */
  isConfigured() {
    return !!(
      process.env.CLOUDFLARE_R2_ENDPOINT &&
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
      process.env.CLOUDFLARE_R2_BUCKET_NAME &&
      process.env.CLOUDFLARE_R2_PUBLIC_URL
    );
  }

  /**
   * Test connection to Cloudflare R2
   */
  async testConnection() {
    try {
      if (!this.isConfigured()) {
        throw new Error('Cloudflare R2 is not properly configured');
      }

      // Try to list objects to test connection
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: 'test-connection', // This will likely fail, but it tests the connection
      });

      await this.client.send(command);
      
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      // Expected to fail for non-existent key, but connection errors will be different
      if (error.name === 'NoSuchKey') {
        return { success: true, message: 'Connection successful' };
      }
      
      console.error('Cloudflare R2 connection test failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Delete file from R2 by URL
   */
  async deleteFileByUrl(fileUrl) {
    try {
      if (!fileUrl || !fileUrl.includes(this.publicUrl)) {
        throw new Error('Invalid file URL');
      }

      // Extract the key from the URL
      const key = fileUrl.replace(this.publicUrl + '/', '');

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);

      return {
        success: true,
        message: 'File deleted successfully',
        key,
      };
    } catch (error) {
      console.error('Cloudflare R2 delete file error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete organization logo
   */
  async deleteOrganizationLogo(fileUrl) {
    return this.deleteFileByUrl(fileUrl);
  }

  /**
   * Delete organization bylaw document
   */
  async deleteOrganizationBylaw(fileUrl) {
    return this.deleteFileByUrl(fileUrl);
  }

  /**
   * Delete organization certificate
   */
  async deleteOrganizationCertificate(fileUrl) {
    return this.deleteFileByUrl(fileUrl);
  }
}

// Create and export singleton instance
const cloudflareR2Service = new CloudflareR2Service();

module.exports = {
  CloudflareR2Service,
  cloudflareR2Service,
};