// src/components/common/UI/Marquee.tsx
import React, { useState } from 'react';
import { getApiUrl } from '@/utils/helpers';

export interface MarqueeImage {
  id: string;
  profileImage: string;
  type?: 'real' | 'dummy';
}

interface MarqueeProps {
  images: MarqueeImage[];
  speed?: 'slow' | 'medium' | 'fast';
  pauseOnHover?: boolean;
  className?: string;
}

// Fallback placeholder for failed images
const PLACEHOLDER_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij48Y2lyY2xlIGN4PSIzMiIgY3k9IjMyIiByPSIzMiIgZmlsbD0iI2U1ZTdlYiIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMjQiIHI9IjEwIiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTEyIDU2YzAtMTEuMDQ2IDguOTU0LTIwIDIwLTIwczIwIDguOTU0IDIwIDIwIiBmaWxsPSIjOWNhM2FmIi8+PC9zdmc+';

const Marquee: React.FC<MarqueeProps> = ({
  images,
  speed = 'medium',
  pauseOnHover = true,
  className = ''
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Handle image load error
  const handleImageError = (imageId: string) => {
    setFailedImages(prev => new Set(prev).add(imageId));
  };

  // Get the image URL - use placeholder if image failed to load
  const getImageSrc = (img: MarqueeImage): string => {
    if (failedImages.has(img.id)) {
      return PLACEHOLDER_AVATAR;
    }
    return getApiUrl(img.profileImage);
  };

  // Split images into two rows (15 each)
  const row1Images = images.slice(0, 15);
  const row2Images = images.slice(15, 30);

  // Speed mapping - faster scroll with very long reset time
  const speedMap = {
    slow: '90s',     // 1.5 minutes - slower but smooth
    medium: '60s',   // 1 minute - fast and smooth, no visible reset
    fast: '40s'      // 40 seconds - very fast
  };

  const animationDuration = speedMap[speed];

  // Triple duplication is optimal - fast speed, no visible duplicates, seamless loop
  const duplicatedRow1 = [...row1Images, ...row1Images, ...row1Images];
  const duplicatedRow2 = [...row2Images, ...row2Images, ...row2Images];

  return (
    <div className={`w-full overflow-hidden relative ${className}`}>
      {/* Left Fade Effect */}
      <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 md:w-48 bg-gradient-to-r from-white dark:from-gray-800 to-transparent z-10 pointer-events-none" />

      {/* Right Fade Effect */}
      <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 md:w-48 bg-gradient-to-l from-white dark:from-gray-800 to-transparent z-10 pointer-events-none" />

      {/* Row 1 - Scroll Left to Right */}
      <div
        className="flex mb-6 pt-2"
        onMouseEnter={() => pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      >
        <div
          className="flex gap-8 animate-marquee-ltr"
          style={{
            animationDuration,
            animationPlayState: isPaused ? 'paused' : 'running'
          }}
        >
          {duplicatedRow1.map((img, index) => (
            <div
              key={`${img.id}-${index}`}
              className="flex-shrink-0"
            >
              <img
                src={getImageSrc(img)}
                alt=""
                className="w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-white dark:ring-gray-700 hover:scale-110 transition-transform duration-300"
                loading="lazy"
                onError={() => handleImageError(img.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 - Scroll Right to Left */}
      <div
        className="flex pb-2"
        onMouseEnter={() => pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      >
        <div
          className="flex gap-8 animate-marquee-rtl"
          style={{
            animationDuration,
            animationPlayState: isPaused ? 'paused' : 'running'
          }}
        >
          {duplicatedRow2.map((img, index) => (
            <div
              key={`${img.id}-${index}`}
              className="flex-shrink-0"
            >
              <img
                src={getImageSrc(img)}
                alt=""
                className="w-16 h-16 rounded-full object-cover shadow-lg ring-2 ring-white dark:ring-gray-700 hover:scale-110 transition-transform duration-300"
                loading="lazy"
                onError={() => handleImageError(img.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Add animation keyframes to global CSS */}
      <style>{`
        @keyframes marquee-ltr {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333333%);
          }
        }

        @keyframes marquee-rtl {
          0% {
            transform: translateX(-33.333333%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .animate-marquee-ltr {
          animation: marquee-ltr linear infinite;
        }

        .animate-marquee-rtl {
          animation: marquee-rtl linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Marquee;
