// pages/auth/VerifyEmailPage.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  EnvelopeIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [verificationStatus, setVerificationStatus] = useState('pending'); // pending, success, error, expired
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  // Get email from location state or URL params
  const email = location.state?.email || searchParams.get('email') || 'user@example.com';
  const token = searchParams.get('token');
  const fromLogin = location.state?.fromLogin || false;
  const emailSent = location.state?.emailSent || false;
  
  // Get auth functions
  const { verifyEmail, resendVerificationEmail } = useAuth();


  // Auto-verify if token is provided
  useEffect(() => {
    if (token && !isVerifying && verificationStatus === 'pending') {
      setIsVerifying(true);
      
      const verifyToken = async () => {
        try {
          const toastId = toast.loading('Verifying your email...', {
            style: {
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
            }
          });
          
          const result = await verifyEmail(token);
          
          toast.dismiss(toastId);
          
          if (result.success) {
            setVerificationStatus('success');
            toast.success('Email verified successfully!', {
              duration: 3000
            });
            
            // Redirect to login page with success message
            setTimeout(() => {
              navigate('/auth/login', { 
                state: { 
                  emailVerified: true, 
                  email: email,
                  message: 'Email verified successfully! You can now sign in.' 
                } 
              });
            }, 3000);
          } else {
            setVerificationStatus('error');
            toast.error('Verification failed. Link may be invalid or expired.');
          }
          
        } catch (error: unknown) {
          console.error('Email verification error:', error);
          setVerificationStatus('error');
          toast.error('Verification failed. Please try again.');
        } finally {
          setIsVerifying(false);
        }
      };
      
      verifyToken();
    }
  }, [token, isVerifying, verificationStatus, verifyEmail, navigate, email]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCooldown]);


  // Handle resend verification email
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    
    setIsResending(true);
    
    try {
      const result = await resendVerificationEmail(email);
      
      if (result.success) {
        setResendCooldown(60); // 60 second cooldown
      }
      
    } catch (error: unknown) {
      console.error('Resend verification error:', error);
    } finally {
      setIsResending(false);
    }
  };


  const getStatusIcon = () => {
    switch (verificationStatus) {
      case 'success':
        return <CheckCircleIcon className="h-16 w-16 text-green-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-16 w-16 text-red-500" />;
      case 'expired':
        return <ClockIcon className="h-16 w-16 text-orange-500" />;
      default:
        return <EnvelopeIcon className="h-16 w-16 text-blue-500" />;
    }
  };

  const getStatusMessage = () => {
    switch (verificationStatus) {
      case 'success':
        return {
          title: 'Email Verified Successfully!',
          description: 'Your email has been verified. Redirecting to login page...',
          color: 'text-green-600'
        };
      case 'error':
        return {
          title: 'Verification Failed',
          description: 'The verification link is invalid or has expired. Please request a new one.',
          color: 'text-red-600'
        };
      case 'expired':
        return {
          title: 'Verification Link Expired',
          description: 'Your verification link has expired. Please request a new one.',
          color: 'text-orange-600'
        };
      default:
        return {
          title: isVerifying ? 'Verifying Your Email...' : 'Verify Your Email Address',
          description: isVerifying 
            ? 'Please wait while we verify your email address...'
            : fromLogin && emailSent 
            ? `We've sent a new verification link to ${email}. Check your inbox and click the link to verify your account.`
            : `We've sent a verification link to ${email}. Check your inbox and click the link to verify your account.`,
          color: isVerifying ? 'text-blue-600' : 'text-blue-600'
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <EnvelopeIcon className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Email Verification
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Complete your registration process
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          {/* Status Icon with Loading Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-6 relative"
          >
            {isVerifying ? (
              <div className="relative">
                <EnvelopeIcon className="h-16 w-16 text-blue-500" />
                <div className="absolute inset-0 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : (
              getStatusIcon()
            )}
          </motion.div>

          {/* Auto-sent notification */}
          {fromLogin && emailSent && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  New verification email sent automatically
                </p>
              </div>
            </motion.div>
          )}

          {/* Status Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h3 className={`text-xl font-semibold mb-2 ${statusMessage.color}`}>
              {statusMessage.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {statusMessage.description}
            </p>
          </motion.div>

          {/* Resend Email - Only show if pending and not verifying */}
          {verificationStatus === 'pending' && !isVerifying && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Didn't receive the email?
              </p>
              <button
                onClick={handleResendVerification}
                disabled={isResending || resendCooldown > 0}
                className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
              >
                {isResending ? (
                  <>
                    <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <ClockIcon className="h-4 w-4 mr-2" />
                    Resend in {resendCooldown}s
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Loading message when verifying */}
          {isVerifying && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-200 border-t-blue-600" />
                <span className="text-sm font-medium">Verifying your email...</span>
              </div>
            </motion.div>
          )}

          {/* Success Actions */}
          {verificationStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center space-x-2 text-green-600">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Redirecting...</span>
              </div>
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full btn-guild"
              >
                Continue to Login
              </button>
            </motion.div>
          )}

          {/* Error Actions */}
          {(verificationStatus === 'error' || verificationStatus === 'expired') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <button
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full btn-guild"
              >
                {isResending ? 'Sending...' : 'Send New Verification Email'}
              </button>
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Login
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Additional Help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <div className="glass-card p-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Need Help?
            </h4>
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>• Check your spam/junk folder</p>
              <p>• Make sure {email} is correct</p>
              <p>• Contact support if you continue having issues</p>
            </div>
            <button className="mt-3 text-blue-600 hover:text-blue-800 text-sm font-medium">
              Contact Support
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;