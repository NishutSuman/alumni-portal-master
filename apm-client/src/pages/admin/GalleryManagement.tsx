import { FC, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import {
  useGetAlbumsQuery,
  useDeleteAlbumMutation,
  useToggleArchiveAlbumMutation,
} from '../../store/api/galleryApi';
import AlbumCard from '../../components/common/UI/AlbumCard';
import LoadingSpinner from '../../components/common/UI/LoadingSpinner';
import CreateAlbumModal from '../../components/admin/Gallery/CreateAlbumModal';
import EditAlbumModal from '../../components/admin/Gallery/EditAlbumModal';
import AlbumPhotosView from '../../components/admin/Gallery/AlbumPhotosView';
import type { Album } from '../../types/gallery';

const GalleryManagement: FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [viewingAlbumId, setViewingAlbumId] = useState<string | null>(null);

  // API hooks
  const {
    data: albumsData,
    isLoading,
    isFetching,
    refetch,
  } = useGetAlbumsQuery({
    page: currentPage,
    limit: 12,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    includeArchived: showArchived,
  });

  const [deleteAlbum, { isLoading: isDeleting }] = useDeleteAlbumMutation();
  const [toggleArchive, { isLoading: isToggling }] = useToggleArchiveAlbumMutation();

  const albums = albumsData?.data.albums || [];
  const pagination = albumsData?.data.pagination;

  // Handlers
  const handleCreateAlbum = () => {
    setShowCreateModal(true);
  };

  const handleEditAlbum = (album: Album) => {
    setSelectedAlbum(album);
    setShowEditModal(true);
  };

  const handleViewAlbum = (album: Album) => {
    setViewingAlbumId(album.id);
  };

  const handleDeleteAlbum = async (album: Album) => {
    if (!confirm(`Are you sure you want to delete "${album.name}"? This will also delete all photos in this album.`)) {
      return;
    }

    try {
      await deleteAlbum(album.id).unwrap();
      toast.success('Album deleted successfully');
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to delete album');
    }
  };

  const handleToggleArchive = async (album: Album) => {
    try {
      await toggleArchive(album.id).unwrap();
      toast.success(album.isArchived ? 'Album unarchived' : 'Album archived');
      refetch();
    } catch (error: any) {
      toast.error(error?.data?.message || 'Failed to update album');
    }
  };

  const handleAlbumAction = (album: Album, action: 'edit' | 'delete' | 'archive' | 'view') => {
    switch (action) {
      case 'view':
        handleViewAlbum(album);
        break;
      case 'edit':
        handleEditAlbum(album);
        break;
      case 'delete':
        handleDeleteAlbum(album);
        break;
      case 'archive':
        handleToggleArchive(album);
        break;
    }
  };

  // If viewing an album, show the album photos view
  if (viewingAlbumId) {
    return (
      <AlbumPhotosView
        albumId={viewingAlbumId}
        onBack={() => setViewingAlbumId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Gallery Management
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage albums and photos
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleCreateAlbum}
                className="flex items-center gap-2 px-4 py-2 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Create Album</span>
              </button>
            </div>
          </div>

          {/* Filter */}
          <div className="mt-6 flex justify-end">
            {/* Archive Toggle */}
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setShowArchived(false)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  !showArchived
                    ? 'bg-guild-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setShowArchived(true)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                  showArchived
                    ? 'bg-guild-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Archived
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="large" />
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-16">
            <ChartBarIcon className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {showArchived ? 'No archived albums' : 'No active albums yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {showArchived
                ? 'You don\'t have any archived albums'
                : 'Create your first album to get started'}
            </p>
            {!showArchived && (
              <button
                onClick={handleCreateAlbum}
                className="inline-flex items-center gap-2 px-6 py-3 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors font-medium"
              >
                <PlusIcon className="w-5 h-5" />
                Create Album
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Albums Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onClick={() => handleViewAlbum(album)}
                  showActions={true}
                  onAction={(action) => handleAlbumAction(album, action)}
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
      <CreateAlbumModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          refetch();
        }}
      />

      <EditAlbumModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedAlbum(null);
        }}
        album={selectedAlbum}
        onSuccess={() => {
          setShowEditModal(false);
          setSelectedAlbum(null);
          refetch();
        }}
      />
    </div>
  );
};

export default GalleryManagement;
