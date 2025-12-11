import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MegaphoneIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useGetActiveAnnouncementsQuery } from '../../../store/api/announcementApi';

const SCROLL_SPEED = 50; // pixels per second
const PAUSE_BEFORE_SCROLL = 1500; // ms to wait before starting scroll
const PAUSE_AFTER_SCROLL = 2000; // ms to pause after scroll completes
const SHORT_TEXT_DURATION = 5000; // ms to show short text before advancing

const AnnouncementBanner: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useGetActiveAnnouncementsQuery();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false); // Temporary dismiss for current session only
  const [scrollState, setScrollState] = useState<'idle' | 'waiting' | 'scrolling' | 'done'>('idle');
  const [textOverflows, setTextOverflows] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);
  const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const announcements = data?.announcements || [];

  // Check if text overflows container
  const checkOverflow = useCallback(() => {
    if (textRef.current && containerRef.current) {
      const textWidth = textRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      const overflows = textWidth > containerWidth;
      const distance = textWidth - containerWidth + 30;
      setTextOverflows(overflows);
      setScrollDistance(distance);
      return overflows;
    }
    return false;
  }, []);

  // Reset and check overflow when announcement changes
  useEffect(() => {
    setScrollState('idle');
    // Small delay to let the DOM update
    const timer = setTimeout(() => {
      checkOverflow();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentIndex, checkOverflow]);

  // Handle the scroll cycle
  useEffect(() => {
    if (announcements.length === 0) return;

    let timer: NodeJS.Timeout;

    switch (scrollState) {
      case 'idle':
        // Start the cycle - wait before scrolling or advancing
        timer = setTimeout(() => {
          if (textOverflows) {
            setScrollState('scrolling');
          } else {
            setScrollState('done');
          }
        }, textOverflows ? PAUSE_BEFORE_SCROLL : SHORT_TEXT_DURATION);
        break;

      case 'scrolling':
        // Scrolling is handled by framer-motion animation
        // onAnimationComplete will set state to 'done'
        break;

      case 'done':
        // Wait then advance to next announcement
        timer = setTimeout(() => {
          if (announcements.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % announcements.length);
          } else {
            // Single announcement - restart the cycle
            setScrollState('idle');
          }
        }, textOverflows ? PAUSE_AFTER_SCROLL : 0);
        break;
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [scrollState, textOverflows, announcements.length]);

  // Calculate scroll duration based on distance
  const getScrollDuration = () => {
    return Math.max(scrollDistance / SCROLL_SPEED, 3);
  };

  // Reset index if it goes out of bounds
  useEffect(() => {
    if (currentIndex >= announcements.length && announcements.length > 0) {
      setCurrentIndex(0);
    }
  }, [announcements.length, currentIndex]);

  // Temporary dismiss - only hides banner until page refresh
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  };

  const handleBannerClick = () => {
    navigate('/user/social', { state: { tab: 'announcements' } });
  };


  // Hide if dismissed or no announcements
  if (isLoading || announcements.length === 0 || dismissed) {
    return null;
  }

  const currentAnnouncement = announcements[currentIndex];
  if (!currentAnnouncement) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={handleBannerClick}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 cursor-pointer hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-800 dark:hover:to-indigo-800 transition-all"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3 flex items-center justify-between">
          {/* Left side - Icon and Navigation */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="flex-shrink-0">
              <MegaphoneIcon className="h-5 w-5 text-white" />
            </div>

            {announcements.length > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrev}
                  className="p-1 rounded hover:bg-white/20 transition-colors"
                  aria-label="Previous announcement"
                >
                  <ChevronLeftIcon className="h-4 w-4 text-white" />
                </button>
                <span className="text-xs text-white/80 min-w-[40px] text-center">
                  {currentIndex + 1}/{announcements.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-1 rounded hover:bg-white/20 transition-colors"
                  aria-label="Next announcement"
                >
                  <ChevronRightIcon className="h-4 w-4 text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Center - Message with horizontal scroll */}
          <div
            ref={containerRef}
            className="flex-1 mx-4 overflow-hidden relative"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentAnnouncement.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="whitespace-nowrap"
              >
                <motion.span
                  ref={textRef}
                  className="text-sm text-white inline-block"
                  initial={{ x: 0 }}
                  animate={{
                    x: scrollState === 'scrolling' && textOverflows ? -scrollDistance : 0
                  }}
                  transition={scrollState === 'scrolling' ? {
                    duration: getScrollDuration(),
                    ease: 'linear',
                  } : { duration: 0 }}
                  onAnimationComplete={() => {
                    if (scrollState === 'scrolling') {
                      setScrollState('done');
                    }
                  }}
                >
                  {currentAnnouncement.message}
                </motion.span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right side - Dismiss (temporary until refresh) */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-white/20 transition-colors"
            aria-label="Dismiss announcement"
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AnnouncementBanner;
