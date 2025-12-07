import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';

interface BrandedLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullScreen?: boolean;
}

const BrandedLoader: React.FC<BrandedLoaderProps> = ({
  message = '',
  size = 'lg',
  fullScreen = true
}) => {
  const [animationData, setAnimationData] = useState(null);
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'h-32 w-32',
    md: 'h-40 w-40',
    lg: 'h-56 w-56',
    xl: 'h-72 w-72'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  // Load animation data
  useEffect(() => {
    if (!animationData) {
      fetch('/brand/guild-loader.json')
        .then(response => response.json())
        .then(data => setAnimationData(data))
        .catch(err => {
          console.error('Failed to load GUILD loader animation:', err);
          setError(true);
        });
    }
  }, [animationData]);

  const containerClasses = fullScreen
    ? 'flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900'
    : 'flex items-center justify-center p-8';

  // Fallback spinner if animation fails to load
  if (error || !animationData) {
    return (
      <div className={containerClasses}>
        <div className="text-center">
          <div className={`animate-spin rounded-full ${sizeClasses[size]} border-b-2 border-blue-600 mx-auto mb-4`}></div>
          {message && (
            <p className={`${textSizeClasses[size]} text-gray-600 dark:text-gray-400 font-medium`}>
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
          className={`${sizeClasses[size]} mx-auto`}
        />
        {message && (
          <p className={`${textSizeClasses[size]} text-gray-600 dark:text-gray-400 font-medium mt-4`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandedLoader;
