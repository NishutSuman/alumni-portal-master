// ============================================
// FILE: src/services/ticketFile.service.js (NEW)
// ============================================

const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp'); // For image processing
const { prisma } = require('../../config/database');

class TicketFileService {
  
  // ==========================================
  // FILE PROCESSING
  // ==========================================
  
  static async processFileMetadata(fileData, type = 'ticket_attachment') {
    const { filename, filePath, mimeType, fileSize } = fileData;
    const fullPath = path.join('uploads', filePath);
    
    try {
      const metadata = {
        isImage: mimeType.startsWith('image/'),
        compressedSize: fileSize
      };
      
      // Process images
      if (metadata.isImage && mimeType !== 'image/svg+xml') {
        const imageInfo = await this.processImage(fullPath, filename);
        Object.assign(metadata, imageInfo);
      }
      
      // Generate file checksum
      metadata.checksum = await this.generateFileChecksum(fullPath);
      
      // Store metadata (we'll reference this by filename since we don't have attachment ID yet)
      return metadata;
      
    } catch (error) {
      console.error('Error processing file metadata:', error);
      return { isImage: false, compressedSize: fileSize };
    }
  }
  
  static async processImage(filePath, filename) {
    try {
      const image = sharp(filePath);
      const { width, height } = await image.metadata();
      
      // Generate thumbnail (max 200x200)
      const thumbnailDir = path.join('uploads', 'thumbnails');
      await fs.mkdir(thumbnailDir, { recursive: true });
      
      const thumbnailFilename = `thumb_${filename}`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
      
      await image
        .resize(200, 200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      return {
        imageWidth: width,
        imageHeight: height,
        thumbnailPath: `thumbnails/${thumbnailFilename}`
      };
      
    } catch (error) {
      console.error('Error processing image:', error);
      return {};
    }
  }
  
  static async generateFileChecksum(filePath) {
    try {
      const crypto = require('crypto');
      const fileBuffer = await fs.readFile(filePath);
      const hash = crypto.createHash('md5');
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.error('Error generating checksum:', error);
      return null;
    }
  }
  
  // ==========================================
  // FILE METADATA MANAGEMENT
  // ==========================================
  
  static async saveFileMetadata(attachmentId, metadata) {
    try {
      await prisma.ticketFileMetadata.create({
        data: {
          attachmentId,
          ...metadata
        }
      });
    } catch (error) {
      console.error('Error saving file metadata:', error);
    }
  }
  
  static async getFileMetadata(attachmentId) {
    return await prisma.ticketFileMetadata.findUnique({
      where: { attachmentId }
    });
  }
  
  static async trackFileAccess(attachmentId) {
    try {
      await prisma.ticketFileMetadata.update({
        where: { attachmentId },
        data: {
          downloadCount: { increment: 1 },
          lastAccessed: new Date()
        }
      });
    } catch (error) {
      console.error('Error tracking file access:', error);
    }
  }
  
  // ==========================================
  // FILE UTILITIES
  // ==========================================
  
  static getFileTypeIcon(mimeType) {
    const iconMap = {
      'application/pdf': 'file-pdf',
      'application/msword': 'file-word',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file-word',
      'application/vnd.ms-excel': 'file-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'file-excel',
      'application/zip': 'file-zip',
      'text/plain': 'file-text',
      'text/csv': 'file-csv',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/gif': 'image',
      'image/webp': 'image'
    };
    
    return iconMap[mimeType] || 'file';
  }
  
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  static isImageFile(mimeType) {
    return mimeType.startsWith('image/');
  }
  
  static getImageDimensions(width, height, maxWidth = 400) {
    if (!width || !height) return { width: maxWidth, height: 300 };
    
    const aspectRatio = width / height;
    
    if (width > maxWidth) {
      return {
        width: maxWidth,
        height: Math.round(maxWidth / aspectRatio)
      };
    }
    
    return { width, height };
  }
}

module.exports = TicketFileService;