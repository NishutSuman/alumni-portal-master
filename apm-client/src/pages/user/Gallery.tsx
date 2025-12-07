import { FC, useState } from 'react';
import { RectangleStackIcon } from '@heroicons/react/24/outline';
import { useGetAlbumsQuery } from '../../store/api/galleryApi';
import AlbumCard from '../../components/common/UI/AlbumCard';
import LoadingSpinner from '../../components/common/UI/LoadingSpinner';
import AlbumViewer from '../../components/user/Gallery/AlbumViewer';

const Gallery: FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingAlbumId, setViewingAlbumId] = useState<string | null>(null);

  // API hooks
  const {
    data: albumsData,
    isLoading: loadingAlbums,
    isFetching: fetchingAlbums,
  } = useGetAlbumsQuery({
    page: currentPage,
    limit: 12,
    includeArchived: false,
  });

  const albums = albumsData?.data.albums || [];
  const pagination = albumsData?.data.pagination;

  // If viewing an album, show the album viewer
  if (viewingAlbumId) {
    return (
      <AlbumViewer
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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Photo Gallery
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Browse albums and photos from our community
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingAlbums ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="large" />
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-16">
            <RectangleStackIcon className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No albums yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Albums will appear here once created
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onClick={() => setViewingAlbumId(album.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="mt-8 flex justify-center">
                <nav className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1 || fetchingAlbums}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    Previous
                  </button>

                  <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {pagination.pages}
                  </span>

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === pagination.pages || fetchingAlbums}
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
    </div>
  );
};

export default Gallery;
