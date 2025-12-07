import { FC, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowsRightLeftIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import {
  useGetAlbumQuery,
  useGetAlbumPhotosQuery,
  useDeletePhotoMutation,
  useBulkDeletePhotosMutation,
  useSetAlbumCoverMutation,
} from '../../../store/api/galleryApi';
import PhotoCard from '../../common/UI/PhotoCard';
import PhotoModal from '../../common/UI/PhotoModal';
import LoadingSpinner from '../../common/UI/LoadingSpinner';
import EditPhotoModal from './EditPhotoModal';
import MovePhotosModal from './MovePhotosModal';
import UploadPhotosModal from './UploadPhotosModal';
import type { Album, Photo } from '../../../types/gallery';

interface AlbumPhotosViewProps {
  albumId: string;
  onBack: () => void;
}

const AlbumPhotosView: FC<AlbumPhotosViewProps> = ({ albumId, onBack }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // API hooks
  const { data: albumData, isLoading: loadingAlbum } = useGetAlbumQuery({
    albumId,
    includePhotos: false,
  });

  const {
    data: photosData,
    isLoading: loadingPhotos,
    isFetching,
    refetch,
  } = useGetAlbumPhotosQuery({
    albumId,
    page: currentPage,
    limit: 24,
  });

  const [deletePhoto, { isLoading: isDeleting }] = useDeletePhotoMutation();
  const [bulkDeletePhotos, { isLoading: isBulkDeleting }] = useBulkDeletePhotosMutation();
  const [setAlbumCover, { isLoading: isSettingCover }] = useSetAlbumCoverMutation();

  const album = albumData?.data.album;
  const photos = photosData?.data.photos || [];
  const pagination = photosData?.data.pagination;

  // Handlers
  const handleToggleSelection = (photoId: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPhotoIds.length === photos.length) {
      setSelectedPhotoIds([]);
    } else {
      setSelectedPhotoIds(photos.map((p) => p.id));
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedPhotoIds([]);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await deletePhoto({ albumId, photoId }).unwrap();
      toast.success('Photo deleted');
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete photo');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotoIds.length === 0) return;

    if (!confirm(`Delete ${selectedPhotoIds.length} selected photos?`)) return;

    try {
      const result = await bulkDeletePhotos({
        albumId,
        data: { photoIds: selectedPhotoIds },
      }).unwrap();

      toast.success(`Deleted ${result.data.deleted} photos`);
      setSelectedPhotoIds([]);
      setSelectionMode(false);
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete photos');
    }
  };

  const handleSetCover = async (photoId: string) => {
    try {
      await setAlbumCover({
        albumId,
        data: { photoId },
      }).unwrap();

      toast.success('Album cover updated');
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to set cover');
    }
  };

  const handlePhotoAction = (photo: Photo, action: 'edit' | 'delete') => {
    switch (action) {
      case 'edit':
        setEditingPhoto(photo);
        break;
      case 'delete':
        handleDeletePhoto(photo.id);
        break;
    }
  };

  const handleViewPhoto = (photo: Photo) => {
    if (selectionMode) {
      handleToggleSelection(photo.id);
    } else {
      setViewingPhoto(photo);
    }
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Back Button & Title */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-guild-600 dark:hover:text-guild-400 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Albums</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {album.name}
              </h1>
              {album.description && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{album.description}</p>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                {album._count?.photos || 0} photos
              </p>
            </div>

            {/* Actions */}
            {!selectionMode ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <CloudArrowUpIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Upload Photos</span>
                </button>

                {photos.length > 0 && (
                  <button
                    onClick={() => setSelectionMode(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    <span className="hidden sm:inline">Select Photos</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {selectedPhotoIds.length} selected
                </span>

                <button
                  onClick={handleSelectAll}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {selectedPhotoIds.length === photos.length ? 'Deselect All' : 'Select All'}
                </button>

                {selectedPhotoIds.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowMoveModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <ArrowsRightLeftIcon className="w-4 h-4" />
                      Move
                    </button>

                    <button
                      onClick={handleBulkDelete}
                      disabled={isBulkDeleting}
                      className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}

                <button
                  onClick={handleCancelSelection}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingPhotos ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="large" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16">
            <CloudArrowUpIcon className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No photos yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Upload your first photos to this album
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors font-medium"
            >
              <CloudArrowUpIcon className="w-5 h-5" />
              Upload Photos
            </button>
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
                  onAction={(action) => handlePhotoAction(photo, action)}
                  showActions={!selectionMode}
                  selectionMode={selectionMode}
                  isSelected={selectedPhotoIds.includes(photo.id)}
                  onToggleSelect={() => handleToggleSelection(photo.id)}
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

      {/* Modals */}
      <PhotoModal
        isOpen={!!viewingPhoto}
        onClose={() => setViewingPhoto(null)}
        photo={viewingPhoto}
        onPrevious={handlePreviousPhoto}
        onNext={handleNextPhoto}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
      />

      <EditPhotoModal
        isOpen={!!editingPhoto}
        onClose={() => setEditingPhoto(null)}
        photo={editingPhoto}
        albumId={albumId}
        onSuccess={() => {
          setEditingPhoto(null);
          refetch();
        }}
      />

      <MovePhotosModal
        isOpen={showMoveModal}
        onClose={() => setShowMoveModal(false)}
        currentAlbumId={albumId}
        photoIds={selectedPhotoIds}
        onSuccess={() => {
          setShowMoveModal(false);
          setSelectedPhotoIds([]);
          setSelectionMode(false);
          refetch();
        }}
      />

      <UploadPhotosModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        preselectedAlbumId={albumId}
        onSuccess={() => {
          setShowUploadModal(false);
          refetch();
        }}
      />
    </div>
  );
};

export default AlbumPhotosView;
