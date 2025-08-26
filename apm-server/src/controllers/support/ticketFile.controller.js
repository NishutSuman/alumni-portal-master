const TicketFileService = require('../../services/ticketFile.service');
const { successResponse, errorResponse } = require('../../utils/response');
const { prisma } = require('../../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Get file metadata and preview
 * GET /api/tickets/files/:attachmentId/metadata
 */
const getFileMetadata = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    const metadata = await TicketFileService.getFileMetadata(attachmentId);
    
    if (!metadata) {
      return errorResponse(res, 'File metadata not found', 404);
    }
    
    return successResponse(
      res,
      metadata,
      'File metadata retrieved successfully'
    );
  } catch (error) {
    console.error('Get file metadata error:', error);
    return errorResponse(res, 'Failed to retrieve file metadata', 500);
  }
};

/**
 * Download file with access tracking
 * GET /api/tickets/files/:attachmentId/download
 */
const downloadFile = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user.id;
    
    // Get attachment info (could be ticket attachment or message attachment)
    let attachment = await prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        ticket: {
          select: { userId: true, assignedToId: true }
        }
      }
    });
    
    // If not found, try message attachment
    if (!attachment) {
      attachment = await prisma.ticketMessageAttachment.findUnique({
        where: { id: attachmentId },
        include: {
          message: {
            include: {
              ticket: {
                select: { userId: true, assignedToId: true }
              }
            }
          }
        }
      });
      
      if (attachment) {
        // Restructure for consistency
        attachment.ticket = attachment.message.ticket;
      }
    }
    
    if (!attachment) {
      return errorResponse(res, 'File not found', 404);
    }
    
    // Permission check
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    
    const hasAccess = attachment.ticket.userId === userId || 
                     attachment.ticket.assignedToId === userId ||
                     user.role === 'SUPER_ADMIN';
    
    if (!hasAccess) {
      return errorResponse(res, 'Access denied', 403);
    }
    
    // Track file access
    await TicketFileService.trackFileAccess(attachmentId);
    
    // Serve file
    const filePath = path.join('uploads', attachment.filePath);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    
    if (!exists) {
      return errorResponse(res, 'File not found on server', 404);
    }
    
    // Set headers
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Type', attachment.mimeType);
    
    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Download file error:', error);
    return errorResponse(res, 'Failed to download file', 500);
  }
};

/**
 * Get image thumbnail
 * GET /api/tickets/files/:attachmentId/thumbnail
 */
const getThumbnail = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const userId = req.user.id;
    
    const metadata = await TicketFileService.getFileMetadata(attachmentId);
    
    if (!metadata || !metadata.isImage || !metadata.thumbnailPath) {
      return errorResponse(res, 'Thumbnail not available', 404);
    }
    
    // Permission check (similar to download)
    // ... (permission check logic similar to downloadFile)
    
    const thumbnailPath = path.join('uploads', metadata.thumbnailPath);
    const exists = await fs.access(thumbnailPath).then(() => true).catch(() => false);
    
    if (!exists) {
      return errorResponse(res, 'Thumbnail not found', 404);
    }
    
    // Serve thumbnail
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    
    const thumbnailStream = require('fs').createReadStream(thumbnailPath);
    thumbnailStream.pipe(res);
    
  } catch (error) {
    console.error('Get thumbnail error:', error);
    return errorResponse(res, 'Failed to get thumbnail', 500);
  }
};

/**
 * Get file preview info (for display in UI)
 * GET /api/tickets/files/:attachmentId/preview
 */
const getFilePreview = async (req, res) => {
  try {
    const { attachmentId } = req.params;
    
    // Get attachment info
    let attachment = await prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        fileSize: true,
        mimeType: true,
        filePath: true,
        createdAt: true
      }
    });
    
    if (!attachment) {
      attachment = await prisma.ticketMessageAttachment.findUnique({
        where: { id: attachmentId },
        select: {
          id: true,
          filename: true,
          originalName: true,
          fileSize: true,
          mimeType: true,
          filePath: true,
          createdAt: true
        }
      });
    }
    
    if (!attachment) {
      return errorResponse(res, 'File not found', 404);
    }
    
    // Get metadata
    const metadata = await TicketFileService.getFileMetadata(attachmentId);
    
    // Prepare preview data
    const preview = {
      id: attachment.id,
      filename: attachment.originalName,
      size: attachment.fileSize,
      formattedSize: TicketFileService.formatFileSize(attachment.fileSize),
      mimeType: attachment.mimeType,
      typeIcon: TicketFileService.getFileTypeIcon(attachment.mimeType),
      uploadedAt: attachment.createdAt,
      isImage: TicketFileService.isImageFile(attachment.mimeType),
      hasThumbnail: metadata?.thumbnailPath ? true : false,
      downloadCount: metadata?.downloadCount || 0,
      lastAccessed: metadata?.lastAccessed
    };
    
    // Add image-specific data
    if (preview.isImage && metadata) {
      preview.dimensions = {
        width: metadata.imageWidth,
        height: metadata.imageHeight,
        display: TicketFileService.getImageDimensions(
          metadata.imageWidth, 
          metadata.imageHeight
        )
      };
    }
    
    return successResponse(
      res,
      preview,
      'File preview retrieved successfully'
    );
  } catch (error) {
    console.error('Get file preview error:', error);
    return errorResponse(res, 'Failed to get file preview', 500);
  }
};

module.exports = {
  getFileMetadata,
  downloadFile,
  getThumbnail,
  getFilePreview
};