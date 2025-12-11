// src/store/api/announcementApi.ts
import { apiSlice } from './apiSlice';

export interface Announcement {
  id: string;
  message: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    fullName: string;
    profileImage?: string;
  };
}

export interface AnnouncementPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Inject announcement endpoints into the main API slice
export const announcementApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ============================================
    // USER ENDPOINTS
    // ============================================

    // Get active announcements (for dashboard banner)
    getActiveAnnouncements: builder.query<{
      announcements: Announcement[];
    }, void>({
      query: () => '/announcements/active',
      transformResponse: (response: any) => response.data,
      providesTags: ['Announcement'],
    }),

    // Get all announcements (user history)
    getUserAnnouncements: builder.query<{
      announcements: Announcement[];
      pagination: AnnouncementPagination;
    }, {
      page?: number;
      limit?: number;
    }>({
      query: (params = {}) => ({
        url: '/announcements',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Announcement'],
    }),

    // ============================================
    // ADMIN ENDPOINTS
    // ============================================

    // Get all announcements for admin (with all statuses)
    getAdminAnnouncements: builder.query<{
      announcements: Announcement[];
      pagination: AnnouncementPagination;
    }, {
      page?: number;
      limit?: number;
      status?: 'active' | 'inactive';
    }>({
      query: (params = {}) => ({
        url: '/announcements/admin',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Announcement'],
    }),

    // Create new announcement
    createAnnouncement: builder.mutation<{
      success: boolean;
      data: Announcement;
      message: string;
    }, {
      message: string;
    }>({
      query: (data) => ({
        url: '/announcements',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Announcement'],
    }),

    // Toggle announcement active/inactive status
    toggleAnnouncementStatus: builder.mutation<{
      success: boolean;
      data: Announcement;
      message: string;
    }, string>({
      query: (id) => ({
        url: `/announcements/${id}/toggle`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Announcement'],
    }),

    // Delete announcement
    deleteAnnouncement: builder.mutation<{
      success: boolean;
      message: string;
    }, string>({
      query: (id) => ({
        url: `/announcements/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Announcement'],
    }),
  }),
  overrideExisting: false,
});

// Export hooks
export const {
  // User hooks
  useGetActiveAnnouncementsQuery,
  useGetUserAnnouncementsQuery,
  // Admin hooks
  useGetAdminAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useToggleAnnouncementStatusMutation,
  useDeleteAnnouncementMutation,
} = announcementApi;

export default announcementApi;
