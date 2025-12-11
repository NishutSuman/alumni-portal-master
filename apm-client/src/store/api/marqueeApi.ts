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
      query: () => '/demo/marquee-profiles?v=3',
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
