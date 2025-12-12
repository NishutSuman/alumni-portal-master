import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { getApiUrl } from '@/utils/helpers';

interface PostImageDisplayProps {
  postId: string;
  heroImage?: string | null;
  images: string[];
  title: string;
}

const PostImageDisplay: React.FC<PostImageDisplayProps> = ({
  postId,
  heroImage,
  images,
  title
}) => {
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Combine hero image and additional images for the carousel
  const allImages = [
    ...(heroImage ? [getApiUrl(`/api/posts/${postId}/hero-image`)] : []),
    ...images.map((_, index) => getApiUrl(`/api/posts/${postId}/images/${index}`))
  ];

  const openImageViewer = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setImageViewerOpen(true);
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewerOpen(false);
  }, []);

  const navigateImage = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedImageIndex((prev) =>
        prev === 0 ? allImages.length - 1 : prev - 1
      );
    } else {
      setSelectedImageIndex((prev) =>
        prev === allImages.length - 1 ? 0 : prev + 1
      );
    }
  }, [allImages.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!imageViewerOpen) return;

    switch (e.key) {
      case 'ArrowLeft':
        navigateImage('prev');
        break;
      case 'ArrowRight':
        navigateImage('next');
        break;
      case 'Escape':
        closeImageViewer();
        break;
    }
  }, [imageViewerOpen, navigateImage, closeImageViewer]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!heroImage && (!images || images.length === 0)) {
    return null;
  }

  return (
    <>
      <div className="mb-4 -mx-4">
        {/* Hero Image - Always displayed prominently */}
        {heroImage && (
          <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer">
            <img
              src={getApiUrl(`/api/posts/${postId}/hero-image`)}
              alt={title}
              className="w-full h-auto object-contain max-h-80"
              style={{ minHeight: '200px' }}
              onClick={() => openImageViewer(0)}
              onLoad={(e) => {
                const target = e.target as HTMLImageElement;
                const aspectRatio = target.naturalWidth / target.naturalHeight;
                if (aspectRatio > 2.5) {
                  target.className = "w-full h-64 object-cover cursor-pointer";
                } else if (aspectRatio < 0.6) {
                  target.className = "w-full h-auto object-contain max-h-96 mx-auto cursor-pointer";
                  target.parentElement!.style.display = 'flex';
                  target.parentElement!.style.justifyContent = 'center';
                } else {
                  target.className = "w-full h-auto object-contain max-h-80 cursor-pointer";
                }
              }}
            />

            {/* Image counter overlay */}
            {images.length > 0 && (
              <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-sm flex items-center space-x-1">
                <PhotoIcon className="h-4 w-4" />
                <span>{allImages.length}</span>
              </div>
            )}
          </div>
        )}

        {/* Additional Images Stack - Only if there are more images beyond hero */}
        {images.length > 0 && (
          <div className="px-4 mt-3">
            {!heroImage && (
              /* If no hero image, show first additional image as main */
              <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-800 rounded-lg mb-3 cursor-pointer">
                <img
                  src={getApiUrl(`/api/posts/${postId}/images/0`)}
                  alt={`${title} - Image 1`}
                  className="w-full h-auto object-contain max-h-80"
                  onClick={() => openImageViewer(0)}
                  onLoad={(e) => {
                    const target = e.target as HTMLImageElement;
                    const aspectRatio = target.naturalWidth / target.naturalHeight;
                    if (aspectRatio > 2.5) {
                      target.className = "w-full h-64 object-cover cursor-pointer";
                    } else if (aspectRatio < 0.6) {
                      target.className = "w-full h-auto object-contain max-h-96 mx-auto cursor-pointer";
                      target.parentElement!.style.display = 'flex';
                      target.parentElement!.style.justifyContent = 'center';
                    } else {
                      target.className = "w-full h-auto object-contain max-h-80 cursor-pointer";
                    }
                  }}
                />

                {/* Image counter overlay */}
                <div className="absolute top-3 right-3 bg-black bg-opacity-60 text-white px-2 py-1 rounded-full text-sm flex items-center space-x-1">
                  <PhotoIcon className="h-4 w-4" />
                  <span>{images.length}</span>
                </div>
              </div>
            )}

            {/* Image thumbnails/stack */}
            {(heroImage ? images.length > 0 : images.length > 1) && (
              <div className="flex space-x-2 overflow-x-auto pb-2">
                {(heroImage ? images : images.slice(1)).map((_, index) => {
                  const imageIndex = heroImage ? index : index + 1;
                  const carouselIndex = heroImage ? index + 1 : index + 1;

                  return (
                    <div
                      key={imageIndex}
                      className="relative flex-shrink-0 w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => openImageViewer(carouselIndex)}
                    >
                      <img
                        src={getApiUrl(`/api/posts/${postId}/images/${imageIndex}`)}
                        alt={`${title} - Image ${imageIndex + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Show count on last thumbnail if there are more images */}
                      {index === 4 && (heroImage ? images.length > 5 : images.length > 6) && (
                        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            +{heroImage ? images.length - 5 : images.length - 6}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen Image Viewer Modal */}
      <AnimatePresence>
        {imageViewerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
            onClick={closeImageViewer}
          >
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* Close button */}
              <button
                onClick={closeImageViewer}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              {/* Image counter */}
              <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                {selectedImageIndex + 1} / {allImages.length}
              </div>

              {/* Previous button */}
              {allImages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('prev');
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
              )}

              {/* Next button */}
              {allImages.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage('next');
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              )}

              {/* Main image */}
              <motion.img
                key={selectedImageIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                src={allImages[selectedImageIndex]}
                alt={`${title} - Image ${selectedImageIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PostImageDisplay;
