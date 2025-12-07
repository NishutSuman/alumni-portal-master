import { FC, useState } from 'react';
import { ArrowLeftIcon, UserIcon, CalendarIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useGetAlbumQuery, useGetAlbumPhotosQuery } from '../../../store/api/galleryApi';
import PhotoCard from '../../common/UI/PhotoCard';
import PhotoModal from '../../common/UI/PhotoModal';
import LoadingSpinner from '../../common/UI/LoadingSpinner';
import type { Photo } from '../../../types/gallery';

interface AlbumViewerProps {
  albumId: string;
  onBack: () => void;
}

const AlbumViewer: FC<AlbumViewerProps> = ({ albumId, onBack }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [imageError, setImageError] = useState(false);
  const [coverImageLoaded, setCoverImageLoaded] = useState(false);

  // API hooks
  const { data: albumData, isLoading: loadingAlbum } = useGetAlbumQuery({
    albumId,
    includePhotos: false,
  });

  const {
    data: photosData,
    isLoading: loadingPhotos,
    isFetching,
  } = useGetAlbumPhotosQuery({
    albumId,
    page: currentPage,
    limit: 24,
  });

  const album = albumData?.data.album;
  const photos = photosData?.data.photos || [];
  const pagination = photosData?.data.pagination;

  const handleViewPhoto = (photo: Photo) => {
    setViewingPhoto(photo);
  };

  const currentPhotoIndex = viewingPhoto ? photos.findIndex((p) => p.id === viewingPhoto.id) : -1;
  const hasPrevious = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex < photos.length - 1;

  const handlePreviousPhoto = () => {
    if (hasPrevious) {
      setViewingPhoto(photos[currentPhotoIndex - 1]);
    }
  };

  const handleNextPhoto = () => {
    if (hasNext) {
      setViewingPhoto(photos[currentPhotoIndex + 1]);
    }
  };

  if (loadingAlbum || !album) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-guild-600 dark:hover:text-guild-400 transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back to Gallery</span>
          </button>

          {/* Album Info */}
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Cover Image */}
            {album.coverImage && (
              <div className="w-full sm:w-64 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 relative">
                {/* Loading skeleton */}
                {!coverImageLoaded && (
                  <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer"></div>
                  </div>
                )}
                <img
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/albums/cover/${albumId}?t=${new Date(album.updatedAt).getTime()}`}
                  alt={album.name}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    coverImageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setCoverImageLoaded(true)}
                  onError={() => setCoverImageLoaded(true)}
                />
              </div>
            )}

            {/* Album Details */}
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {album.name}
              </h1>

              {album.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">{album.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {/* Creator */}
                <div className="flex items-center gap-2">
                  {!imageError && album.creator?.id ? (
                    <img
                      src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/profile-picture/${album.creator.id}`}
                      alt={album.creator.fullName}
                      className="w-6 h-6 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <UserCircleIcon className="w-6 h-6 text-gray-400" />
                  )}
                  <span>Created by {album.creator.fullName}</span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  <span>{new Date(album.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Photo Count */}
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{album._count?.photos || 0} photos</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingPhotos ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="large" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No photos in this album
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Photos will appear here once uploaded
            </p>
          </div>
        ) : (
          <>
            {/* Photos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onClick={() => handleViewPhoto(photo)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-8 flex justify-center">
                <nav className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1 || isFetching}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Previous
                  </button>

                  <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {pagination.pages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === pagination.pages || isFetching}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo Modal */}
      <PhotoModal
        isOpen={!!viewingPhoto}
        onClose={() => setViewingPhoto(null)}
        photo={viewingPhoto}
        onPrevious={handlePreviousPhoto}
        onNext={handleNextPhoto}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
      />
    </div>
  );
};

export default AlbumViewer;
