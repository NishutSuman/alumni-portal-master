// src/store/api/lifeLinkApi.ts
// LifeLink Blood Donation Network API

import { apiSlice } from './apiSlice'
import type {
  BloodProfile,
  BloodDonation,
  BloodRequisition,
  DonorNotification,
  DonorResponse,
  LifeLinkDashboardParams,
  LifeLinkDashboardResponse,
  BloodGroupStatsResponse,
  DonationStatusResponse,
  SearchDonorsRequest,
  SearchDonorsResponse,
  CreateRequisitionRequest,
  AddDonationRequest,
  UpdateBloodProfileRequest,
  NotifyDonorsRequest,
  RespondToRequisitionRequest,
  BloodDonationsResponse,
  BloodRequisitionsResponse,
  DonorNotificationsResponse,
  DiscoverRequisitionsResponse,
  LifeLinkAnalytics,
  RequisitionAnalytics,
  PaginatedResponse,
} from '../../types/lifeLink'

// LifeLink API endpoints
export const lifeLinkApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ============================================
    // PUBLIC ROUTES (Dashboard & Info)
    // ============================================

    // Get LifeLink dashboard with all donors
    getLifeLinkDashboard: builder.query<LifeLinkDashboardResponse, LifeLinkDashboardParams>({
      query: (params) => ({
        url: '/lifelink/dashboard',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['LifeLink'],
      keepUnusedDataFor: 600, // 10 minutes - donors list changes less frequently
    }),

    // Get blood group statistics
    getBloodGroupStats: builder.query<BloodGroupStatsResponse, void>({
      query: () => '/lifelink/stats/bloodgroups',
      transformResponse: (response: any) => response.data,
      providesTags: ['LifeLink'],
      keepUnusedDataFor: 3600, // 1 hour - statistics change slowly
    }),

    // ============================================
    // USER PROFILE ROUTES (Blood Profile)
    // ============================================

    // Get user's blood profile
    getBloodProfile: builder.query<BloodProfile, void>({
      query: () => '/lifelink/profile/blood',
      transformResponse: (response: any) => response.data,
      providesTags: ['LifeLink', 'Profile'],
      keepUnusedDataFor: 1800, // 30 minutes - profile data is relatively stable
    }),

    // Update user's blood profile
    updateBloodProfile: builder.mutation<BloodProfile, UpdateBloodProfileRequest>({
      query: (data) => ({
        url: '/lifelink/profile/blood',
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['LifeLink', 'Profile', 'User'],
    }),

    // ============================================
    // DONATION MANAGEMENT ROUTES
    // ============================================

    // Get user's donation history
    getMyDonations: builder.query<BloodDonationsResponse, {
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: '/lifelink/my-donations',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result) => [
        'Donation',
        ...(result?.donations?.map(({ id }) => ({ type: 'Donation' as const, id })) ?? []),
      ],
      keepUnusedDataFor: 900, // 15 minutes - donation history doesn't change often
    }),

    // Add new donation record
    addDonation: builder.mutation<BloodDonation, AddDonationRequest>({
      query: (data) => ({
        url: '/lifelink/donations',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Donation', 'LifeLink', 'Profile'],
    }),

    // Check donation eligibility status
    getDonationStatus: builder.query<DonationStatusResponse, void>({
      query: () => '/lifelink/donation-status',
      transformResponse: (response: any) => response.data,
      providesTags: ['LifeLink'],
      keepUnusedDataFor: 300, // 5 minutes - eligibility can change daily
    }),

    // ============================================
    // EMERGENCY REQUISITION ROUTES
    // ============================================

    // Create blood requisition
    createRequisition: builder.mutation<BloodRequisition, CreateRequisitionRequest>({
      query: (data) => ({
        url: '/lifelink/requisitions',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['BloodRequisition', 'LifeLink'],
    }),

    // Get user's requisitions
    getMyRequisitions: builder.query<BloodRequisitionsResponse, {
      status?: string;
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: '/lifelink/my-requisitions',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result) => [
        'BloodRequisition',
        ...(result?.requisitions?.map(({ id }) => ({ type: 'BloodRequisition' as const, id })) ?? []),
      ],
      keepUnusedDataFor: 600, // 10 minutes
    }),

    // Get single requisition details
    getRequisition: builder.query<BloodRequisition, string>({
      query: (requisitionId) => `/lifelink/requisitions/${requisitionId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, requisitionId) => [
        { type: 'BloodRequisition', id: requisitionId },
      ],
      keepUnusedDataFor: 300, // 5 minutes - requisition data can change with responses
    }),

    // Update requisition status
    updateRequisitionStatus: builder.mutation<BloodRequisition, {
      requisitionId: string;
      status: string;
    }>({
      query: ({ requisitionId, ...data }) => ({
        url: `/lifelink/requisitions/${requisitionId}/status`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { requisitionId }) => [
        { type: 'BloodRequisition', id: requisitionId },
        'BloodRequisition',
        'LifeLink',
      ],
    }),

    // Reuse expired requisition
    reuseRequisition: builder.mutation<BloodRequisition, string>({
      query: (requisitionId) => ({
        url: `/lifelink/requisitions/${requisitionId}/reuse`,
        method: 'PUT',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, requisitionId) => [
        { type: 'BloodRequisition', id: requisitionId },
        'BloodRequisition',
        'LifeLink',
      ],
    }),

    // ============================================
    // DONOR SEARCH ROUTES
    // ============================================

    // Discover available requisitions for donors
    discoverRequisitions: builder.query<DiscoverRequisitionsResponse, {
      urgencyLevel?: string;
      maxDistance?: number;
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: '/lifelink/discover-requisitions',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['BloodRequisition'],
      keepUnusedDataFor: 180, // 3 minutes - requisitions change frequently
    }),

    // Search compatible donors
    searchDonors: builder.mutation<SearchDonorsResponse, SearchDonorsRequest>({
      query: (data) => ({
        url: '/lifelink/search-donors',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      // No invalidation for search - it's a read operation
    }),

    // Get willing donors for a requisition
    getWillingDonors: builder.query<{
      donors: Array<BloodProfile & { response: DonorResponse }>;
      totalCount: number;
    }, string>({
      query: (requisitionId) => `/lifelink/willing-donors/${requisitionId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, requisitionId) => [
        { type: 'BloodRequisition', id: requisitionId },
      ],
      keepUnusedDataFor: 180, // 3 minutes - responses change frequently
    }),

    // ============================================
    // NOTIFICATION ROUTES
    // ============================================

    // Notify selected donors
    notifySelectedDonors: builder.mutation<{
      notificationsSent: number;
      donorsNotified: string[];
    }, NotifyDonorsRequest>({
      query: (data) => ({
        url: '/lifelink/notify-selected',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['BloodRequisition', 'LifeLink'],
    }),

    // Broadcast to all available donors in area
    notifyAllDonors: builder.mutation<{
      notificationsSent: number;
      donorsNotified: string[];
    }, { requisitionId: string }>({
      query: (data) => ({
        url: '/lifelink/notify-all',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['BloodRequisition', 'LifeLink'],
    }),

    // Get user's emergency notifications
    getMyNotifications: builder.query<DonorNotificationsResponse, {
      status?: string;
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: '/lifelink/notifications',
        params,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
        pagination: response.pagination,
      }),
      providesTags: ['Notification'],
      keepUnusedDataFor: 120, // 2 minutes - notifications change frequently
    }),

    // Mark notification as read
    markNotificationRead: builder.mutation<DonorNotification, string>({
      query: (notificationId) => ({
        url: `/lifelink/notifications/${notificationId}/read`,
        method: 'PUT',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Notification'],
    }),

    // ============================================
    // DONOR RESPONSE ROUTES
    // ============================================

    // Respond to emergency notification
    respondToNotification: builder.mutation<DonorResponse, {
      notificationId: string;
      response: RespondToRequisitionRequest;
    }>({
      query: ({ notificationId, response }) => ({
        url: `/lifelink/notifications/${notificationId}/respond`,
        method: 'POST',
        body: response,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Notification', 'BloodRequisition'],
    }),

    // Respond to requisition directly
    respondToRequisition: builder.mutation<DonorResponse, {
      requisitionId: string;
      response: RespondToRequisitionRequest;
    }>({
      query: ({ requisitionId, response }) => ({
        url: `/lifelink/requisitions/${requisitionId}/respond`,
        method: 'POST',
        body: response,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { requisitionId }) => [
        { type: 'BloodRequisition', id: requisitionId },
        'BloodRequisition',
      ],
    }),

    // ============================================
    // ADMIN ROUTES
    // ============================================

    // Get all requisitions (Admin)
    getAdminRequisitions: builder.query<BloodRequisitionsResponse, {
      status?: string;
      urgencyLevel?: string;
      page?: number;
      limit?: number;
    }>({
      query: (params) => ({
        url: '/lifelink/admin/requisitions',
        params,
      }),
      transformResponse: (response: any) => ({
        data: response.data,
        pagination: response.pagination,
      }),
      providesTags: ['BloodRequisition'],
    }),

    // Get LifeLink analytics (Admin)
    getLifeLinkAnalytics: builder.query<LifeLinkAnalytics, {
      startDate?: string;
      endDate?: string;
    }>({
      query: (params) => ({
        url: '/lifelink/admin/analytics',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Analytics'],
      keepUnusedDataFor: 1800, // 30 minutes - analytics change slowly
    }),

    // Get donor response analytics for requisition (Admin)
    getRequisitionAnalytics: builder.query<RequisitionAnalytics, string>({
      query: (requisitionId) => `/lifelink/admin/requisitions/${requisitionId}/analytics`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, requisitionId) => [
        { type: 'BloodRequisition', id: requisitionId },
        'Analytics',
      ],
    }),
  }),
  overrideExisting: false,
})

// Export hooks for all endpoints
export const {
  // Dashboard & Info
  useGetLifeLinkDashboardQuery,
  useGetBloodGroupStatsQuery,

  // Blood Profile
  useGetBloodProfileQuery,
  useUpdateBloodProfileMutation,

  // Donation Management
  useGetMyDonationsQuery,
  useAddDonationMutation,
  useGetDonationStatusQuery,

  // Emergency Requisitions
  useCreateRequisitionMutation,
  useGetMyRequisitionsQuery,
  useGetRequisitionQuery,
  useUpdateRequisitionStatusMutation,
  useReuseRequisitionMutation,

  // Donor Search
  useDiscoverRequisitionsQuery,
  useSearchDonorsMutation,
  useGetWillingDonorsQuery,

  // Notifications
  useNotifySelectedDonorsMutation,
  useNotifyAllDonorsMutation,
  useGetMyNotificationsQuery,
  useMarkNotificationReadMutation,

  // Donor Responses
  useRespondToNotificationMutation,
  useRespondToRequisitionMutation,

  // Admin
  useGetAdminRequisitionsQuery,
  useGetLifeLinkAnalyticsQuery,
  useGetRequisitionAnalyticsQuery,
} = lifeLinkApi