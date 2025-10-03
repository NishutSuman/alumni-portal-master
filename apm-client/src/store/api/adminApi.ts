// src/store/api/adminApi.ts
import { apiSlice } from './apiSlice';

// Types for admin API responses
export interface DashboardOverview {
  userStats: {
    totalUsers: number;
    verifiedUsers: number;
    pendingVerifications: number;
    rejectedUsers: number;
    activeUsers: number;
  };
  adminStats: {
    totalAdmins: number;
    batchAdmins: number;
    superAdmins: number;
  };
  recentActivity: {
    registrations: number;
    verifications: number;
    events: number;
  };
  systemHealth: {
    status: 'healthy' | 'warning' | 'error';
    uptime: number;
    lastBackup?: string;
  };
}

export interface VerificationStats {
  pending: {
    total: number;
    byBatch: Array<{
      batch: number;
      count: number;
    }>;
  };
  processed: {
    approved: number;
    rejected: number;
    total: number;
  };
  recentActivity: Array<{
    id: string;
    action: 'approved' | 'rejected' | 'pending';
    userName: string;
    userEmail: string;
    batch: number;
    timestamp: string;
    adminName?: string;
  }>;
}

export interface PendingUser {
  id: string;
  fullName: string;
  email: string;
  batch: number;
  registeredAt: string;
  lastLoginAt?: string;
  profileCompleteness: number;
}

export interface OrganizationDetails {
  id: string;
  name: string;
  shortName?: string;
  foundationYear?: number;
  logoUrl?: string;
  websiteUrl?: string;
  officialEmail: string;
  officialContactNumber?: string;
  officeAddress?: string;
  description?: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  isConfigured: boolean;
  serialCounterCurrent: number;
}

