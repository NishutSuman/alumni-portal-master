// src/hooks/useAuth.ts - FIXED VERSION
// Fix return types and type imports

import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import type { RootState } from '@/store'
import {
  loginStart,
  loginSuccess,
  loginFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  logout,
  clearError,
  dismissWelcome,
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
  selectIsAdmin,
  selectIsBatchAdmin,
  selectIsVerified,
  selectIsPendingVerification,
} from '@/store/slices/authSlice'
import {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
  type LoginRequest,
  type RegisterRequest,
} from '@/store/api/authApi'

// Define return types for our functions
interface AuthActionResult {
  success: boolean
  error?: string
}

export const useAuth = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  
  // Selectors
  const auth = useSelector(selectAuth)
  const user = useSelector(selectUser)
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const isLoading = useSelector(selectIsLoading)
  const error = useSelector(selectAuthError)
  const isAdmin = useSelector(selectIsAdmin)
  const isBatchAdmin = useSelector(selectIsBatchAdmin)
  const isVerified = useSelector(selectIsVerified)
  const isPendingVerification = useSelector(selectIsPendingVerification)
  
  // API mutations
  const [loginMutation] = useLoginMutation()
  const [registerMutation] = useRegisterMutation()
  const [logoutMutation] = useLogoutMutation()
  const [forgotPasswordMutation] = useForgotPasswordMutation()
  const [resetPasswordMutation] = useResetPasswordMutation()
  const [changePasswordMutation] = useChangePasswordMutation()
  const [verifyEmailMutation] = useVerifyEmailMutation()
  const [resendVerificationMutation] = useResendVerificationEmailMutation()

  // Login function - FIXED with proper return type
  const login = async (credentials: LoginRequest): Promise<AuthActionResult> => {
    try {
      dispatch(loginStart())
      
      const response = await loginMutation(credentials).unwrap()
      
      if (response.success) {
        dispatch(loginSuccess({
          user: response.user,
          token: response.accessToken,
          refreshToken: response.refreshToken,
          rememberMe: credentials.rememberMe || false,
        }))
        
        toast.success(`Welcome back, ${response.user.fullName}!`)
        
        // Navigate based on user role and verification status
        if (!response.user.isAlumniVerified && response.user.pendingVerification) {
          navigate('/auth/verification-pending')
        } else if (response.user.role === 'SUPER_ADMIN') {
          navigate('/admin/dashboard')
        } else {
          navigate('/user/dashboard')
        }
        
        return { success: true }
      }
      
      // If we reach here, response.success was false
      return { success: false, error: 'Login failed' }
    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || 'Login failed'
      dispatch(loginFailure(errorMessage))
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Register function - FIXED with proper return type
  const register = async (userData: RegisterRequest): Promise<AuthActionResult> => {
    try {
      dispatch(registerStart())
      
      const response = await registerMutation(userData).unwrap()
      
      if (response.success) {
        dispatch(registerSuccess({ message: response.message }))
        toast.success('Registration successful! Please check your email for verification.')
        navigate('/auth/login')
        return { success: true }
      }
      
      return { success: false, error: 'Registration failed' }
    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || 'Registration failed'
      dispatch(registerFailure(errorMessage))
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Logout function
  const handleLogout = async (): Promise<void> => {
    try {
      // Call server logout to invalidate refresh token
      await logoutMutation().unwrap()
    } catch (error) {
      // Even if server logout fails, we still want to clear local state
      console.warn('Server logout failed:', error)
    }
    
    dispatch(logout())
    toast.success('Logged out successfully')
    navigate('/auth/login')
  }

  // Forgot password function - FIXED with proper return type
  const forgotPassword = async (email: string): Promise<AuthActionResult> => {
    try {
      const response = await forgotPasswordMutation({ email }).unwrap()
      
      if (response.success) {
        toast.success('Password reset email sent! Check your inbox.')
        return { success: true }
      }
      
      return { success: false, error: 'Failed to send reset email' }
    } catch (error: any) {
      const errorMessage = error?.data?.message || 'Failed to send reset email'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Reset password function - FIXED with proper return type
  const resetPassword = async (token: string, newPassword: string, confirmPassword: string): Promise<AuthActionResult> => {
    try {
      const response = await resetPasswordMutation({ token, newPassword, confirmPassword }).unwrap()
      
      if (response.success) {
        toast.success('Password reset successfully! Please login with your new password.')
        navigate('/auth/login')
        return { success: true }
      }
      
      return { success: false, error: 'Password reset failed' }
    } catch (error: any) {
      const errorMessage = error?.data?.message || 'Password reset failed'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Change password function - FIXED with proper return type
  const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string): Promise<AuthActionResult> => {
    try {
      const response = await changePasswordMutation({ currentPassword, newPassword, confirmPassword }).unwrap()
      
      if (response.success) {
        toast.success('Password changed successfully!')
        return { success: true }
      }
      
      return { success: false, error: 'Password change failed' }
    } catch (error: any) {
      const errorMessage = error?.data?.message || 'Password change failed'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Verify email function - FIXED with proper return type
  const verifyEmail = async (token: string): Promise<AuthActionResult> => {
    try {
      const response = await verifyEmailMutation({ token }).unwrap()
      
      if (response.success) {
        // If user is logged in, update their verification status
        if (isAuthenticated) {
          dispatch(loginSuccess({
            user: response.user,
            token: auth.token!,
            refreshToken: auth.refreshToken!,
          }))
        }
        
        toast.success('Email verified successfully!')
        return { success: true }
      }
      
      return { success: false, error: 'Email verification failed' }
    } catch (error: any) {
      const errorMessage = error?.data?.message || 'Email verification failed'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Resend verification email - FIXED with proper return type
  const resendVerificationEmail = async (email: string): Promise<AuthActionResult> => {
    try {
      const response = await resendVerificationMutation({ email }).unwrap()
      
      if (response.success) {
        toast.success('Verification email sent!')
        return { success: true }
      }
      
      return { success: false, error: 'Failed to send verification email' }
    } catch (error: any) {
      const errorMessage = error?.data?.message || 'Failed to send verification email'
      toast.error(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  // Clear error function
  const clearAuthError = (): void => {
    dispatch(clearError())
  }

  // Dismiss welcome message
  const dismissWelcomeMessage = (): void => {
    dispatch(dismissWelcome())
  }

  // Check if user has specific role
  const hasRole = (role: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN'): boolean => {
    return user?.role === role
  }

  // Check if user has permission (role hierarchy)
  const hasPermission = (requiredRole: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN'): boolean => {
    if (!user) return false
    
    const roleHierarchy = {
      'USER': 0,
      'BATCH_ADMIN': 1,
      'SUPER_ADMIN': 2,
    } as const
    
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
  }

  // Get user display info
  const getUserDisplayInfo = () => {
    if (!user) return null
    
    return {
      name: user.fullName,
      email: user.email,
      avatar: user.profilePictureUrl,
      batch: user.batch,
      role: user.role,
      isVerified: user.isAlumniVerified,
      isPending: user.pendingVerification,
    }
  }

  return {
    // State
    auth,
    user,
    isAuthenticated,
    isLoading,
    error,
    isAdmin,
    isBatchAdmin,
    isVerified,
    isPendingVerification,
    
    // Actions
    login,
    register,
    logout: handleLogout,
    forgotPassword,
    resetPassword,
    changePassword,
    verifyEmail,
    resendVerificationEmail,
    clearAuthError,
    dismissWelcomeMessage,
    
    // Utilities
    hasRole,
    hasPermission,
    getUserDisplayInfo,
  }
}