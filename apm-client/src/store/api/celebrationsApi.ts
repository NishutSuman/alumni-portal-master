// src/store/api/celebrationsApi.ts
import { apiSlice } from './apiSlice'

// Types for celebration API responses
export interface Birthday {
  id: string
  fullName: string
  profileImage?: string
  batch: number
  dateOfBirth: string
  age: number
  isToday: boolean
  daysUntil?: number
  monthDay: string // Format: "MM-DD"
}

export interface Festival {
  id: string
  name: string
  date?: {
    iso: string
    formatted?: string
  } | string
  type?: string[]
  description?: string
  festivalType: 'NATIONAL_HOLIDAY' | 'HINDU' | 'MUSLIM' | 'CHRISTIAN' | 'SIKH' | 'BUDDHIST' | 'CULTURAL' | 'REGIONAL'
  priority: 'MAJOR' | 'MEDIUM' | 'MINOR'
  // Support both database structure and API styling wrapper
  vectorImage?: string
  backgroundColor?: string
  textColor?: string
  styling?: {
    backgroundColor: string
    textColor: string
    vectorImage?: string
  }
  greetingMessage?: string
  religion?: string | null
  isToday?: boolean
  daysUntil?: number
  dayName?: string
}

export interface TodaysBirthdays {
  birthdays: Birthday[]
  count: number
  date: string
}

export interface UpcomingBirthdays {
  upcomingBirthdays: Array<{
    date: string
    birthdays: Birthday[]
    dayName: string
    daysFromToday: number
  }>
  totalDays: number
  lookAheadDays: number
}

export interface TodaysFestivals {
  festivals: Festival[]
  count: number
  date: string
}

export interface UpcomingFestivals {
  upcomingFestivals: Array<{
    date: string
    festivals: Festival[]
    dayName: string
    daysUntil: number
  }>
  lookAheadDays: number
}

export interface TodaysCelebrations {
  birthdays: Birthday[]
  festivals: Festival[]
  date: string
  summary: {
    totalBirthdays: number
    totalFestivals: number
    totalCelebrations: number
  }
}

export interface BirthdayStats {
  totalUsers: number
  usersWithBirthdays: number
  birthdaysThisMonth: number
  birthdaysNextMonth: number
  upcomingInWeek: number
  monthlyDistribution: Array<{
    month: number
    monthName: string
    count: number
  }>
}

export interface FestivalStats {
  totalFestivals: number
  festivalsThisMonth: number
  festivalsNextMonth: number
  upcomingInWeek: number
  byType: Array<{
    type: string
    count: number
  }>
  byPriority: Array<{
    priority: string
    count: number
  }>
}

