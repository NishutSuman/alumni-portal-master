// src/services/PhotoService.js
const { prisma } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

// ============================================
// PHOTO SERVICE CLASS
// ============================================

class PhotoService {
  
  // ============================================
  // PHOTO OPERATIONS
  // ============================================

  /**
   * Process and save photo with metadata
   */
  static async processPhotoUpload(file, albumId, uploadedBy, caption = null, tags = []) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      // Generate photo URL
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const relativePath = file.path.replace('./public', '').replace(/\\/g, '/');
      const photoUrl = `${baseUrl}${relativePath}`;

      // Extract metadata
      const metadata = {
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        dimensions: null, // Could be extracted using sharp library if needed
        format: file.mimetype.split('/')[1].toUpperCase(),
        sizeFormatted: this.formatFileSize(file.size)
      };

      // Create photo record
      const photo = await prisma.photo.create({
        data: {
          url: photoUrl,
          caption: caption?.trim() || null,
          tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
          metadata,
          albumId,
          uploadedBy
        },
        include: {
          album: {
            select: { id: true, name: true }
          },
          uploader: {
            select: { id: true, fullName: true }
          }
        }
      });

      return {
        success: true,
        photo
      };
    } catch (error) {
      console.error('Photo processing error:', error);
      
      // Clean up uploaded file on error
      if (file?.path) {
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          console.error('File cleanup error:', cleanupError);
        }
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process bulk photo uploads
   */
  static async processBulkPhotoUpload(files, albumId, uploadedBy, bulkCaption = null) {
    try {
      if (!files || files.length === 0) {
        throw new Error('No files provided');
      }

      const results = {
        successful: [],
        failed: [],
        totalUploaded: 0,
        totalFailed: 0
      };

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const caption = bulkCaption ? `${bulkCaption} (${i + 1}/${files.length})` : null;
        
        const result = await this.processPhotoUpload(file, albumId, uploadedBy, caption, []);
        
        if (result.success) {
          results.successful.push({
            photoId: result.photo.id,
            filename: result.photo.metadata.filename,
            url: result.photo.url
          });
          results.totalUploaded++;
        } else {
          results.failed.push({
            filename: file.originalname,
            error: result.error
          });
          results.totalFailed++;
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk photo upload error:', error);
      throw error;
    }
  }

  /**
   * Update photo information
   */
  static async updatePhoto(photoId, updates, userId) {
    try {
      // Validate photo exists and user has permission
      const existingPhoto = await prisma.photo.findUnique({
        where: { id: photoId },
        include: {
          album: {
            select: { createdBy: true }
          }
        }
      });

      if (!existingPhoto) {
        throw new Error('Photo not found');
      }

      // Check permissions (only album creator or photo uploader can edit)
      const canEdit = existingPhoto.uploadedBy === userId || 
                     existingPhoto.album?.createdBy === userId;
                     
      if (!canEdit) {
        throw new Error('Insufficient permissions to edit this photo');
      }

      // Prepare update data
      const updateData = {};
      
      if (updates.caption !== undefined) {
        updateData.caption = updates.caption?.trim() || null;
      }
      
      if (updates.tags !== undefined) {
        updateData.tags = Array.isArray(updates.tags) ? updates.tags : [];
      }

      // Update photo
      const updatedPhoto = await prisma.photo.update({
        where: { id: photoId },
        data: updateData,
        include: {
          album: {
            select: { id: true, name: true }
          },
          uploader: {
            select: { id: true, fullName: true }
          }
        }
      });

      return updatedPhoto;
    } catch (error) {
      console.error('Photo update error:', error);
      throw error;
    }
  }

  /**
   * Delete photo and cleanup file
   */
  static async deletePhoto(photoId, userId) {
    try {
      // Get photo with permissions check
      const photo = await prisma.photo.findUnique({
        where: { id: photoId },
        include: {
          album: {
            select: { createdBy: true }
          }
        }
      });

      if (!photo) {
        throw new Error('Photo not found');
      }

      // Check permissions
      const canDelete = photo.uploadedBy === userId || 
                       photo.album?.createdBy === userId;
                       
      if (!canDelete) {
        throw new Error('Insufficient permissions to delete this photo');
      }

      // Delete photo record
      await prisma.photo.delete({
        where: { id: photoId }
      });

      // Clean up file
      try {
        const filePath = this.getFilePathFromUrl(photo.url);
        if (filePath) {
          await fs.unlink(filePath);
        }
      } catch (fileError) {
        console.error('File cleanup error:', fileError);
        // Don't throw error for file cleanup failure
      }

      return {
        success: true,
        deletedPhoto: {
          id: photo.id,
          filename: photo.metadata?.filename,
          url: photo.url
        }
      };
    } catch (error) {
      console.error('Photo deletion error:', error);
      throw error;
    }
  }

  /**
   * Bulk delete photos
   */
  static async bulkDeletePhotos(photoIds, userId) {
    try {
      const results = {
        deleted: [],
        failed: [],
        totalDeleted: 0,
        totalFailed: 0
      };

      for (const photoId of photoIds) {
        try {
          const result = await this.deletePhoto(photoId, userId);
          if (result.success) {
            results.deleted.push(result.deletedPhoto);
            results.totalDeleted++;
          }
        } catch (error) {
          results.failed.push({
            photoId,
            error: error.message
          });
          results.totalFailed++;
        }
      }

      return results;
    } catch (error) {
      console.error('Bulk photo deletion error:', error);
      throw error;
    }
  }

  // ============================================
  // ALBUM OPERATIONS
  // ============================================

  /**
   * Set album cover image
   */
  static async setAlbumCover(albumId, photoId, userId) {
    try {
      // Verify album ownership
      const album = await prisma.album.findUnique({
        where: { id: albumId },
        select: { createdBy: true }
      });

      if (!album) {
        throw new Error('Album not found');
      }

      if (album.createdBy !== userId) {
        throw new Error('Insufficient permissions to modify this album');
      }

      // Verify photo belongs to this album
      const photo = await prisma.photo.findFirst({
        where: {
          id: photoId,
          albumId: albumId
        }
      });

      if (!photo) {
        throw new Error('Photo not found in this album');
      }

      // Update album cover
      const updatedAlbum = await prisma.album.update({
        where: { id: albumId },
        data: { coverImage: photo.url },
        include: {
          _count: {
            select: { photos: true }
          }
        }
      });

      return updatedAlbum;
    } catch (error) {
      console.error('Set album cover error:', error);
      throw error;
    }
  }

  /**
   * Move photos between albums
   */
  static async movePhotosToAlbum(photoIds, targetAlbumId, userId) {
    try {
      // Verify target album exists and user has permission
      const targetAlbum = await prisma.album.findUnique({
        where: { id: targetAlbumId },
        select: { createdBy: true, name: true }
      });

      if (!targetAlbum) {
        throw new Error('Target album not found');
      }

      if (targetAlbum.createdBy !== userId) {
        throw new Error('Insufficient permissions to modify target album');
      }

      // Verify all photos exist and user has permission
      const photos = await prisma.photo.findMany({
        where: {
          id: { in: photoIds }
        },
        include: {
          album: {
            select: { createdBy: true }
          }
        }
      });

      // Check permissions for each photo
      for (const photo of photos) {
        const canMove = photo.uploadedBy === userId || 
                       photo.album?.createdBy === userId;
                       
        if (!canMove) {
          throw new Error(`Insufficient permissions to move photo ${photo.id}`);
        }
      }

      // Move photos
      const updatedPhotos = await prisma.photo.updateMany({
        where: {
          id: { in: photoIds }
        },
        data: {
          albumId: targetAlbumId
        }
      });

      return {
        movedCount: updatedPhotos.count,
        targetAlbum: targetAlbum.name,
        photoIds
      };
    } catch (error) {
      console.error('Move photos error:', error);
      throw error;
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract file path from URL
   */
  static getFilePathFromUrl(url) {
    try {
      // Remove base URL and convert to file path
      const relativePath = url.replace(/^https?:\/\/[^\/]+/, '');
      return path.join('./public', relativePath);
    } catch (error) {
      console.error('Error extracting file path:', error);
      return null;
    }
  }

  /**
   * Validate user mentions in tags
   */
  static async validateUserTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return { valid: [], invalid: [] };
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: tags },
        isActive: true
      },
      select: { id: true, fullName: true }
    });

    const validTags = users.map(user => user.id);
    const invalidTags = tags.filter(tag => !validTags.includes(tag));

    return {
      valid: validTags,
      invalid: invalidTags,
      users
    };
  }

  /**
   * Get photo statistics for album
   */
  static async getAlbumPhotoStats(albumId) {
    try {
      const stats = await prisma.photo.aggregate({
        where: { albumId },
        _count: true,
        _sum: {
          // Can't directly sum JSON field, would need raw query for file sizes
        }
      });

      // Get total file size with raw query
      const sizeResult = await prisma.$queryRaw`
        SELECT COALESCE(SUM(CAST(metadata->>'size' AS INTEGER)), 0) as total_size
        FROM photos 
        WHERE album_id = ${albumId} 
          AND metadata->>'size' IS NOT NULL
      `;

      const totalSize = sizeResult[0]?.total_size || 0;

      return {
        totalPhotos: stats._count,
        totalSize,
        totalSizeFormatted: this.formatFileSize(parseInt(totalSize))
      };
    } catch (error) {
      console.error('Album photo stats error:', error);
      return {
        totalPhotos: 0,
        totalSize: 0,
        totalSizeFormatted: '0 Bytes'
      };
    }
  }
}

module.exports = PhotoService;