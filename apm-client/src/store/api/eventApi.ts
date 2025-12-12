import { apiSlice } from './apiSlice'
import { getApiUrl } from '@/utils/helpers'

export interface EventCategory {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    events: number
  }
}

export interface Event {
  id: string
  title: string
  description?: string
  slug: string
  eventDate: string
  startTime?: string
  endTime?: string
  categoryId?: string
  category?: EventCategory
  venue?: string
  meetingLink?: string
  maxCapacity?: number
  eventMode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'
  status: 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'COMPLETED' | 'CANCELLED'
  registrationStartDate?: string
  registrationEndDate?: string
  registrationFee?: number
  guestFee?: number
  hasRegistration: boolean
  hasExternalLink: boolean
  hasCustomForm: boolean
  hasMeals: boolean
  hasGuests: boolean
  hasDonations: boolean
  hasPrizes: boolean
  hasSponsors: boolean
  hasOrganizers: boolean
  allowFormModification: boolean
  formModificationDeadlineHours?: number
  heroImage?: string
  images?: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
  _count?: {
    registrations: number
    guests: number
  }
}

export interface EventSection {
  id: string
  eventId: string
  type: 'SCHEDULE' | 'ORGANIZERS' | 'LOCATION' | 'PRIZES' | 'SPONSORS' | 'DONATIONS' | 'CUSTOM'
  title: string
  content?: string
  orderIndex: number
  isVisible: boolean
  createdAt: string
  updatedAt: string
}

export interface EventRegistration {
  id: string
  eventId: string
  userId: string
  user: {
    id: string
    fullName: string
    email: string
    batch: string
    profileImage?: string
  }
  totalAmount: number
  registrationFeePaid: boolean
  guestFeesPaid: boolean
  donationAmount?: number
  totalGuests: number
  activeGuests: number
  status: 'CONFIRMED' | 'CANCELLED' | 'WAITLIST'
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  lastModifiedAt?: string
  modificationCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateEventRequest {
  title: string
  description?: string
  eventDate: string
  startTime?: string
  endTime?: string
  categoryId?: string
  venue?: string
  meetingLink?: string
  maxCapacity?: number
  eventMode: 'PHYSICAL' | 'VIRTUAL' | 'HYBRID'
  registrationStartDate?: string
  registrationEndDate?: string
  registrationFee?: number
  guestFee?: number
  hasRegistration: boolean
  hasExternalLink: boolean
  hasCustomForm: boolean
  hasMeals: boolean
  hasGuests: boolean
  hasDonations: boolean
  hasPrizes: boolean
  hasSponsors: boolean
  hasOrganizers: boolean
  allowFormModification: boolean
  formModificationDeadlineHours?: number
  heroImage?: File
  images?: FileList
}

export interface UpdateEventRequest extends Partial<CreateEventRequest> {
  id: string
}

export interface EventsResponse {
  events: Event[]
  totalCount: number
  currentPage: number
  totalPages: number
}

export interface EventsQueryParams {
  page?: number
  limit?: number
  search?: string
  category?: string
  status?: string
  mode?: string
  upcoming?: boolean
  past?: boolean
}

export interface CategoriesResponse {
  categories: EventCategory[]
  totalCount: number
}

export interface CreateCategoryRequest {
  name: string
  description?: string
}

export interface UpdateCategoryRequest {
  id: string
  name: string
  description?: string
}

export const eventApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Event Categories
    getEventCategories: builder.query<CategoriesResponse, void>({
      query: () => '/events/categories',
      transformResponse: (response: any) => response.data,
      providesTags: ['EventCategory'],
    }),