// Inject celebration endpoints into the main API slice
export const celebrationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Birthday Endpoints
    getTodaysBirthdays: builder.query<TodaysBirthdays, void>({
      query: () => '/celebrations/birthdays/today',
      transformResponse: (response: any) => response.data,
      providesTags: ['Celebrations', 'Birthdays'],
    }),

    getUpcomingBirthdays: builder.query<UpcomingBirthdays, { days?: number }>({
      query: (params = {}) => ({
        url: '/celebrations/birthdays/upcoming',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Celebrations', 'Birthdays'],
    }),

    // Festival Endpoints (Public)
    getTodaysFestivals: builder.query<TodaysFestivals, void>({
      query: () => '/celebrations/festivals/today',
      transformResponse: (response: any) => response.data,
      providesTags: ['Celebrations', 'Festivals'],
    }),

    getUpcomingFestivals: builder.query<UpcomingFestivals, { days?: number }>({
      query: (params = {}) => ({
        url: '/celebrations/festivals/upcoming',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Celebrations', 'Festivals'],
    }),

    // Combined Celebrations
    getTodaysCelebrations: builder.query<TodaysCelebrations, void>({
      query: () => '/celebrations/today',
      transformResponse: (response: any) => response.data,
      providesTags: ['Celebrations', 'Birthdays', 'Festivals'],
    }),

    // Festival Search and Calendar
    searchFestivals: builder.query<{
      festivals: Festival[]
      pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
      }
    }, {
      q?: string
      festivalType?: string
      religion?: string
      priority?: string
      year?: number
      limit?: number
      page?: number
    }>({
      query: (params = {}) => ({
        url: '/celebrations/festivals/search',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Celebrations', 'Festivals'],
    }),

    getFestivalCalendar: builder.query<{
      calendar: Array<{
        month: number
        monthName: string
        festivals: Festival[]
      }>
      year: number
      totalFestivals: number
    }, { year?: number }>({
      query: (params = {}) => ({
        url: '/celebrations/festivals/calendar',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Celebrations', 'Festivals'],
    }),

    // Admin Statistics (for admin users)
    getBirthdayStats: builder.query<BirthdayStats, void>({
      query: () => '/celebrations/admin/birthdays/stats',
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Celebrations', 'Birthdays'],
    }),

    getFestivalStats: builder.query<FestivalStats, void>({
      query: () => '/celebrations/admin/festivals/stats',
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Celebrations', 'Festivals'],
    }),

    getCelebrationSummary: builder.query<{
      birthdays: BirthdayStats
      festivals: FestivalStats
      today: TodaysCelebrations
      systemHealth: {
        lastSyncAt?: string
        cacheStatus: string
        apiStatus: string
      }
    }, void>({
      query: () => '/celebrations/admin/summary',
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Celebrations'],
    }),

    // Birthday Distribution by Month
    getBirthdayDistribution: builder.query<Array<{
      month: number
      monthName: string
      count: number
      birthdays: Birthday[]
    }>, void>({
      query: () => '/celebrations/admin/birthdays/distribution',
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Celebrations', 'Birthdays'],
    }),

    getBirthdaysInMonth: builder.query<{
      month: number
      monthName: string
      year: number
      birthdays: Birthday[]
      count: number
    }, { month: number; year?: number }>({
      query: ({ month, year }) => ({
        url: `/celebrations/admin/birthdays/month/${month}`,
        params: year ? { year } : {},
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Admin', 'Celebrations', 'Birthdays'],
    }),

    // Admin Actions
    triggerFestivalSync: builder.mutation<{
      message: string
      syncedCount: number
      syncId: string
    }, void>({
      query: () => ({
        url: '/celebrations/admin/festivals/sync',
        method: 'POST',
      }),
      invalidatesTags: ['Celebrations', 'Festivals'],
    }),

    triggerBirthdayNotifications: builder.mutation<{
      message: string
      notificationsSent: number
      recipients: string[]
    }, void>({
      query: () => ({
        url: '/celebrations/admin/birthdays/trigger',
        method: 'POST',
      }),
      invalidatesTags: ['Celebrations', 'Birthdays'],
    }),

    toggleFestivalNotifications: builder.mutation<{
      message: string
      festival: {
        name: string
        notificationsEnabled: boolean
      }
    }, { festivalId: string; enabled: boolean }>({
      query: ({ festivalId, enabled }) => ({
        url: `/celebrations/admin/festivals/${festivalId}/notifications`,
        method: 'PUT',
        body: { enabled },
      }),
      invalidatesTags: ['Celebrations', 'Festivals'],
    }),
  }),
  overrideExisting: false,
})

// Export hooks for use in components
export const {
  // Birthday hooks
  useGetTodaysBirthdaysQuery,
  useGetUpcomingBirthdaysQuery,
  useGetBirthdayStatsQuery,
  useGetBirthdayDistributionQuery,
  useGetBirthdaysInMonthQuery,
  
  // Festival hooks
  useGetTodaysFestivalsQuery,
  useGetUpcomingFestivalsQuery,
  useSearchFestivalsQuery,
  useGetFestivalCalendarQuery,
  useGetFestivalStatsQuery,
  
  // Combined celebrations
  useGetTodaysCelebrationsQuery,
  useGetCelebrationSummaryQuery,
  
  // Admin mutations
  useTriggerFestivalSyncMutation,
  useTriggerBirthdayNotificationsMutation,
  useToggleFestivalNotificationsMutation,
} = celebrationsApi

export default celebrationsApi