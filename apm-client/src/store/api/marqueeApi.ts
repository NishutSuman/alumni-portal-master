// src/store/api/marqueeApi.ts
import { apiSlice } from './apiSlice';

export interface MarqueeProfile {
  id: string;
  type: 'real' | 'dummy';
  profileImage: string;
}

export const marqueeApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get marquee profile pictures (public endpoint)
    getMarqueeProfiles: builder.query<MarqueeProfile[], void>({
      // CRITICAL: Add tenant code to query URL so RTK Query caches per-tenant
      // Otherwise all tenants share the same cached marquee data!
      query: () => {
        const orgCode = localStorage.getItem('guild-org-code') || 'default';
        return `/demo/marquee-profiles?v=3&tenant=${orgCode}`;
      },
      transformResponse: (response: any) => response.data,
      // Cache for 7 days (same as backend)
      keepUnusedDataFor: 604800, // 7 days in seconds
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetMarqueeProfilesQuery,
} = marqueeApi;