    createEventCategory: builder.mutation<EventCategory, CreateCategoryRequest>({
      query: (data) => ({
        url: '/events/categories',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['EventCategory'],
    }),

    updateEventCategory: builder.mutation<EventCategory, UpdateCategoryRequest>({
      query: ({ id, ...data }) => ({
        url: `/events/categories/${id}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['EventCategory'],
    }),

    deleteEventCategory: builder.mutation<void, string>({
      query: (id) => ({
        url: `/events/categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['EventCategory'],
    }),

    // Events
    getEvents: builder.query<EventsResponse, EventsQueryParams>({
      query: (params) => ({
        url: '/events',
        params,
      }),
      transformResponse: (response: any) => ({
        events: response.data || [],
        totalCount: response.pagination?.total || 0,
        currentPage: response.pagination?.page || 1,
        totalPages: response.pagination?.pages || 1,
      }),
      providesTags: (result) =>
        result && result.events
          ? [
              ...result.events.map(({ id }) => ({ type: 'Event' as const, id })),
              { type: 'Event', id: 'LIST' },
            ]
          : [{ type: 'Event', id: 'LIST' }],
    }),

    getEvent: builder.query<Event, string>({
      query: (id) => `/events/${id}`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, id) => [{ type: 'Event', id }],
    }),

    createEvent: builder.mutation<Event, FormData>({
      queryFn: async (formData, { getState }) => {
        try {
          const state = getState() as any;
          const token = state.auth.token;
          
          console.log('🚀 Custom queryFn for createEvent:', {
            isFormData: formData instanceof FormData,
            hasToken: !!token
          });
          
          const response = await fetch(getApiUrl('/api/events'), {
            method: 'POST',
            headers: {
              ...(token && { 'authorization': `Bearer ${token}` }),
              // Don't set Content-Type - let browser handle it for FormData
            },
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            return { error: errorData };
          }

          const result = await response.json();
          return { data: result.data };
        } catch (error) {
          console.error('CreateEvent error:', error);
          return { error: { message: 'Network error occurred' } };
        }
      },
      invalidatesTags: [{ type: 'Event', id: 'LIST' }],
    }),

    updateEvent: builder.mutation<Event, { id: string; data: FormData }>({
      query: ({ id, data }) => ({
        url: `/events/${id}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Event', id },
        { type: 'Event', id: 'LIST' },
      ],
    }),

    updateEventStatus: builder.mutation<Event, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/events/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Event', id },
        { type: 'Event', id: 'LIST' },
      ],
    }),

    deleteEvent: builder.mutation<void, string>({
      query: (id) => ({
        url: `/events/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Event', id: 'LIST' }],
    }),

    // Event Sections
    getEventSections: builder.query<EventSection[], string>({
      query: (eventId) => `/events/${eventId}/sections`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, eventId) => [{ type: 'EventSection', id: eventId }],
    }),

    createEventSection: builder.mutation<EventSection, { eventId: string; type: string; title: string; content?: string; isVisible?: boolean }>({
      query: ({ eventId, ...data }) => ({
        url: `/events/${eventId}/sections`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { eventId }) => [{ type: 'EventSection', id: eventId }],
    }),

    updateEventSection: builder.mutation<EventSection, { eventId: string; sectionId: string; title: string; content?: string; isVisible?: boolean }>({
      query: ({ eventId, sectionId, ...data }) => ({
        url: `/events/${eventId}/sections/${sectionId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { eventId }) => [{ type: 'EventSection', id: eventId }],
    }),

    deleteEventSection: builder.mutation<void, { eventId: string; sectionId: string }>({
      query: ({ eventId, sectionId }) => ({
        url: `/events/${eventId}/sections/${sectionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { eventId }) => [{ type: 'EventSection', id: eventId }],
    }),

    reorderEventSections: builder.mutation<void, { eventId: string; sectionIds: string[] }>({
      query: ({ eventId, sectionIds }) => ({
        url: `/events/${eventId}/sections/reorder`,
        method: 'POST',
        body: { sectionIds },
      }),
      invalidatesTags: (result, error, { eventId }) => [{ type: 'EventSection', id: eventId }],
    }),

    // Event Registrations - Admin endpoints
    getEventRegistrations: builder.query<{ registrations: EventRegistration[]; totalCount: number }, { eventId: string; page?: number; limit?: number }>({
      query: ({ eventId, page = 1, limit = 50 }) => ({
        url: `/events/${eventId}/registrations`,
        params: { page, limit },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, { eventId }) => [{ type: 'EventRegistration', id: eventId }],
    }),

    getEventRegistrationStats: builder.query<any, string>({
      query: (eventId) => `/events/${eventId}/registrations/stats`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, eventId) => [{ type: 'EventRegistration', id: `${eventId}-stats` }],
    }),

    getEventRegistrationAdmin: builder.query<any, string>({
      query: (eventId) => `/events/${eventId}/registrations/admin`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, eventId) => [{ type: 'EventRegistration', id: `${eventId}-admin` }],
    }),

    // User Registration endpoints
    registerForEvent: builder.mutation<{ registration: EventRegistration; paymentRequired: boolean; paymentAmount: number }, { eventId: string; mealPreference?: string; formResponses?: Array<{ fieldId: string; response: string }>; agreeToTerms?: boolean }>({
      query: ({ eventId, ...data }) => ({
        url: `/events/${eventId}/register`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'EventRegistration', id: eventId },
        { type: 'Event', id: eventId },
      ],
    }),

    getMyRegistration: builder.query<{ registration: EventRegistration & { canModify: any; modificationDeadline: any } }, string>({
      query: (eventId) => `/events/${eventId}/my-registration`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, eventId) => [{ type: 'MyRegistration', id: eventId }],
    }),

    updateMyRegistration: builder.mutation<{ registration: EventRegistration }, { eventId: string; mealPreference?: string; formResponses?: Array<{ fieldId: string; response: string }> }>({
      query: ({ eventId, ...data }) => ({
        url: `/events/${eventId}/my-registration`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { eventId }) => [
        { type: 'MyRegistration', id: eventId },
        { type: 'EventRegistration', id: eventId },
      ],
    }),

    cancelMyRegistration: builder.mutation<void, string>({
      query: (eventId) => ({
        url: `/events/${eventId}/my-registration`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, eventId) => [
        { type: 'MyRegistration', id: eventId },
        { type: 'EventRegistration', id: eventId },
        { type: 'Event', id: eventId },
      ],
    }),

    // QR Code Generation
    generateMyQRCode: builder.query<{ qrCode: string; qrImageUrl?: string; generatedAt: string; isNew: boolean; eventTitle: string; registrationSummary: any }, string>({
      query: (eventId) => `/events/${eventId}/my-registration/qr-code`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, eventId) => [{ type: 'QRCode', id: eventId }],
    }),
  }),
  overrideExisting: false,
})

export const {
  // Categories
  useGetEventCategoriesQuery,
  useCreateEventCategoryMutation,
  useUpdateEventCategoryMutation,
  useDeleteEventCategoryMutation,
  
  // Events
  useGetEventsQuery,
  useGetEventQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useUpdateEventStatusMutation,
  useDeleteEventMutation,
  
  // Sections
  useGetEventSectionsQuery,
  useCreateEventSectionMutation,
  useUpdateEventSectionMutation,
  useDeleteEventSectionMutation,
  useReorderEventSectionsMutation,
  
  // Admin Registrations
  useGetEventRegistrationsQuery,
  useGetEventRegistrationStatsQuery,
  useGetEventRegistrationAdminQuery,
  
  // User Registrations
  useRegisterForEventMutation,
  useGetMyRegistrationQuery,
  useUpdateMyRegistrationMutation,
  useCancelMyRegistrationMutation,
  
  // QR Code
  useGenerateMyQRCodeQuery,
} = eventApi