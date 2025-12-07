import React, { useState, useEffect } from 'react';
import Lottie from 'lottie-react';
import { useSelector } from 'react-redux';
import { selectIsDark } from '@/store/slices/themeSlice';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  animated?: boolean;
}

const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  animated = false
}) => {
  const [animationData, setAnimationData] = useState(null);
  const [error, setError] = useState(false);
  const isDark = useSelector(selectIsDark);

  const sizeClasses = {
    xs: 'h-8 w-8',
    sm: 'h-12 w-12',
    md: 'h-16 w-16',
    lg: 'h-20 w-20',
    xl: 'h-24 w-24',
    '2xl': 'h-32 w-32'
  };

  // Load animation data when component mounts (only if animated)
  useEffect(() => {
    if (animated && !animationData && !error) {
      fetch('/brand/guild-logo-animation.json')
        .then(response => {
          if (!response.ok) throw new Error('Failed to load animation');
          return response.json();
        })
        .then(data => {
          setAnimationData(data);
        })
        .catch(err => {
          console.error('Failed to load GUILD logo animation:', err);
          setError(true);
        });
    }
  }, [animated, animationData, error]);

  // If animated and animation data is loaded
  if (animated && animationData && !error) {
    return (
      <div className={`${sizeClasses[size]} ${className} flex-shrink-0`}>
        <Lottie
          animationData={animationData}
          loop={false}
          autoplay={true}
          className={`${sizeClasses[size]} object-contain`}
        />
      </div>
    );
  }

  // Fallback to static image with dark mode support
  const logoSrc = isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png';

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0`}>
      <img
        src={logoSrc}
        alt="GUILD"
        className={`${sizeClasses[size]} object-contain`}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          // Fallback to default logo if specific one fails
          if (target.src.includes('white')) {
            target.src = '/brand/guild-logo.png';
          }
        }}
      />
    </div>
  );
};

export default BrandLogo;
