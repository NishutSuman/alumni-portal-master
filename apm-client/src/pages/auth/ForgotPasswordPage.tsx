// pages/auth/ForgotPasswordPage.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  EnvelopeIcon,
  ArrowLeftIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsDark } from '@/store/slices/themeSlice';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import ThemeToggle from '@/components/common/UI/ThemeToggle';

// Validation schema
const forgotPasswordSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address')
    .lowercase(),
});

interface ForgotPasswordFormData {
  email: string;
}

const ForgotPasswordPage = () => {
  const { forgotPassword } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const navigate = useNavigate();
  const isDark = useSelector(selectIsDark);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
    mode: 'onChange'
  });

  const watchedEmail = watch('email');

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      const result = await forgotPassword(data.email);

      if (result.success) {
        setSubmittedEmail(data.email);
        setIsSubmitted(true);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
    }
  };

  const handleResendEmail = async () => {
    if (!submittedEmail) return;

    try {
      const result = await forgotPassword(submittedEmail);
      if (result.success) {
        toast.success('Password reset email sent again!');
      }
    } catch (error) {
      console.error('Resend email error:', error);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
        {/* Fixed Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center h-10">
                <img
                  src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                  alt="GUILD"
                  className="h-full w-auto object-contain"
                />
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>

        {/* Success Content */}
        <div className="min-h-screen flex items-center justify-center pt-16 px-4">
          <div className="max-w-md w-full">
            {/* Back Button */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors group"
            >
              <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Home</span>
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-10">
              {/* Success Header */}
              <div className="text-center mb-8">
                <div className="mx-auto h-20 w-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <CheckCircleIcon className="h-10 w-10 text-white" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600">
                    Check Your Email
                  </span>
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  We've sent you a password reset link
                </p>
              </div>

              {/* Success Details */}
              <div className="space-y-6">
                <div className="text-center">
                  <p className="text-gray-700 dark:text-gray-300 mb-3">
                    Password reset link sent to:
                  </p>
                  <p className="font-semibold text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-xl">
                    {submittedEmail}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Next Steps:
                  </h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                    <p>✓ Click the link in your email to reset your password</p>
                    <p>✓ The link will expire in 1 hour for security</p>
                    <p>✓ Check your spam folder if you don't see it</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleResendEmail}
                    className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Resend Email
                  </button>

                  <Link
                    to="/auth/login"
                    className="block w-full text-center px-6 py-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 font-semibold hover:opacity-80 transition-opacity"
                  >
                    Back to Login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
      {/* Fixed Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center h-10">
              <img
                src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                alt="GUILD"
                className="h-full w-auto object-contain"
              />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Form Content */}
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="max-w-md w-full">
          {/* Back Button */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Home</span>
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <img
                  src={isDark ? '/brand/guild-logo-white.png' : '/brand/guild-logo.png'}
                  alt="GUILD"
                  className="h-20 w-auto object-contain"
                />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600">
                  Forgot Password?
                </span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                No worries! Enter your email and we'll send you a reset link.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="Enter your email address"
                    className={`w-full px-4 py-3 pl-12 bg-gray-50 dark:bg-gray-900/50 border ${
                      errors.email
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
                    } rounded-xl focus:outline-none focus:ring-2 text-gray-900 dark:text-white transition-colors`}
                    disabled={isSubmitting}
                  />
                  <EnvelopeIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !watchedEmail}
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Sending Reset Link...
                  </div>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              {/* Back to Login */}
              <div className="text-center pt-2">
                <Link
                  to="/auth/login"
                  className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors group"
                >
                  <ArrowLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
                  Back to Login
                </Link>
              </div>
            </form>

            {/* Help Section */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  💡 Need Help?
                </h4>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p>• Make sure the email is associated with your GUILD account</p>
                  <p>• Reset links expire after 1 hour for security</p>
                  <p>• Contact support if you continue having issues</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
