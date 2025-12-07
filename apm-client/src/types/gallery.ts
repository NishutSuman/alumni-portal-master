// Gallery/Photo/Album Type Definitions

export interface Album {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  isArchived: boolean;
  createdBy: string;
  creator: {
    id: string;
    fullName: string;
    profilePicture: string | null;
  };
  _count?: {
    photos: number;
  };
  totalSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  url: string;
  caption: string | null;
  tags: string[]; // Array of user IDs
  metadata: PhotoMetadata;
  albumId: string | null;
  album?: {
    id: string;
    name: string;
  };
  uploadedBy: string;
  uploader: {
    id: string;
    fullName: string;
    profilePicture: string | null;
  };
  taggedUsers?: Array<{
    id: string;
    fullName: string;
    profilePicture: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoMetadata {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  format: string;
  sizeFormatted: string;
  dimensions?: {
    width: number;
    height: number;
  } | null;
}

export interface AlbumStats {
  totalPhotos: number;
  totalSize: number;
  totalSizeFormatted: string;
  formats: Record<string, number>;
  recentPhotos: Photo[];
}

export interface PhotoStats {
  totalPhotos: number;
  totalAlbums: number;
  totalSize: number;
  totalSizeFormatted: string;
  formatBreakdown: Record<string, number>;
  recentUploads: number;
}

export interface UserPhotoStats {
  userId: string;
  totalPhotos: number;
  totalSize: number;
  totalSizeFormatted: string;
  albumsContributed: number;
  recentUploads: Photo[];
}

// Request/Response Types
export interface GetAlbumsParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
}

export interface GetAlbumsResponse {
  success: boolean;
  data: {
    albums: Album[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message: string;
}

export interface GetAlbumResponse {
  success: boolean;
  data: {
    album: Album;
    photos?: Photo[];
    photoPagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message: string;
}

export interface CreateAlbumData {
  name: string;
  description?: string;
  coverImage?: File;
}

export interface UpdateAlbumData {
  name?: string;
  description?: string;
  isArchived?: boolean;
  coverImage?: File;
}

export interface GetPhotosParams {
  page?: number;
  limit?: number;
  albumId?: string;
  search?: string;
  uploadedBy?: string;
}

export interface GetPhotosResponse {
  success: boolean;
  data: {
    photos: Photo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message: string;
}

export interface UploadPhotoData {
  photo: File;
  caption?: string;
  tags?: string[];
}

export interface BulkUploadPhotosData {
  photos: File[];
  bulkCaption?: string;
}

export interface UpdatePhotoData {
  caption?: string;
  tags?: string[];
}

export interface BulkDeletePhotosData {
  photoIds: string[];
}

export interface MovePhotosData {
  photoIds: string[];
  targetAlbumId: string;
}

export interface SearchPhotosParams {
  query?: string;
  albumId?: string;
  tags?: string[];
  uploadedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface SetCoverData {
  photoId: string;
}

// UI State Types
export interface SelectedPhoto {
  id: string;
  url: string;
}

export interface GalleryViewMode {
  mode: 'albums' | 'photos';
  albumId?: string;
}

export interface PhotoSelectionState {
  isSelectionMode: boolean;
  selectedPhotoIds: string[];
}
