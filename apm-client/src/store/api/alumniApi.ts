// src/store/api/alumniApi.ts
import { apiSlice } from './apiSlice'

// Types
export interface AlumniProfile {
  id: string
  fullName: string
  batch: number
  bio?: string
  employmentStatus: string
  profileImage?: string
  email?: string
  whatsappNumber?: string
  alternateNumber?: string
  linkedinUrl?: string
  instagramUrl?: string
  facebookUrl?: string
  twitterUrl?: string
  youtubeUrl?: string
  portfolioUrl?: string
  createdAt: string
  workHistory?: Array<{
    companyName: string
    jobRole: string
    companyType?: string
  }>
  educationHistory?: Array<{
    course: string
    stream?: string
    institution: string
    fromYear: number
    toYear?: number
  }>
  currentAddress?: {
    city: string
    state: string
    country: string
  }
}

export interface AlumniStats {
  totalAlumni: number
  recentJoins: number
  batchDistribution: Array<{
    year: number
    name: string
    totalMembers: number
  }>
  employmentDistribution: Array<{
    status: string
    count: number
  }>
}

export interface AlumniSearchParams {
  search?: string
  batch?: number
  employmentStatus?: string
  company?: string
  institution?: string
  city?: string
  state?: string
  country?: string
  sortBy?: 'fullName' | 'batch' | 'createdAt' | 'employmentStatus'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export const alumniApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Search alumni directory
    searchAlumni: builder.query<
      {
        success: boolean
        data: AlumniProfile[]
        pagination: {
          page: number
          limit: number
          total: number
          totalPages: number
          hasNext: boolean
          hasPrev: boolean
        }
      },
      AlumniSearchParams
    >({
      query: (params) => ({
        url: '/alumni/search',
        params,
      }),
      providesTags: ['Alumni'],
    }),

    // Get alumni statistics
    getAlumniStats: builder.query<{ success: boolean; data: { stats: AlumniStats } }, void>({
      query: () => '/alumni/stats',
      providesTags: ['AlumniStats'],
    }),

    // Get individual alumni profile
    getAlumniProfile: builder.query<
      { success: boolean; data: { user: AlumniProfile } },
      string
    >({
      query: (userId) => `/alumni/${userId}`,
      providesTags: (result, error, userId) => [{ type: 'Alumni', id: userId }],
    }),
  }),
})

export const {
  useSearchAlumniQuery,
  useLazySearchAlumniQuery,
  useGetAlumniStatsQuery,
  useGetAlumniProfileQuery,
} = alumniApi