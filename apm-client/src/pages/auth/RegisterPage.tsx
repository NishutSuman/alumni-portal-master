// pages/auth/RegistrationPage.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  UserIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  AcademicCapIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/services/api';
import OrganizationLogo from '@/components/common/UI/OrganizationLogo';

// Validation Schema
const registrationSchema = yup.object().shape({
  fullName: yup
    .string()
    .required('Full name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address')
    .lowercase(),
  
  
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
  
  batch: yup
    .number()
    .required('Batch passout year is required')
    .min(1950, 'Please enter a valid batch passout year')
    .max(new Date().getFullYear() + 10, 'Batch passout year seems too far in the future'),
  
  acceptTerms: yup
    .boolean()
    .oneOf([true], 'You must accept the terms and conditions'),
  
  acceptPrivacy: yup
    .boolean()
    .oneOf([true], 'You must accept the privacy policy')
});

const RegistrationPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [verificationDocuments, setVerificationDocuments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
    trigger
  } = useForm({
    resolver: yupResolver(registrationSchema),
    mode: 'onChange'
  });

  const watchedFields = watch();

  // Batch will be entered directly by user

  // Password strength calculator
  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0, text: '', color: 'bg-gray-200' };
    
    let score = 0;
    const checks = [
      password.length >= 8,
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[@$!%*?&]/.test(password)
    ];
    
    score = checks.filter(Boolean).length;
    
    const strength: Record<number, { text: string; color: string }> = {
      0: { text: 'Very Weak', color: 'bg-red-500' },
      1: { text: 'Very Weak', color: 'bg-red-500' },
      2: { text: 'Weak', color: 'bg-orange-500' },
      3: { text: 'Fair', color: 'bg-yellow-500' },
      4: { text: 'Good', color: 'bg-blue-500' },
      5: { text: 'Strong', color: 'bg-green-500' }
    };
    
    return { score, ...strength[score] };
  };

  // Handle file upload
  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit
      return isValidType && isValidSize;
    });
    
    if (validFiles.length !== files.length) {
      toast.error('Some files were rejected. Please upload only JPG, PNG, or PDF files under 5MB.');
    }
    
    setVerificationDocuments(prev => [...prev, ...validFiles]);
  };

  const removeDocument = (index: number) => {
    setVerificationDocuments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle registration submission
  const onSubmit = async (data: unknown) => {
    setIsSubmitting(true);
    
    try {
      // Create payload matching backend expectations
      const payload = {
        email: (data as any).email,
        password: (data as any).password,
        fullName: (data as any).fullName,
        batch: parseInt((data as any).batch), // Backend expects number  
      };
      
      console.log('Sending registration payload:', payload);
      
      const response = await apiClient.post('/auth/register', payload);
      
      console.log('Registration response:', response.data);
      
      if (response.data.success) {
        toast.success(response.data.message || 'Registration successful! Your account is pending alumni verification.');
        // Redirect to email verification page
        navigate('/auth/verify-email', { 
          state: { 
            email: payload.email,
            verificationPending: true 
          } 
        });
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
      
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle different types of errors
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextStep = async () => {
    const fieldsToValidate = currentStep === 1 
      ? ['fullName', 'email']
      : ['password', 'confirmPassword', 'batch'];
    
    const isStepValid = await trigger(fieldsToValidate as any);
    
    if (isStepValid) {
      setCurrentStep(2);
    }
  };

  const passwordStrength = getPasswordStrength(watchedFields.password || '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-4"
          >
            <OrganizationLogo size="2xl" className="flex-shrink-0" />
          </motion.div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Join Alumni Portal
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Alumni Network Registration
          </p>
          
          {/* Step indicator */}
          <div className="flex justify-center mt-6">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                1
              </div>
              <div className={`w-12 h-1 rounded ${currentStep >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      {/* <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> */}
                      <input
                        {...register('fullName')}
                        type="text"
                        placeholder="Enter your full name"
                        className={`form-input pl-10 ${errors.fullName ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {errors.fullName && (
                      <p className="mt-1 text-sm text-red-500">{errors.fullName.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      {/* <EnvelopeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> */}
                      <input
                        {...register('email')}
                        type="email"
                        placeholder="Enter your email"
                        className={`form-input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </div>


                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full btn-guild"
                  >
                    Continue to Academic Details
                  </button>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Academic Information - Simplified */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Batch Passout Year *
                    </label>
                    <div className="relative">
                      <AcademicCapIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        {...register('batch')}
                        type="number"
                        placeholder="2022"
                        min="1950"
                        max={new Date().getFullYear() + 10}
                        className={`form-input pl-10 ${errors.batch ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {errors.batch && (
                      <p className="mt-1 text-sm text-red-500">{errors.batch.message}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">Enter the year you passed out from your institution</p>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        className={`form-input pr-10 ${errors.password ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    
                    {/* Password strength indicator */}
                    {watchedFields.password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Password strength</span>
                          <span className={`text-xs font-medium ${
                            passwordStrength.score >= 4 ? 'text-green-500' :
                            passwordStrength.score >= 3 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {passwordStrength.text}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        {...register('confirmPassword')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm your password"
                        className={`form-input pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                  

                  {/* Terms and Conditions */}
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <input
                        {...register('acceptTerms')}
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                        I accept the{' '}
                        <span className="text-blue-600 hover:text-blue-800 underline cursor-pointer">
                          Terms and Conditions
                        </span>
                      </label>
                    </div>
                    {errors.acceptTerms && (
                      <p className="text-sm text-red-500">{errors.acceptTerms.message}</p>
                    )}

                    <div className="flex items-start">
                      <input
                        {...register('acceptPrivacy')}
                        type="checkbox"
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                        I accept the{' '}
                        <span className="text-blue-600 hover:text-blue-800 underline cursor-pointer">
                          Privacy Policy
                        </span>
                      </label>
                    </div>
                    {errors.acceptPrivacy && (
                      <p className="text-sm text-red-500">{errors.acceptPrivacy.message}</p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !isValid}
                      className="flex-1 btn-guild disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Creating Account...
                        </div>
                      ) : (
                        'Create Account'
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>

        {/* Login Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <button 
              onClick={() => navigate('/auth/login')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Sign in here
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RegistrationPage;