import React from 'react';
import { getApiUrl } from '@/utils/helpers';

interface OrganizationLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showFallback?: boolean;
  fallbackText?: string;
}

const OrganizationLogo: React.FC<OrganizationLogoProps> = ({
  size = 'md',
  className = '',
  showFallback = true,
  fallbackText = 'LOGO'
}) => {
  const sizeClasses = {
    xs: 'h-6 w-6',
    sm: 'h-8 w-8', 
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
    '2xl': 'h-20 w-20'
  };

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg', 
    xl: 'text-xl',
    '2xl': 'text-2xl'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} flex-shrink-0`}>
      <img
        src={getApiUrl("/api/organization/files/logo")}
        alt="Organization Logo"
        className={`${sizeClasses[size]} object-contain rounded-lg`}
        onError={(e) => {
          if (showFallback) {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            
            // Create fallback element if it doesn't exist
            let fallback = target.nextElementSibling as HTMLElement;
            if (!fallback || !fallback.classList.contains('logo-fallback')) {
              fallback = document.createElement('div');
              fallback.className = `logo-fallback ${sizeClasses[size]} bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-center`;
              fallback.innerHTML = `<span class="${textSizeClasses[size]} text-gray-500 dark:text-gray-400 font-medium">${fallbackText}</span>`;
              target.parentNode?.appendChild(fallback);
            }
            fallback.style.display = 'flex';
          }
        }}
        onLoad={(e) => {
          // Hide fallback when real image loads
          const target = e.target as HTMLImageElement;
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback && fallback.classList.contains('logo-fallback')) {
            fallback.style.display = 'none';
          }
          target.style.display = 'block';
        }}
      />
    </div>
  );
};

export default OrganizationLogo;