// Inject admin endpoints into the main API slice
export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Dashboard Overview
    getDashboardOverview: builder.query<DashboardOverview, void>({
      query: () => '/admin/dashboard/overview',
      providesTags: ['Admin', 'Dashboard'],
    }),

    // User Management
    getAllUsers: builder.query<{
      users: Array<PendingUser & {
        role: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN';
        userStatus: 'email_pending' | 'email_verified' | 'alumni_verified' | 'rejected';
        isEmailVerified: boolean;
        serialId?: string;
        profileImage?: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      page?: number;
      limit?: number;
      search?: string;
      batch?: number;
      status?: 'email_pending' | 'email_verified' | 'alumni_verified' | 'rejected';
      role?: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN';
    }>({
      query: (params = {}) => ({
        url: '/admin/users',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Users'],
    }),

    updateUserRole: builder.mutation<
      { success: boolean; message: string },
      { userId: string; role: 'USER' | 'BATCH_ADMIN' | 'SUPER_ADMIN' }
    >({
      query: ({ userId, role }) => ({
        url: `/admin/users/${userId}/role`,
        method: 'PUT',
        body: { role },
      }),
      invalidatesTags: ['Admin', 'Users', 'Dashboard'],
    }),

    // Verification Management
    getVerificationStats: builder.query<VerificationStats, { timeframe?: number }>({
      query: (params = {}) => ({
        url: '/admin/verification/stats',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Verification'],
    }),

    getPendingVerifications: builder.query<{
      users: PendingUser[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }, {
      page?: number;
      limit?: number;
      batch?: number;
      search?: string;
    }>({
      query: (params = {}) => ({
        url: '/admin/verification/pending',
        params,
      }),
      providesTags: ['Admin', 'Verification', 'Users'],
    }),

    getVerificationDetails: builder.query<{
      user: PendingUser & {
        profileImage?: string;
        bio?: string;
        currentLocation?: string;
        whatsappNumber?: string;
        employmentStatus?: string;
      };
      verificationHistory: Array<{
        action: string;
        timestamp: string;
        adminName: string;
        notes?: string;
      }>;
    }, string>({
      query: (userId) => `/admin/verification/users/${userId}`,
      providesTags: ['Admin', 'Verification', 'Users'],
    }),

    verifyUser: builder.mutation<
      { success: boolean; message: string },
      { userId: string; notes?: string }
    >({
      query: ({ userId, notes }) => ({
        url: `/admin/verification/users/${userId}/verify`,
        method: 'POST',
        body: { notes },
      }),
      invalidatesTags: ['Admin', 'Verification', 'Users', 'Dashboard'],
    }),

    rejectUser: builder.mutation<
      { success: boolean; message: string },
      { userId: string; reason: string }
    >({
      query: ({ userId, reason }) => ({
        url: `/admin/verification/users/${userId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['Admin', 'Verification', 'Users', 'Dashboard'],
    }),

    bulkVerifyUsers: builder.mutation<
      { success: boolean; verifiedCount: number; message: string },
      { userIds: string[]; notes?: string }
    >({
      query: (data) => ({
        url: '/admin/verification/bulk-verify',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Admin', 'Verification', 'Users', 'Dashboard'],
    }),

    // Organization Management
    getOrganizationAdmin: builder.query<{
      organization: {
        id: string;
        name: string;
        shortName: string;
        foundationYear: number;
        officialEmail: string;
        officialContactNumber?: string;
        officeAddress?: string;
        logoUrl?: string;
        websiteUrl?: string;
        facebookUrl?: string;
        instagramUrl?: string;
        twitterUrl?: string;
        linkedinUrl?: string;
        youtubeUrl?: string;
        foundingMembers?: any[];
        createdAt: string;
        updatedAt: string;
        lastUpdatedAdmin?: {
          fullName: string;
          role: string;
        };
      };
      statistics: {
        totalUsers: number;
        totalVerified: number;
        totalBatches: number;
        currentSerialCounter: number;
        verificationRate: string;
      };
    }, void>({
      query: () => '/admin/organization/admin',
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Organization'],
    }),

    getOrganizationStats: builder.query<{
      organization: {
        name: string;
        shortName: string;
        foundationYear: number;
        age: number;
        currentSerialCounter: number;
      };
      userStatistics: {
        total: number;
        verified: number;
        pending: number;
        rejected: number;
        verificationRate: string;
      };
      batchStatistics: {
        totalBatches: number;
        activeBatches: number;
        batchRange: {
          oldest: { year: number; name: string } | null;
          newest: { year: number; name: string } | null;
          span: number;
        };
      };
      recentActivity: {
        newRegistrationsLast30Days: number;
        averageRegistrationsPerDay: string;
      };
    }, void>({
      query: () => '/admin/organization/admin/stats',
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Organization'],
    }),

    initializeOrganization: builder.mutation<{
      message: string;
      organization: {
        id: string;
        name: string;
        shortName: string;
        foundationYear: number;
        officialEmail: string;
        serialCounter: number;
      };
      nextSteps: string[];
    }, {
      name?: string;
      shortName?: string;
      foundationYear?: number;
      officialEmail: string;
      officialContactNumber?: string;
      officeAddress?: string;
    }>({
      query: (data) => ({
        url: '/admin/organization/admin/initialize',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Admin', 'Organization'],
    }),

    upsertOrganization: builder.mutation<{
      message: string;
      organization: {
        id: string;
        name: string;
        shortName: string;
        foundationYear: number;
        officialEmail: string;
        updatedAt: string;
      };
      action: {
        type: 'UPDATE' | 'CREATE';
        performedBy: string;
        performedAt: string;
      };
    }, {
      name: string;
      shortName: string;
      foundationYear: number;
      officialEmail: string;
      officialContactNumber?: string;
      officeAddress?: string;
      logoUrl?: string;
      bylawDocumentUrl?: string;
      registrationCertUrl?: string;
      websiteUrl?: string;
      instagramUrl?: string;
      facebookUrl?: string;
      youtubeUrl?: string;
      twitterUrl?: string;
      linkedinUrl?: string;
      foundingMembers?: any[];
    }>({
      query: (data) => ({
        url: '/admin/organization/admin',
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Admin', 'Organization'],
    }),

    updateSocialLinks: builder.mutation<{
      message: string;
      socialLinks: {
        websiteUrl?: string;
        instagramUrl?: string;
        facebookUrl?: string;
        youtubeUrl?: string;
        twitterUrl?: string;
        linkedinUrl?: string;
      };
    }, {
      websiteUrl?: string;
      instagramUrl?: string;
      facebookUrl?: string;
      youtubeUrl?: string;
      twitterUrl?: string;
      linkedinUrl?: string;
    }>({
      query: (data) => ({
        url: '/admin/organization/admin/social-links',
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Admin', 'Organization'],
    }),

    uploadOrganizationLogo: builder.mutation<{
      message: string;
      logoUrl: string;
      organization: {
        id: string;
        name: string;
        logoUrl: string;
      };
    }, FormData>({
      query: (formData) => ({
        url: '/admin/organization/admin/upload/logo',
        method: 'POST',
        body: formData,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Admin', 'Organization'],
    }),

    uploadOrganizationFiles: builder.mutation<{
      message: string;
      uploadedFiles: {
        logo?: {
          url: string;
          filename: string;
          size: number;
        };
        bylaw?: {
          url: string;
          filename: string;
          size: number;
        };
        certificate?: {
          url: string;
          filename: string;
          size: number;
        };
      };
      organization: {
        id: string;
        logoUrl?: string;
        bylawDocumentUrl?: string;
        registrationCertUrl?: string;
        updatedAt: string;
      };
    }, FormData>({
      query: (formData) => ({
        url: '/admin/organization/admin/upload/files',
        method: 'POST',
        body: formData,
        formData: true, // This ensures RTK Query treats it as FormData
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Admin', 'Organization'],
    }),

    // Analytics endpoints
    getUnifiedPaymentAnalytics: builder.query<{
      totalRevenue: number;
      monthlyRevenue: number;
      paymentBreakdown: Array<{
        type: string;
        amount: number;
        count: number;
      }>;
      trends: Array<{
        month: string;
        revenue: number;
      }>;
    }, { fromDate?: string; toDate?: string }>({
      query: (params = {}) => ({
        url: '/admin/dashboard/unified-payments',
        params,
      }),
      providesTags: ['Admin', 'Analytics'],
    }),

    getAnalyticsHealth: builder.query<{
      status: string;
      services: Record<string, string>;
      uptime: number;
      version: string;
    }, void>({
      query: () => '/admin/dashboard/analytics-health',
      providesTags: ['Admin', 'Health'],
    }),

    // Cache management
    getCacheStats: builder.query<{
      totalKeys: number;
      memoryUsage: string;
      hitRate: number;
      uptime: number;
    }, void>({
      query: () => '/admin/cache/stats',
      providesTags: ['Admin', 'Cache'],
    }),

    clearCache: builder.mutation<
      { success: boolean; message: string },
      { cacheType?: string }
    >({
      query: (data = {}) => ({
        url: '/admin/cache/clear',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Admin', 'Cache'],
    }),

    refreshAnalyticsCache: builder.mutation<
      { success: boolean; message: string },
      void
    >({
      query: () => ({
        url: '/admin/dashboard/refresh-analytics',
        method: 'POST',
      }),
      invalidatesTags: ['Admin', 'Analytics', 'Dashboard'],
    }),

    // Event Analytics
    getEventRegistrationsAdmin: builder.query<{
      registrations: Array<{
        id: string;
        user: {
          id: string;
          fullName: string;
          batch: number | null;
          profileImage?: string;
          email: string;
        };
        event: {
          id: string;
          title: string;
          eventDate: string;
        };
        totalGuests: number;
        donationAmount: number;
        totalAmount: number;
        registrationDate: string;
        status: string;
      }>;
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
      };
    }, {
      eventId?: string;
      batch?: string;
      status?: string;
      page?: number;
      limit?: number;
    }>({
      query: (params = {}) => {
        const { eventId, ...queryParams } = params;
        return {
          url: eventId ? `/events/${eventId}/registrations/admin` : '/admin/event-registrations',
          params: queryParams,
        };
      },
      transformResponse: (response: any) => {
        return response.data || response;
      },
      providesTags: ['Admin', 'EventRegistrations'],
    }),

    getUserBatches: builder.query<number[], void>({
      query: () => '/admin/users/batches',
      transformResponse: (response: any) => {
        return response.data || response;
      },
      providesTags: ['Admin', 'UserBatches'],
    }),
  }),
  overrideExisting: false,
});

// Export hooks for use in components
export const {
  // Dashboard
  useGetDashboardOverviewQuery,
  
  // User Management
  useGetAllUsersQuery,
  useUpdateUserRoleMutation,
  
  // Verification
  useGetVerificationStatsQuery,
  useGetPendingVerificationsQuery,
  useGetVerificationDetailsQuery,
  useVerifyUserMutation,
  useRejectUserMutation,
  useBulkVerifyUsersMutation,
  
  // Organization
  useGetOrganizationAdminQuery,
  useGetOrganizationStatsQuery,
  useInitializeOrganizationMutation,
  useUpsertOrganizationMutation,
  useUpdateSocialLinksMutation,
  useUploadOrganizationLogoMutation,
  useUploadOrganizationFilesMutation,
  
  // Analytics
  useGetUnifiedPaymentAnalyticsQuery,
  useGetAnalyticsHealthQuery,
  
  // Cache
  useGetCacheStatsQuery,
  useClearCacheMutation,
  useRefreshAnalyticsCacheMutation,
  
  // Event Analytics
  useGetEventRegistrationsAdminQuery,
  useGetUserBatchesQuery,
} = adminApi;

export default adminApi;