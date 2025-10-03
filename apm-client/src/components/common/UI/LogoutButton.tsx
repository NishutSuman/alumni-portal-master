// src/components/common/UI/LogoutButton.tsx
import React, { useState } from 'react';
import { 
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

interface LogoutButtonProps {
  variant?: 'default' | 'minimal' | 'danger';
  showConfirmation?: boolean;
  className?: string;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({
  variant = 'default',
  showConfirmation = true,
  className = ''
}) => {
  const { logout, isLoading, user } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutClick = () => {
    if (showConfirmation) {
      setShowConfirmModal(true);
    } else {
      handleConfirmLogout();
    }
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      setShowConfirmModal(false);
    }
  };

  const getButtonStyles = () => {
    const baseStyles = "inline-flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    
    switch (variant) {
      case 'minimal':
        return `${baseStyles} text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700`;
      case 'danger':
        return `${baseStyles} bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium`;
      default:
        return `${baseStyles} bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium`;
    }
  };

  return (
    <>
      <button
        onClick={handleLogoutClick}
        disabled={isLoading || isLoggingOut}
        className={`${getButtonStyles()} ${className}`}
        title="Sign out"
      >
        {isLoggingOut ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
        ) : (
          <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
        )}
        {variant === 'minimal' ? '' : isLoggingOut ? 'Signing out...' : 'Sign Out'}
      </button>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50"
                onClick={() => setShowConfirmModal(false)}
              />
              
              {/* Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card p-6 w-full max-w-md relative z-10"
              >
                <div className="text-center">
                  <div className="mx-auto h-12 w-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-white" />
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Confirm Sign Out
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Are you sure you want to sign out{user?.fullName ? `, ${user.fullName}` : ''}? 
                    You'll need to sign in again to access your account.
                  </p>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      disabled={isLoggingOut}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={handleConfirmLogout}
                      disabled={isLoggingOut}
                      className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {isLoggingOut ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Signing out...
                        </div>
                      ) : (
                        'Sign Out'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LogoutButton;