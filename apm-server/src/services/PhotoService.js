// src/services/PhotoService.js
const { prisma } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { cloudflareR2Service } = require('./cloudflare-r2.service');

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
  static async processPhotoUpload(file, albumId, uploadedBy, caption = null, tags = [], includeRelations = true) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      // Check if Cloudflare R2 is configured
      if (!cloudflareR2Service.isConfigured()) {
        throw new Error('Cloudflare R2 storage is not configured');
      }

      // Validate album photo
      const validation = cloudflareR2Service.validateAlbumPhoto(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Upload to R2
      const uploadResult = await cloudflareR2Service.uploadAlbumPhoto(file);
      const photoUrl = uploadResult.url;

      // Extract metadata
      const metadata = {
        originalName: file.originalname,
        filename: uploadResult.filename,
        mimetype: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        dimensions: null, // Could be extracted using sharp library if needed
        format: file.mimetype.split('/')[1].toUpperCase(),
        sizeFormatted: this.formatFileSize(file.size),
        r2Key: uploadResult.key
      };

      // Create photo record (skip includes for bulk uploads to improve performance)
      const photo = await prisma.photo.create({
        data: {
          url: photoUrl,
          caption: caption?.trim() || null,
          tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
          metadata,
          albumId,
          uploadedBy
        },
        include: includeRelations ? {
          album: {
            select: { id: true, name: true }
          },
          uploader: {
            select: { id: true, fullName: true }
          }
        } : false
      });

      return {
        success: true,
        photo
      };
    } catch (error) {
      console.error('Photo processing error:', error);

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

      // Process all files in parallel for better performance
      // Skip database includes to speed up bulk operations
      const uploadPromises = files.map((file, index) => {
        const caption = bulkCaption ? `${bulkCaption} (${index + 1}/${files.length})` : null;
        return this.processPhotoUpload(file, albumId, uploadedBy, caption, [], false)
          .then(result => ({ ...result, filename: file.originalname }));
      });

      // Wait for all uploads to complete
      const uploadResults = await Promise.all(uploadPromises);

      // Aggregate results
      for (const result of uploadResults) {
        if (result.success) {
          results.successful.push({
            photoId: result.photo.id,
            filename: result.photo.metadata.filename,
            url: result.photo.url
          });
          results.totalUploaded++;
        } else {
          results.failed.push({
            filename: result.filename,
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

      // Delete photo record from database first (fast operation)
      await prisma.photo.delete({
        where: { id: photoId }
      });

      // Clean up file from R2 storage asynchronously (don't block response)
      if (photo.url) {
        console.log('Scheduling R2 deletion for:', photo.url);
        // Delete in background without blocking
        setImmediate(async () => {
          try {
            await cloudflareR2Service.deleteFileByUrl(photo.url);
            console.log('Photo deleted from R2 successfully:', photo.url);
          } catch (fileError) {
            console.error('R2 file cleanup error:', fileError);
          }
        });
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

      // Fetch all photos at once with permissions check
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

      // Separate photos into allowed and denied
      const photosToDelete = [];
      const photoUrlsToDelete = [];

      for (const photo of photos) {
        const canDelete = photo.uploadedBy === userId || photo.album?.createdBy === userId;

        if (canDelete) {
          photosToDelete.push(photo.id);
          if (photo.url) {
            photoUrlsToDelete.push(photo.url);
          }
          results.deleted.push({
            id: photo.id,
            filename: photo.metadata?.filename,
            url: photo.url
          });
          results.totalDeleted++;
        } else {
          results.failed.push({
            photoId: photo.id,
            error: 'Insufficient permissions'
          });
          results.totalFailed++;
        }
      }

      // Add failed entries for photos that don't exist
      const foundPhotoIds = photos.map(p => p.id);
      const missingPhotoIds = photoIds.filter(id => !foundPhotoIds.includes(id));
      for (const photoId of missingPhotoIds) {
        results.failed.push({
          photoId,
          error: 'Photo not found'
        });
        results.totalFailed++;
      }

      // Batch delete all allowed photos from database
      if (photosToDelete.length > 0) {
        await prisma.photo.deleteMany({
          where: {
            id: { in: photosToDelete }
          }
        });

        // Schedule R2 cleanup in background (don't block response)
        if (photoUrlsToDelete.length > 0) {
          setImmediate(async () => {
            for (const url of photoUrlsToDelete) {
              try {
                await cloudflareR2Service.deleteFileByUrl(url);
                console.log('Photo deleted from R2:', url);
              } catch (error) {
                console.error('R2 cleanup error:', error);
              }
            }
          });
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
            select: { createdBy: true, id: true }
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

      // Collect unique source album IDs BEFORE moving
      const sourceAlbumIds = [...new Set(photos.map(photo => photo.albumId).filter(Boolean))];

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
        photoIds,
        sourceAlbumIds, // Return source album IDs for cache invalidation
        targetAlbumId
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
        _count: true
      });

      // Get total file size with raw query
      const sizeResult = await prisma.$queryRaw`
        SELECT COALESCE(SUM(CAST(metadata->>'size' AS INTEGER)), 0) as total_size
        FROM "public"."photos"
        WHERE "albumId" = ${albumId}
          AND metadata->>'size' IS NOT NULL
      `;

      const totalSize = Number(sizeResult[0]?.total_size || 0);

      return {
        totalPhotos: stats._count,
        totalSize,
        totalSizeFormatted: this.formatFileSize(totalSize)
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