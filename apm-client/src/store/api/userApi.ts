// src/store/api/userApi.ts
// Comprehensive User Profile API

import { apiSlice } from './apiSlice'

// User Profile Types
export interface UserProfile {
  id: string
  serialId?: string
  fullName: string
  email: string
  whatsappNumber?: string
  alternateNumber?: string
  batch: number
  admissionYear?: number
  passoutYear?: number
  dateOfBirth?: string
  isAlumniVerified: boolean
  pendingVerification: boolean
  isRejected: boolean
  rejectionReason?: string
  rejectedAt?: string
  profileImage?: string
  bio?: string
  employmentStatus: 'WORKING' | 'STUDYING' | 'OPEN_TO_WORK' | 'ENTREPRENEUR' | 'RETIRED'
  
  // Social Links
  linkedinUrl?: string
  instagramUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  youtubeUrl?: string
  portfolioUrl?: string
  
  // Privacy Settings
  isProfilePublic: boolean
  showEmail: boolean
  showPhone: boolean
  
  // Role and Status
  role: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN'
  isActive: boolean
  
  // Membership
  membershipStatus: 'ACTIVE' | 'EXPIRED' | 'PENDING' | 'SUSPENDED' | 'INACTIVE'
  membershipExpiresAt?: string
  currentMembershipYear?: number
  membershipPaidAt?: string
  membershipAmountPaid?: number
  
  // LifeLink
  bloodGroup?: 'A_POSITIVE' | 'A_NEGATIVE' | 'B_POSITIVE' | 'B_NEGATIVE' | 'AB_POSITIVE' | 'AB_NEGATIVE' | 'O_POSITIVE' | 'O_NEGATIVE'
  isBloodDonor: boolean
  lastBloodDonationDate?: string
  totalBloodDonations: number
  
  // Timestamps
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  
  // Relations
  addresses?: UserAddress[]
  education?: UserEducation[]
  workExperience?: UserWorkExperience[]
  
  // Verification Context
  verificationContext?: {
    isVerified: boolean
    isPending: boolean
    canEditBatch: boolean
    rejectionReason?: string
    isBlacklisted: boolean
    blacklistInfo?: {
      reason: string
      blacklistedAt: string
      blacklistedBy: string
    }
  }
}

export interface UserAddress {
  id: string
  addressLine1: string
  addressLine2?: string
  city: string
  district?: string
  state: string
  postalCode: string
  country: string
  addressType: 'PERMANENT' | 'CURRENT'
  createdAt: string
  updatedAt: string
}

export interface UserEducation {
  id: string
  course: string
  stream?: string
  institution: string
  fromYear: number
  toYear?: number
  isOngoing: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface UserWorkExperience {
  id: string
  companyName: string
  jobRole: string
  companyType?: 'GOVERNMENT' | 'PRIVATE' | 'STARTUP' | 'NGO' | 'FREELANCE' | 'SELF_EMPLOYED'
  workAddress?: string
  fromYear: number
  toYear?: number
  isCurrentJob: boolean
  description?: string
  createdAt: string
  updatedAt: string
}

export interface UpdateProfileRequest {
  fullName?: string
  whatsappNumber?: string
  alternateNumber?: string
  batch?: number
  admissionYear?: number
  passoutYear?: number
  dateOfBirth?: string
  bio?: string
  employmentStatus?: UserProfile['employmentStatus']
  linkedinUrl?: string
  instagramUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  youtubeUrl?: string
  portfolioUrl?: string
  isProfilePublic?: boolean
  showEmail?: boolean
  showPhone?: boolean
  bloodGroup?: UserProfile['bloodGroup']
  isBloodDonor?: boolean
}

export interface CreateEducationRequest {
  course: string
  stream?: string
  institution: string
  fromYear: number
  toYear?: number
  isOngoing: boolean
  description?: string
}

export interface CreateWorkExperienceRequest {
  companyName: string
  jobRole: string
  companyType?: UserWorkExperience['companyType']
  workAddress?: string
  fromYear: number
  toYear?: number
  isCurrentJob: boolean
  description?: string
}

export interface UpdateAddressRequest {
  addressLine1: string
  addressLine2?: string
  city: string
  district?: string
  state: string
  postalCode: string
  country: string
}

export interface MentionUser {
  id: string
  fullName: string
  batch: number
  profileImage?: string
  serialId?: string
}

// API endpoints
export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Profile Management
    getProfile: builder.query<UserProfile, void>({
      query: () => '/users/profile',
      transformResponse: (response: any) => response.data,
      providesTags: ['Profile'],
    }),

