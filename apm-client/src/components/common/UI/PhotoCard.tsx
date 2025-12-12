import { FC, useState, useEffect, useRef } from 'react';
import { UserIcon, CalendarIcon, ChatBubbleLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { Photo } from '../../../types/gallery';
import { getApiUrl } from '@/utils/helpers';

interface PhotoCardProps {
  photo: Photo;
  onClick?: () => void;
  onAction?: (action: 'edit' | 'delete') => void;
  showActions?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const PhotoCard: FC<PhotoCardProps> = ({
  photo,
  onClick,
  onAction,
  showActions = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
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

  // Generate proxy URL for photo (same pattern as profile pictures and album covers)
  const getPhotoProxyUrl = (url: string): string => {
    // If URL is a full R2 URL, extract filename and use proxy
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const filename = url.split('/').pop();
      return getApiUrl(`/api/albums/photo/${filename}`);
    }
    // If it's already a filename, use proxy
    return getApiUrl(`/api/albums/photo/${url}`);
  };

  const photoUrl = getPhotoProxyUrl(photo.url);

  return (
    <div
      ref={cardRef}
      className="group relative bg-gray-100 dark:bg-gray-700 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-700"
      onClick={selectionMode ? onToggleSelect : onClick}
    >
      {/* Photo Image - Full size without info section */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {!isVisible ? (
          // Skeleton loader before image enters viewport
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer"></div>
          </div>
        ) : (
          <>
            {/* Loading spinner while image is loading */}
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-guild-600"></div>
              </div>
            )}

            {imageError ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <PhotoIcon className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-xs">Failed to load</p>
                </div>
              </div>
            ) : (
              <img
                src={photoUrl}
                alt={photo.caption || 'Photo'}
                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            )}
          </>
        )}

        {/* Selection Checkbox */}
        {selectionMode && (
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
          >
            <div
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-guild-600 border-guild-600'
                  : 'bg-white/80 backdrop-blur-sm border-gray-300'
              }`}
            >
              {isSelected && <CheckCircleIcon className="w-5 h-5 text-white" />}
            </div>
          </div>
        )}

        {/* Caption Overlay - Only show on hover if caption exists */}
        {photo.caption && !selectionMode && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-sm line-clamp-2">{photo.caption}</p>
          </div>
        )}

        {/* Action Buttons (Admin Only) - Positioned in corners on hover */}
        {showActions && onAction && !selectionMode && (
          <>
            {/* Delete Button - Top Right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction('delete');
              }}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg z-10"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// Photo Icon placeholder
const PhotoIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export default PhotoCard;
