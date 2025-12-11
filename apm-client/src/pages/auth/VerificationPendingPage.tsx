// pages/auth/VerificationPendingPage.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon,
  UserGroupIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDispatch } from 'react-redux';
import { updateProfile } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

const VerificationPendingPage = () => {
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [newBatch, setNewBatch] = useState(user?.batch || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Check if user is rejected, pending, or blacklisted
  const isRejected = user?.isRejected;
  const isPending = user?.pendingVerification;
  const isBlacklisted = user?.verificationContext?.isBlacklisted;
  const blacklistInfo = user?.verificationContext?.blacklistInfo;

  const handleLogout = async () => {
    await logout();
  };

  // Check verification status and redirect if approved
  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const response = await api.get('/auth/me');

      if (response.data.success) {
        const updatedUser = response.data.data;

        // Update Redux state with fresh user data
        dispatch(updateProfile(updatedUser));

        // Check if verification is now approved
        if (updatedUser.isAlumniVerified && !updatedUser.pendingVerification) {
          toast.success('Your verification has been approved! Redirecting to dashboard...');

          // Redirect based on role
          setTimeout(() => {
            if (updatedUser.role === 'DEVELOPER') {
              navigate('/developer');
            } else if (updatedUser.role === 'SUPER_ADMIN' || updatedUser.role === 'BATCH_ADMIN') {
              navigate('/admin/dashboard');
            } else {
              navigate('/user/dashboard');
            }
          }, 1500);
        } else if (updatedUser.isRejected) {
          toast.error('Your verification was rejected. Please check the rejection reason.');
        } else {
          toast('Verification is still pending. Please check back later.', { icon: '⏳' });
        }
      }
    } catch (error: any) {
      console.error('Error checking verification status:', error);
      toast.error('Failed to check status. Please try again.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleBatchEdit = () => {
    setNewBatch(user?.batch || '');
    setIsEditingBatch(true);
  };

  const handleCancelEdit = () => {
    setIsEditingBatch(false);
    setNewBatch(user?.batch || '');
  };

  const handleSaveBatch = async () => {
    if (!newBatch || newBatch === user?.batch) {
      handleCancelEdit();
      return;
    }

    // Validate batch year
    const batchYear = parseInt(newBatch.toString());
    if (isNaN(batchYear) || batchYear < 1980 || batchYear > 2030) {
      toast.error('Please enter a valid batch year between 1980 and 2030');
      return;
    }

    setIsUpdating(true);
    try {
      // Call the profile update API - this will reset verification status for rejected users
      const response = await api.put('/users/profile', {
        batch: batchYear,
        // If user was rejected, reset their verification status when changing batch
        resetVerificationStatus: isRejected
      });

      if (response.data.success) {
        // Update Redux auth state with new user data
        if (response.data.data) {
          dispatch(updateProfile(response.data.data));
        }
        
        const message = isRejected 
          ? 'Batch year updated and verification status reset! Your application will be reviewed again by the correct batch admin.'
          : 'Batch year updated successfully! Your verification will be reassigned to the correct batch admin.';
        toast.success(message);
        setIsEditingBatch(false);
        
        // No need to reload - Redux state is updated
      } else {
        throw new Error(response.data.message || 'Update failed');
      }
    } catch (error: any) {
      console.error('Batch update error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update batch year';
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="mx-auto h-20 w-20 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center mb-6">
            <ClockIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {isRejected ? 'Verification Status' : 'Verification Pending'}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {isRejected 
              ? 'Your verification request requires attention' 
              : 'Your alumni status is being reviewed by our administrators'
            }
          </p>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 mb-6"
        >
          {/* Blacklisted User UI */}
          {isBlacklisted ? (
            <div className="text-center">
              <div className="mx-auto h-16 w-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                <XMarkIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-semibold text-red-900 dark:text-red-100 mb-4">
                Application Rejected
              </h2>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
                <p className="text-red-800 dark:text-red-200 text-lg mb-4">
                  Your application has been rejected to create an account with our organisation.
                </p>
                <p className="text-red-700 dark:text-red-300 mb-4">
                  {blacklistInfo?.reason || 'Your registration could not be verified with our alumni records.'}
                </p>
                <p className="text-red-600 dark:text-red-400 text-sm">
                  Please reach out to our admin team for further assistance.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Contact Administration
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  For questions or appeals, contact:{' '}
                  <a href="mailto:admin@alumni-portal.com" className="text-blue-600 hover:text-blue-800 underline font-medium">
                    admin@alumni-portal.com
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Hello, {user?.fullName}! 👋
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Thank you for registering with Alumni Portal. Your account has been created successfully, 
                  but we need to verify your alumni status before you can access all features.
                </p>
              </div>

          {/* Status Cards */}
          <div className="space-y-4 mb-8">
            {/* Email Verification */}
            <div className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex-shrink-0">
                <EnvelopeIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Email Verified ✅
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Alumni Verification */}
            <div className={`p-4 ${
              isRejected 
                ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            } rounded-lg`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className={`h-6 w-6 ${
                    isRejected 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`} />
                </div>
                <div className="ml-4 flex-1">
                  <h3 className={`text-sm font-medium ${
                    isRejected 
                      ? 'text-red-800 dark:text-red-200' 
                      : 'text-yellow-800 dark:text-yellow-200'
                  }`}>
                    Alumni Status: {isRejected ? 'Not Approved ❌' : 'Pending Review ⏳'}
                  </h3>
                  <div className="mt-1">
                    {!isEditingBatch ? (
                      <div className="flex items-center justify-between">
                        <p className={`text-sm ${
                          isRejected 
                            ? 'text-red-700 dark:text-red-300' 
                            : 'text-yellow-700 dark:text-yellow-300'
                        }`}>
                          Batch: {user?.batch} | {isRejected ? 'Verification rejected' : 'Claimed as alumni'}
                        </p>
                        <button
                          onClick={handleBatchEdit}
                          className={`flex items-center px-3 py-1 text-xs ${
                            isRejected
                              ? 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200 bg-red-100 dark:bg-red-800/20 hover:bg-red-200 dark:hover:bg-red-800/30 border border-red-300 dark:border-red-600'
                              : 'text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200 bg-yellow-100 dark:bg-yellow-800/20 hover:bg-yellow-200 dark:hover:bg-yellow-800/30 border border-yellow-300 dark:border-yellow-600'
                          } rounded transition-colors`}
                          title={isRejected ? 'Change batch to retry verification' : 'Edit batch year'}
                        >
                          <PencilIcon className="h-3 w-3 mr-1" />
                          {isRejected ? 'Change Batch' : 'Edit'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-yellow-700 dark:text-yellow-300">Batch:</span>
                        <input
                          type="number"
                          value={newBatch}
                          onChange={(e) => setNewBatch(e.target.value)}
                          className="w-20 px-2 py-1 text-sm border  border-yellow-300 rounded bg-black focus:outline-none focus:border-yellow-500"
                          min="1980"
                          max="2030"
                          disabled={isUpdating}
                        />
                        <button
                          onClick={handleSaveBatch}
                          disabled={isUpdating}
                          className="p-1 text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                          title="Save changes"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                          className="p-1 text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                          title="Cancel editing"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Rejection Reason Display */}
              {isRejected && user?.rejectionReason && (
                <div className="mt-3 p-3 bg-red-100 dark:bg-red-800/30 border border-red-200 dark:border-red-700 rounded-md">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                    Rejection Reason:
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {user.rejectionReason}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    💡 You can change your batch year above to retry verification with the correct batch admin.
                  </p>
                </div>
              )}
              
              {isEditingBatch && (
                <div className={`mt-3 p-3 ${
                  isRejected 
                    ? 'bg-red-100 dark:bg-red-800/30' 
                    : 'bg-yellow-100 dark:bg-yellow-800/30'
                } rounded-md`}>
                  <p className={`text-xs ${
                    isRejected 
                      ? 'text-red-700 dark:text-red-300' 
                      : 'text-yellow-700 dark:text-yellow-300'
                  }`}>
                    💡 <strong>Note:</strong> {
                      isRejected 
                        ? 'Changing your batch year will reset your rejection status and submit a new verification request to the correct batch admin.'
                        : 'Changing your batch year will update which admin reviews your verification. Make sure to enter the correct passout year for proper assignment to batch admins.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* What's Next */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-4">
              {isRejected ? 'What can you do now?' : 'What happens next?'}
            </h3>
            <ul className="space-y-3 text-blue-800 dark:text-blue-200">
              {isRejected ? (
                <>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      1
                    </span>
                    <span>Review the rejection reason above to understand why your verification was not approved</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      2
                    </span>
                    <span>If you believe your batch year was incorrect, use the "Change Batch" button above to update it</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      3
                    </span>
                    <span>Changing your batch will reset your rejection status and submit a new verification request</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      4
                    </span>
                    <span>Contact support if you need additional help or have questions about the rejection</span>
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      1
                    </span>
                    <span>Our administrators will review your registration details and claimed batch information</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      2
                    </span>
                    <span>We may cross-reference with existing alumni records and batch information</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      3
                    </span>
                    <span>You'll receive an email notification once your alumni status is verified</span>
                  </li>
                  <li className="flex items-start">
                    <span className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                      4
                    </span>
                    <span>After verification, you'll have full access to all alumni portal features</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Time Estimate */}
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 text-gray-500 mr-2" />
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Estimated Review Time
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Typically 1-3 business days. You'll be notified by email once completed.
                </p>
              </div>
            </div>
          </div>

              {/* Contact Information */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Need to Update Information?
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      If you need to correct any information or have questions about the verification process, 
                      please contact our administrators at{' '}
                      <a href="mailto:admin@alumni-portal.com" className="underline font-medium">
                        admin@alumni-portal.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row justify-center gap-4"
        >
          {/* Check Verification Status Button - Primary */}
          <button
            onClick={handleCheckStatus}
            disabled={isCheckingStatus}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-3 rounded-lg font-medium transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isCheckingStatus ? (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                Checking Status...
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Check Verification Status
              </>
            )}
          </button>

          {/* Sign Out Button - Secondary */}
          <button
            onClick={handleLogout}
            className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center justify-center"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
            Sign Out
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You'll remain logged in during the verification process.
            Click "Check Verification Status" to see if your account has been approved.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default VerificationPendingPage;