    updateProfile: builder.mutation<UserProfile, UpdateProfileRequest>({
      query: (data) => ({
        url: '/users/profile',
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile', 'User'],
    }),

    getPublicProfile: builder.query<UserProfile, string>({
      query: (userId) => `/users/profile/${userId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, userId) => [{ type: 'Profile', id: userId }],
    }),

    getMembershipStatus: builder.query<{
      status: string
      expiresAt?: string
      currentYear?: number
      paidAt?: string
      amountPaid?: number
    }, void>({
      query: () => '/users/membership-status',
      transformResponse: (response: any) => response.data,
      providesTags: ['Profile'],
    }),

    // Address Management
    getAddresses: builder.query<UserAddress[], void>({
      query: () => '/users/addresses',
      transformResponse: (response: any) => response.data,
      providesTags: ['Profile'],
    }),

    updateAddress: builder.mutation<UserAddress, { 
      addressType: 'PERMANENT' | 'CURRENT'
      data: UpdateAddressRequest
    }>({
      query: ({ addressType, data }) => ({
        url: `/users/address/${addressType}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile'],
    }),

    // Profile Picture Management
    uploadProfilePicture: builder.mutation<{ imageUrl: string }, FormData>({
      query: (formData) => ({
        url: '/users/profile-picture',
        method: 'POST',
        body: formData,
        formData: true, // This ensures RTK Query treats it as FormData
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile', 'User'],
    }),

    updateProfilePicture: builder.mutation<{ imageUrl: string }, FormData>({
      query: (formData) => ({
        url: '/users/profile-picture',
        method: 'PUT',
        body: formData,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile', 'User'],
    }),

    deleteProfilePicture: builder.mutation<void, void>({
      query: () => ({
        url: '/users/profile-picture',
        method: 'DELETE',
      }),
      invalidatesTags: ['Profile', 'User'],
    }),

    // Education Management
    getEducationHistory: builder.query<UserEducation[], void>({
      query: () => '/users/education',
      transformResponse: (response: any) => response.data,
      providesTags: ['Profile'],
    }),

    addEducation: builder.mutation<UserEducation, CreateEducationRequest>({
      query: (data) => ({
        url: '/users/education',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile'],
    }),

    updateEducation: builder.mutation<UserEducation, { 
      educationId: string
      data: Partial<CreateEducationRequest>
    }>({
      query: ({ educationId, data }) => ({
        url: `/users/education/${educationId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile'],
    }),

    deleteEducation: builder.mutation<void, string>({
      query: (educationId) => ({
        url: `/users/education/${educationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Profile'],
    }),

    // Work Experience Management
    getWorkHistory: builder.query<UserWorkExperience[], void>({
      query: () => '/users/work-experience',
      transformResponse: (response: any) => response.data,
      providesTags: ['Profile'],
    }),

    addWorkExperience: builder.mutation<UserWorkExperience, CreateWorkExperienceRequest>({
      query: (data) => ({
        url: '/users/work-experience',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile'],
    }),

    updateWorkExperience: builder.mutation<UserWorkExperience, { 
      workId: string
      data: Partial<CreateWorkExperienceRequest>
    }>({
      query: ({ workId, data }) => ({
        url: `/users/work-experience/${workId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile'],
    }),

    deleteWorkExperience: builder.mutation<void, string>({
      query: (workId) => ({
        url: `/users/work-experience/${workId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Profile'],
    }),

    // Premium Features (Verified users only)
    getUserSettings: builder.query<{
      notifications: boolean
      privacy: Record<string, any>
      preferences: Record<string, any>
    }, void>({
      query: () => '/users/settings',
      transformResponse: (response: any) => response.data,
      providesTags: ['Profile'],
    }),

    updateUserSettings: builder.mutation<any, Record<string, any>>({
      query: (settings) => ({
        url: '/users/settings',
        method: 'PUT',
        body: settings,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Profile'],
    }),

    getUserActivity: builder.query<any[], void>({
      query: () => '/users/activity',
      transformResponse: (response: any) => response.data,
      providesTags: ['Profile'],
    }),

    // User Search for Mentions
    searchUsersForMentions: builder.query<MentionUser[], { query: string }>({
      query: ({ query }) => `/users/search?query=${encodeURIComponent(query)}`,
      transformResponse: (response: any) => response.data,
      keepUnusedDataFor: 60, // Cache for 1 minute
    }),

    // Event Registrations
    getMyEventRegistrations: builder.query<{
      registrations: any[]
      totalCount: number
      currentPage: number
      totalPages: number
    }, {
      page?: number
      limit?: number
      status?: string
      upcoming?: boolean
    }>({
      query: (params) => ({
        url: '/users/registrations',
        params,
      }),
      transformResponse: (response: any) => ({
        registrations: response.data || [],
        totalCount: response.pagination?.total || 0,
        currentPage: response.pagination?.page || 1,
        totalPages: response.pagination?.pages || 1,
      }),
      providesTags: ['EventRegistration', 'Profile'],
    }),

    // Public Organization Information
    getOrganizationInfo: builder.query<{
      organization: {
        id: string
        name: string
        shortName: string
        foundationYear: number
        officialEmail: string
        officialContactNumber?: string
        officeAddress?: string
        logoUrl?: string
        websiteUrl?: string
        instagramUrl?: string
        facebookUrl?: string
        youtubeUrl?: string
        twitterUrl?: string
        linkedinUrl?: string
      }
      isConfigured: boolean
    }, void>({
      query: () => '/organization',
      transformResponse: (response: any) => response.data,
      providesTags: ['Organization'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetPublicProfileQuery,
  useGetMembershipStatusQuery,
  useGetAddressesQuery,
  useUpdateAddressMutation,
  useUploadProfilePictureMutation,
  useUpdateProfilePictureMutation,
  useDeleteProfilePictureMutation,
  useGetEducationHistoryQuery,
  useAddEducationMutation,
  useUpdateEducationMutation,
  useDeleteEducationMutation,
  useGetWorkHistoryQuery,
  useAddWorkExperienceMutation,
  useUpdateWorkExperienceMutation,
  useDeleteWorkExperienceMutation,
  useGetUserSettingsQuery,
  useUpdateUserSettingsMutation,
  useGetUserActivityQuery,
  useSearchUsersForMentionsQuery,
  useGetMyEventRegistrationsQuery,
  useGetOrganizationInfoQuery,
} = userApi

export default userApi