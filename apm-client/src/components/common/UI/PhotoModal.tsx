import { FC, Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import type { Photo } from '../../../types/gallery';
import { getApiUrl } from '@/utils/helpers';

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: Photo | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const PhotoModal: FC<PhotoModalProps> = ({
  isOpen,
  onClose,
  photo,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset image loaded state when photo changes
  useEffect(() => {
    if (photo) {
      setImageLoaded(false);
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 300);
      return () => clearTimeout(timer);
    }
  }, [photo?.id]);

  // Generate proxy URL for photo
  const getPhotoProxyUrl = (url: string): string => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const filename = url.split('/').pop();
      return getApiUrl(`/api/albums/photo/${filename}`);
    }
    return getApiUrl(`/api/albums/photo/${url}`);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious && onPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (hasNext && onNext) onNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrevious, hasNext, onPrevious, onNext, onClose]);

  if (!photo) return null;

  const photoUrl = getPhotoProxyUrl(photo.url);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-7xl transform transition-all">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute -top-12 right-0 sm:top-0 sm:-right-12 p-2 text-white hover:text-gray-300 transition-colors z-10"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-8 h-8" />
                </button>

                {/* Navigation Buttons */}
                {hasPrevious && onPrevious && (
                  <button
                    onClick={onPrevious}
                    disabled={isTransitioning}
                    className="absolute left-2 sm:-left-16 top-1/2 -translate-y-1/2 p-3 text-white hover:text-gray-300 transition-all bg-black/60 hover:bg-black/80 sm:bg-black/40 sm:hover:bg-black/60 rounded-full backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                    aria-label="Previous photo"
                  >
                    <ChevronLeftIcon className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
                  </button>
                )}

                {hasNext && onNext && (
                  <button
                    onClick={onNext}
                    disabled={isTransitioning}
                    className="absolute right-2 sm:-right-16 top-1/2 -translate-y-1/2 p-3 text-white hover:text-gray-300 transition-all bg-black/60 hover:bg-black/80 sm:bg-black/40 sm:hover:bg-black/60 rounded-full backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                    aria-label="Next photo"
                  >
                    <ChevronRightIcon className="w-6 h-6 sm:w-8 sm:h-8 group-hover:scale-110 transition-transform" />
                  </button>
                )}

                {/* Photo Container */}
                <div className="flex flex-col gap-4">
                  {/* Main Photo */}
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    {/* Loading Spinner */}
                    {!imageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                      </div>
                    )}

                    <img
                      src={photoUrl}
                      alt={photo.caption || 'Photo'}
                      className={`w-full max-h-[70vh] sm:max-h-[80vh] object-contain transition-opacity duration-300 ${
                        imageLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => setImageLoaded(true)}
                    />

                    {/* Image Counter */}
                    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium">
                      {photo.album?.name || 'Photo'}
                    </div>
                  </div>

                  {/* Photo Details */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Left: Caption */}
                      <div className="flex-1">
                        {photo.caption && (
                          <p className="text-lg text-gray-900 dark:text-white">{photo.caption}</p>
                        )}
                      </div>

                      {/* Right: File Size & Download */}
                      <div className="flex items-center gap-4">
                        {/* File Size */}
                        {photo.metadata?.sizeFormatted && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {photo.metadata.sizeFormatted}
                          </div>
                        )}

                        {/* Download Button */}
                        <a
                          href={photoUrl}
                          download={photo.metadata?.originalName || 'photo.jpg'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-guild-600 hover:bg-guild-700 text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Navigation Hint */}
                {(hasPrevious || hasNext) && (
                  <div className="text-center mt-4 text-white/60 text-sm flex items-center justify-center gap-4">
                    <span className="hidden sm:inline">Use arrow keys to navigate</span>
                    <span className="hidden sm:inline">•</span>
                    <span>ESC to close</span>
                    {(hasPrevious || hasNext) && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-2">
                          {hasPrevious && <span>← Prev</span>}
                          {hasPrevious && hasNext && <span>|</span>}
                          {hasNext && <span>Next →</span>}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default PhotoModal;
