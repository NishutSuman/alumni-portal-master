import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  SunIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import BirthdaysCard from '../../components/user/celebrations/BirthdaysCard';
import FestivalsCard from '../../components/user/celebrations/FestivalsCard';
import SocialSection from '../../components/user/SocialSection';
import AlumniStorySection from '../../components/user/AlumniStorySection';
import EventsComingSoon from '../../components/user/EventsComingSoon';
import ProfileMarquee from '../../components/common/UI/ProfileMarquee';
import AnnouncementBanner from '../../components/common/UI/AnnouncementBanner';

const UserDashboard = () => {
  const { user } = useAuth();

  const isVerified = user?.isAlumniVerified;
  const isPending = user?.pendingVerification;

  // Get current time and greeting
  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { greeting: 'Good morning', icon: SunIcon };
    if (hour < 17) return { greeting: 'Good afternoon', icon: SunIcon };
    return { greeting: 'Good evening', icon: SunIcon };
  };

  const { greeting, icon: GreetingIcon } = getCurrentGreeting();
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Announcement Banner - Shows active announcements */}
      <AnnouncementBanner />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header with Gradient Background */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg overflow-hidden mb-8"
        >
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative px-6 py-8 sm:px-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 text-white/80 text-sm mb-2">
                  <GreetingIcon className="h-4 w-4" />
                  <span>{greeting}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                  Welcome {user?.fullName?.split(' ')[0] || 'Alumni'}!
                </h1>
                <p className="text-white/80 text-sm">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="hidden sm:flex flex-col items-end text-white">
                <div className="flex items-center space-x-2 mb-1">
                  <ClockIcon className="h-4 w-4" />
                  <span className="text-sm">Current Time</span>
                </div>
                <div className="text-2xl font-bold">{currentTime}</div>
              </div>
            </div>
          </div>
          {/* Decorative Pattern */}
          <div className="absolute bottom-0 right-0 opacity-20">
            <svg width="200" height="100" viewBox="0 0 200 100" fill="none">
              <circle cx="150" cy="50" r="40" fill="white" fillOpacity="0.1"/>
              <circle cx="180" cy="30" r="20" fill="white" fillOpacity="0.05"/>
              <circle cx="170" cy="70" r="15" fill="white" fillOpacity="0.08"/>
            </svg>
          </div>
        </motion.div>

        {/* Alumni Showcase Marquee */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <ProfileMarquee speed="medium" />
        </motion.div>

        {/* Verification Status Banner */}
        {!isVerified && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8"
          >
            <div className={`rounded-lg p-4 ${
              isPending 
                ? 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {isPending ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <ShieldCheckIcon className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${
                    isPending 
                      ? 'text-yellow-800 dark:text-yellow-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}>
                    {isPending ? 'Alumni Verification Pending' : 'Alumni Verification Required'}
                  </h3>
                  <div className={`mt-1 text-sm ${
                    isPending 
                      ? 'text-yellow-700 dark:text-yellow-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    <p>
                      {isPending 
                        ? 'Your alumni status is currently being reviewed by our administrators. You\'ll be notified once approved.'
                        : 'Please complete your alumni verification to access all portal features.'
                      }
                    </p>
                  </div>
                  {!isPending && (
                    <div className="mt-3">
                      <a
                        href="/auth/verification-pending"
                        className="text-sm bg-red-100 dark:bg-red-800/30 text-red-800 dark:text-red-200 px-3 py-1 rounded-md hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                      >
                        Complete Verification
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Birthdays & Social */}
          <div className="space-y-6">
            <BirthdaysCard />
            <SocialSection />
          </div>

          {/* Right Column - Festivals, Alumni Story & Events */}
          <div className="space-y-6">
            <FestivalsCard />
            <AlumniStorySection />
            <EventsComingSoon />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
