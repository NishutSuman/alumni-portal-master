import { FC } from 'react';

interface SkeletonLoaderProps {
  variant?: 'photo' | 'album' | 'text' | 'circle' | 'rectangular';
  className?: string;
  count?: number;
}

const SkeletonLoader: FC<SkeletonLoaderProps> = ({ variant = 'rectangular', className = '', count = 1 }) => {
  const renderSkeleton = () => {
    switch (variant) {
      case 'photo':
        return (
          <div className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden ${className}`}>
            {/* Photo skeleton */}
            <div className="relative aspect-square bg-gray-200 dark:bg-gray-700 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer"></div>
            </div>
          </div>
        );

      case 'album':
        return (
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 ${className}`}>
            {/* Album cover skeleton */}
            <div className="relative h-48 sm:h-56 bg-gray-200 dark:bg-gray-700 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-shimmer"></div>
            </div>
            {/* Album info skeleton */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                </div>
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        );

      case 'circle':
        return <div className={`rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ${className}`}></div>;

      case 'text':
        return <div className={`h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`}></div>;

      case 'rectangular':
      default:
        return <div className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`}></div>;
    }
  };

  if (count === 1) {
    return renderSkeleton();
  }

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderSkeleton()}</div>
      ))}
    </>
  );
};

export default SkeletonLoader;
