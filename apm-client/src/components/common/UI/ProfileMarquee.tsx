// src/components/common/UI/ProfileMarquee.tsx
import React, { useMemo } from 'react';
import Marquee, { MarqueeImage } from './Marquee';
import { useGetMarqueeProfilesQuery } from '@/store/api/marqueeApi';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

interface ProfileMarqueeProps {
  speed?: 'slow' | 'medium' | 'fast';
  className?: string;
}

const ProfileMarquee: React.FC<ProfileMarqueeProps> = ({
  speed = 'medium',
  className = ''
}) => {
  const { data: marqueeImages, isLoading, error } = useGetMarqueeProfilesQuery();
  const { user } = useSelector((state: RootState) => state.auth);

  // Add logged-in user's picture if not already in the list
  const finalImages = useMemo(() => {
    if (!marqueeImages || marqueeImages.length === 0) return [];

    // If no user logged in, return all images from backend
    if (!user?.id || !user?.profileImage) {
      return marqueeImages;
    }

    // Check if user's image already in the list
    const hasUserImage = marqueeImages.some(img => img.id === user.id);

    if (hasUserImage) {
      return marqueeImages; // Already included
    }

    // Replace last dummy image with user's profile (if dummies exist)
    const modifiedImages = [...marqueeImages];

    // Find last dummy index manually (findLastIndex not available in older TS versions)
    let lastDummyIndex = -1;
    for (let i = modifiedImages.length - 1; i >= 0; i--) {
      if (modifiedImages[i].type === 'dummy') {
        lastDummyIndex = i;
        break;
      }
    }

    if (lastDummyIndex !== -1) {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      modifiedImages[lastDummyIndex] = {
        id: user.id,
        type: 'real',
        profileImage: `${baseUrl}/api/users/profile-picture/${user.id}`
      };
    }

    return modifiedImages;
  }, [marqueeImages, user]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`w-full py-8 ${className}`}>
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading alumni...</span>
        </div>
      </div>
    );
  }

  // Error state - log but still try to show something
  if (error) {
    console.error('Marquee error:', error);
    // Don't return null immediately - check if we have cached data
  }

  // No images - show a placeholder message instead of nothing
  if (!finalImages || finalImages.length === 0) {
    // Only hide if there's no error (error might mean network issue)
    if (!error) {
      return null; // Don't show marquee if no images and no error
    }
    // If there's an error, show a subtle loading indicator
    return (
      <div className={`w-full py-4 ${className}`}>
        <div className="flex justify-center items-center text-gray-400 dark:text-gray-600 text-sm">
          <span>Loading alumni profiles...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <Marquee images={finalImages} speed={speed} />
    </div>
  );
};

export default ProfileMarquee;
