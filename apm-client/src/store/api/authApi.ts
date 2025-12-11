// src/store/api/authApi.ts
// GUILD Authentication API Endpoints

import { apiSlice } from './apiSlice'
import type { User } from '../slices/authSlice'

// Organization type for multi-org support
export interface Organization {
  id: string
  name: string
  shortName?: string
  tenantCode: string
  logoUrl?: string | null
  logoProxyUrl?: string | null  // Proxy URL for accessing R2 logos via API
  description?: string
  isActive?: boolean
}

// Authentication request/response types
export interface LoginRequest {
  email: string
  password: string
  rememberMe?: boolean
  organizationId?: string  // For multi-org login
}

// Multi-org login response (when user has accounts in multiple orgs)
export interface MultiOrgLoginResponse {
  success: boolean
  message: string
  data: {
    multipleOrganizations: true
    organizations: Organization[]
    message: string
  }
}

// Standard login response
export interface LoginResponse {
  success: boolean
  message: string
  data: {
    user: User
    tokens: {
      accessToken: string
      refreshToken: string
    }
    verificationStatus: {
      isAlumniVerified: boolean
      pendingVerification: boolean
      isRejected: boolean
      rejectionReason?: string
      hasSerialId: boolean
      message: string
    }
    // Multi-org case
    multipleOrganizations?: boolean
    organizations?: Organization[]
  }
}

// Get organizations by email request/response
export interface GetOrganizationsByEmailRequest {
  email: string
}

export interface GetOrganizationsByEmailResponse {
  success: boolean
  message: string
  data: {
    organizations: Organization[]
    multipleOrganizations: boolean
  }
}

export interface RegisterRequest {
  email: string
  password: string
  fullName: string
  batch: number
  admissionYear?: number
  passoutYear?: number
  whatsappNumber?: string
  personalEmail?: string
  currentLocation?: string
  dateOfBirth?: string
}

export interface RegisterResponse {
  success: boolean
  message: string
  user: Partial<User>
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordResponse {
  success: boolean
  message: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
  confirmPassword: string
}

export interface ResetPasswordResponse {
  success: boolean
  message: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  success: boolean
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface VerifyEmailRequest {
  token: string
}

export interface VerifyEmailResponse {
  success: boolean
  message: string
  user: User
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ChangePasswordResponse {
  success: boolean
  message: string
}

// Inject authentication endpoints into the main API slice
export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Login endpoint
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // Register endpoint
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (userData) => ({
        url: '/auth/register',
        method: 'POST',
        body: userData,
      }),
    }),

    // Refresh token endpoint
    refreshToken: builder.mutation<RefreshTokenResponse, RefreshTokenRequest>({
      query: ({ refreshToken }) => ({
        url: '/auth/refresh',
        method: 'POST',
        body: { refreshToken },
      }),
    }),

    // Get current user profile
    getCurrentUser: builder.query<{ success: boolean; user: User }, void>({
      query: () => '/auth/me',
      providesTags: ['Auth', 'User'],
    }),

