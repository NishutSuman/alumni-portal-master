import { FC, useState, useEffect, useRef } from 'react';
import { PhotoIcon, CalendarIcon, UserIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import type { Album } from '../../../types/gallery';

interface AlbumCardProps {
  album: Album;
  onClick?: () => void;
  onAction?: (action: 'edit' | 'delete' | 'archive' | 'view') => void;
  showActions?: boolean;
}

const AlbumCard: FC<AlbumCardProps> = ({ album, onClick, onAction, showActions = false }) => {
  const [imageError, setImageError] = useState(false);
  const [coverImageLoaded, setCoverImageLoaded] = useState(false);
  const [profileImageLoaded, setProfileImageLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01,
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);
  const photoCount = album._count?.photos || 0;
  const totalSize = album.totalSize || 0;
  const formattedSize = totalSize > 0 ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB` : '0 MB';

  // Generate proxy URL for album cover with cache-busting timestamp
  const coverImageUrl = album.coverImage
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/albums/cover/${album.id}?t=${new Date(album.updatedAt).getTime()}`
    : null;

  // Generate proxy URL for creator profile picture
  const creatorProfilePictureUrl = album.creator?.id
    ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/users/profile-picture/${album.creator.id}`
    : null;

  return (
    <div
      ref={cardRef}
      className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-700"
      onClick={onClick}
    >
      {/* Cover Image */}
      <div className="relative h-48 sm:h-56 bg-gradient-to-br from-guild-500/20 to-guild-600/20 dark:from-guild-400/10 dark:to-guild-500/10 overflow-hidden">
        {!isVisible ? (
          // Skeleton loader before entering viewport
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer"></div>
          </div>
        ) : coverImageUrl ? (
          <>
            {/* Loading skeleton while image loads */}
            {!coverImageLoaded && (
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer"></div>
              </div>
            )}
            <img
              src={coverImageUrl}
              alt={album.name}
              className={`w-full h-full object-cover group-hover:scale-110 transition-all duration-500 ${
                coverImageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setCoverImageLoaded(true)}
              onError={() => setCoverImageLoaded(true)} // Still mark as loaded to show fallback
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PhotoIcon className="w-20 h-20 text-gray-300 dark:text-gray-600" />
          </div>
        )}

        {/* Archive Badge */}
        {album.isArchived && (
          <div className="absolute top-3 right-3 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-medium">
            Archived
          </div>
        )}

        {/* Photo Count Badge */}
        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
          <PhotoIcon className="w-4 h-4" />
          {photoCount}
        </div>
      </div>

      {/* Album Info */}
      <div className="p-4 sm:p-5">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 truncate group-hover:text-guild-600 dark:group-hover:text-guild-400 transition-colors">
          {album.name}
        </h3>

        {album.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {album.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            {!imageError && creatorProfilePictureUrl && isVisible ? (
              <>
                {/* Skeleton for profile picture */}
                {!profileImageLoaded && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                )}
                <img
                  src={creatorProfilePictureUrl}
                  alt={album.creator.fullName}
                  className={`w-6 h-6 rounded-full object-cover border border-gray-200 dark:border-gray-600 ${
                    profileImageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setProfileImageLoaded(true)}
                  onError={() => {
                    setImageError(true);
                    setProfileImageLoaded(true);
                  }}
                  style={{ display: profileImageLoaded ? 'block' : 'none' }}
                />
              </>
            ) : (
              <UserCircleIcon className="w-6 h-6 text-gray-400" />
            )}
            <span className="truncate max-w-[120px]">{album.creator.fullName}</span>
          </div>

          <div className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            <span>{new Date(album.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Size Info */}
        {totalSize > 0 && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Total size: {formattedSize}
          </div>
        )}

        {/* Action Buttons (Admin Only) */}
        {showActions && onAction && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction('edit');
              }}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction('archive');
              }}
              className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {album.isArchived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction('delete');
              }}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumCard;
