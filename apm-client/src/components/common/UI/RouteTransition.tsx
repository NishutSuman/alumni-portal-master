import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BrandedLoader from './BrandedLoader';

interface RouteTransitionProps {
  children: React.ReactNode;
  minLoadingTime?: number; // Minimum time to show loader (in ms)
}

const RouteTransition: React.FC<RouteTransitionProps> = ({
  children,
  minLoadingTime = 300
}) => {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevLocation, setPrevLocation] = useState(location.pathname);

  useEffect(() => {
    // Only show transition if route actually changed
    if (location.pathname !== prevLocation) {
      setIsTransitioning(true);

      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPrevLocation(location.pathname);
      }, minLoadingTime);

      return () => clearTimeout(timer);
    }
  }, [location.pathname, prevLocation, minLoadingTime]);

  return (
    <AnimatePresence mode="wait">
      {isTransitioning ? (
        <motion.div
          key="loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
        >
          <BrandedLoader message="" size="md" fullScreen={false} />
        </motion.div>
      ) : (
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RouteTransition;