    // Forgot password
    forgotPassword: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: ({ email }) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body: { email },
      }),
    }),

    // Reset password
    resetPassword: builder.mutation<ResetPasswordResponse, ResetPasswordRequest>({
      query: ({ token, newPassword, confirmPassword }) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body: { token, newPassword, confirmPassword },
      }),
    }),

    // Verify email - uses GET with token in URL path
    verifyEmail: builder.mutation<VerifyEmailResponse, VerifyEmailRequest>({
      query: ({ token }) => ({
        url: `/auth/verify-email/${token}`,
        method: 'GET',
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // Resend verification email
    resendVerificationEmail: builder.mutation<{ success: boolean; message: string }, { email: string }>({
      query: ({ email }) => ({
        url: '/auth/resend-verification',
        method: 'POST',
        body: { email },
      }),
    }),

    // Change password (authenticated user)
    changePassword: builder.mutation<ChangePasswordResponse, ChangePasswordRequest>({
      query: ({ currentPassword, newPassword, confirmPassword }) => ({
        url: '/auth/change-password',
        method: 'POST',
        body: { currentPassword, newPassword, confirmPassword },
      }),
    }),

    // Logout (server-side logout to invalidate refresh token)
    logout: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // Check if email exists (for registration validation)
    checkEmailExists: builder.query<{ exists: boolean }, string>({
      query: (email) => `/auth/check-email?email=${encodeURIComponent(email)}`,
    }),

    // Validate reset token
    validateResetToken: builder.query<{ valid: boolean; email?: string }, string>({
      query: (token) => `/auth/validate-reset-token?token=${token}`,
    }),

    // Get auth statistics (for admin)
    getAuthStats: builder.query<{
      totalUsers: number
      verifiedUsers: number
      pendingVerification: number
      activeUsers: number
      recentLogins: number
    }, void>({
      query: () => '/auth/stats',
      providesTags: ['Auth'],
    }),

    // Bulk user verification (admin only)
    bulkVerifyUsers: builder.mutation<{ success: boolean; verifiedCount: number }, { userIds: string[] }>({
      query: ({ userIds }) => ({
        url: '/auth/bulk-verify',
        method: 'POST',
        body: { userIds },
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // Update user role (admin only)
    updateUserRole: builder.mutation<{ success: boolean; user: User }, { 
      userId: string
      role: User['role']
    }>({
      query: ({ userId, role }) => ({
        url: `/admin/users/${userId}/role`,
        method: 'PUT',
        body: { role },
      }),
      invalidatesTags: ['Users', 'Admin'],
    }),

    // Deactivate/activate user account (admin only)
    toggleUserStatus: builder.mutation<{ success: boolean; user: User }, {
      userId: string
      isActive: boolean
    }>({
      query: ({ userId, isActive }) => ({
        url: `/auth/users/${userId}/status`,
        method: 'PATCH',
        body: { isActive },
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // Self-deactivate account (user deactivates their own account)
    deactivateAccount: builder.mutation<{ success: boolean; message: string }, { password: string }>({
      query: ({ password }) => ({
        url: '/auth/deactivate-account',
        method: 'POST',
        body: { password },
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // Request reactivation OTP (for deactivated accounts)
    requestReactivation: builder.mutation<{ success: boolean; message: string }, { email: string }>({
      query: ({ email }) => ({
        url: '/auth/request-reactivation',
        method: 'POST',
        body: { email },
      }),
    }),

    // Verify reactivation OTP and reactivate account
    verifyReactivation: builder.mutation<{
      success: boolean;
      message: string;
      data: {
        user: User;
        tokens: {
          accessToken: string;
          refreshToken: string;
        };
      };
    }, { email: string; otp: string; organizationId?: string }>({
      query: ({ email, otp, organizationId }) => ({
        url: '/auth/verify-reactivation',
        method: 'POST',
        body: { email, otp, organizationId },
      }),
      invalidatesTags: ['Auth', 'User'],
    }),

    // Get organizations by email (for multi-org login)
    getOrganizationsByEmail: builder.mutation<GetOrganizationsByEmailResponse, GetOrganizationsByEmailRequest>({
      query: ({ email }) => ({
        url: '/auth/organizations-by-email',
        method: 'POST',
        body: { email },
      }),
    }),

    // Get all organizations (for new users who need to pick org)
    getAllOrganizations: builder.query<{
      success: boolean
      message: string
      data: {
        organizations: Organization[]
        count: number
      }
    }, void>({
      query: () => '/auth/organizations',
    }),

    // Get organization by code (for manual code entry)
    getOrganizationByCode: builder.query<{
      success: boolean
      message: string
      data: {
        organization: Organization
      }
    }, string>({
      query: (code) => `/auth/organization-by-code/${encodeURIComponent(code)}`,
    }),
  }),
  overrideExisting: false,
})

// Export hooks for use in components
export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useGetCurrentUserQuery,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
  useChangePasswordMutation,
  useLogoutMutation,
  useCheckEmailExistsQuery,
  useValidateResetTokenQuery,
  useGetAuthStatsQuery,
  useBulkVerifyUsersMutation,
  useUpdateUserRoleMutation,
  useToggleUserStatusMutation,
  useDeactivateAccountMutation,
  useRequestReactivationMutation,
  useVerifyReactivationMutation,
  useGetOrganizationsByEmailMutation,
  useGetAllOrganizationsQuery,
  useLazyGetAllOrganizationsQuery,
  useGetOrganizationByCodeQuery,
  useLazyGetOrganizationByCodeQuery,
} = authApi

// Export the enhanced api slice
export { authApi as default }