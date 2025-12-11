// src/store/api/developerApi.ts
// Developer Portal API - For managing multi-tenant organizations

import { apiSlice } from './apiSlice'

// Types
export interface Organization {
  id: string
  name: string
  shortName: string
  tenantCode: string
  isActive: boolean
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
  subscriptionStartAt: string | null
  subscriptionEndsAt: string | null
  isMaintenanceMode: boolean
  maintenanceMessage: string | null
  maxUsers: number
  storageQuotaMB: number
  logoUrl: string | null
  logoProxyUrl: string | null // Proxy URL for R2 logos
  officialEmail: string
  officialContactNumber: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    users: number
    events: number
    posts: number
  }
}

export interface OrganizationDetails extends Organization {
  officeAddress: string | null
  foundationYear: number | null
  description: string | null
  mission: string | null
  vision: string | null
  _count: {
    users: number
    events: number
    posts: number
    albums: number
    photos: number
    transactions: number
    notifications: number
    groups: number
    sponsors: number
    polls: number
    tickets: number
  }
}

export interface DeveloperDashboard {
  organizations: {
    total: number
    active: number
    inMaintenance: number
  }
  subscriptions: Record<string, number>
  recentOrganizations: Organization[]
  systemTotals: {
    users: number
    posts: number
    events: number
  }
}

export interface OrganizationStats {
  users: {
    byRole: { role: string; _count: number }[]
    total: number
  }
  content: {
    posts: number
    events: number
    albums: number
    photos: number
    polls: number
  }
  recentActivity: {
    action: string
    details: Record<string, unknown>
    createdAt: string
    user: {
      fullName: string
      role: string
    }
  }[]
}

export interface CreateOrganizationRequest {
  name: string
  shortName: string
  tenantCode: string
  officialEmail: string
  officialContactNumber?: string
  officeAddress?: string
  foundationYear?: number
  description?: string
  mission?: string
  vision?: string
  subscriptionStatus?: 'TRIAL' | 'ACTIVE'
  subscriptionDays?: number
  maxUsers?: number
  storageQuotaMB?: number
}

export interface UpdateSubscriptionRequest {
  subscriptionStatus?: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
  subscriptionDays?: number
  maxUsers?: number
  storageQuotaMB?: number
}

// Email Configuration Types
export type EmailProvider = 'SMTP' | 'GMAIL' | 'SENDGRID' | 'RESEND' | 'MAILGUN' | 'SES' | 'MAILERSEND'

export interface EmailConfig {
  id: string
  organizationId: string
  provider: EmailProvider
  smtpHost: string | null
  smtpPort: number | null
  smtpSecure: boolean
  smtpUser: string | null
  smtpPassword: string | null // Will be masked '********' from API
  sendgridApiKey: string | null
  resendApiKey: string | null
  mailgunApiKey: string | null
  mailgunDomain: string | null
  mailersendApiKey: string | null
  fromEmail: string
  fromName: string
  replyTo: string | null
  primaryColor: string | null
  logoUrl: string | null
  dailyEmailLimit: number
  monthlyEmailLimit: number
  dailyEmailsSent: number
  monthlyEmailsSent: number
  isActive: boolean
  isVerified: boolean
  lastTestedAt: string | null
  verificationToken: string | null
  organization?: {
    name: string
    tenantCode: string
  }
}

export interface DnsRecord {
  type: string
  name: string
  value: string
}

export interface DnsRecords {
  verification: DnsRecord
  spf: DnsRecord
  dkim: DnsRecord
}

export interface EmailConfigResponse {
  config: EmailConfig | null
  dnsRecords?: DnsRecords | null
  message?: string
}

export interface SaveEmailConfigRequest {
  provider: EmailProvider
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPassword?: string
  sendgridApiKey?: string
  resendApiKey?: string
  mailgunApiKey?: string
  mailgunDomain?: string
  mailersendApiKey?: string
  fromEmail: string
  fromName: string
  replyTo?: string
  primaryColor?: string
  logoUrl?: string
  dailyEmailLimit?: number
  monthlyEmailLimit?: number
}

export interface EmailStats {
  dailyEmailsSent: number
  monthlyEmailsSent: number
  dailyEmailLimit: number
  monthlyEmailLimit: number
  lastDailyReset: string | null
  lastMonthlyReset: string | null
  lastTestedAt: string | null
  lastTestResult: string | null
  isActive: boolean
  isVerified: boolean
  provider: EmailProvider
  dailyUsagePercent: number
  monthlyUsagePercent: number
}

// Developer API endpoints
export const developerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Dashboard
    getDeveloperDashboard: builder.query<DeveloperDashboard, void>({
      query: () => '/developer/dashboard',
      transformResponse: (response: { data: { dashboard: DeveloperDashboard } }) =>
        response.data.dashboard,
      providesTags: ['Organization'],
    }),

    // Switch tenant context
    switchTenantContext: builder.mutation<
      { organization: Organization },
      { tenantCode: string }
    >({
      query: (body) => ({
        url: '/developer/switch-tenant',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: { organization: Organization } }) =>
        response.data,
    }),

    // Organization CRUD - Named uniquely to avoid collision with authApi.getAllOrganizations
    getDeveloperOrganizations: builder.query<
      { data: Organization[]; pagination: { total: number; pages: number } },
      { search?: string; status?: string; page?: number; limit?: number }
    >({
      query: (params) => ({
        url: '/developer/organizations',
        params,
      }),
      // Server returns: { success: true, data: Organization[], pagination: {...} }
      transformResponse: (response: any) => {
        // Handle the response - data should be array directly from paginatedResponse
        const data = Array.isArray(response.data) ? response.data : []
        const pagination = response.pagination || { total: 0, pages: 1 }
        return { data, pagination }
      },
      providesTags: ['Organization'],
    }),

    getOrganizationById: builder.query<OrganizationDetails, string>({
      query: (orgId) => `/developer/organizations/${orgId}`,
      transformResponse: (response: { data: { organization: OrganizationDetails } }) =>
        response.data.organization,
      providesTags: (_result, _error, orgId) => [{ type: 'Organization', id: orgId }],
    }),

    createOrganization: builder.mutation<Organization, CreateOrganizationRequest>({
      query: (body) => ({
        url: '/developer/organizations',
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: { organization: Organization } }) =>
        response.data.organization,
      invalidatesTags: ['Organization'],
    }),

    updateOrganization: builder.mutation<
      Organization,
      { orgId: string; data: Partial<Organization> }
    >({
      query: ({ orgId, data }) => ({
        url: `/developer/organizations/${orgId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: { data: { organization: Organization } }) =>
        response.data.organization,
      invalidatesTags: (_result, _error, { orgId }) => [
        { type: 'Organization', id: orgId },
        'Organization',
      ],
    }),

    // Maintenance mode
    toggleMaintenanceMode: builder.mutation<
      Organization,
      { orgId: string; isMaintenanceMode: boolean; maintenanceMessage?: string }
    >({
      query: ({ orgId, ...body }) => ({
        url: `/developer/organizations/${orgId}/maintenance`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: { organization: Organization } }) =>
        response.data.organization,
      invalidatesTags: (_result, _error, { orgId }) => [
        { type: 'Organization', id: orgId },
        'Organization',
      ],
    }),

    // Subscription - Legacy direct update (for quick extend/status change)
    updateSubscription: builder.mutation<
      Organization,
      { orgId: string } & UpdateSubscriptionRequest
    >({
      query: ({ orgId, ...body }) => ({
        url: `/developer/organizations/${orgId}/subscription-legacy`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: { data: { organization: Organization } }) =>
        response.data.organization,
      invalidatesTags: (_result, _error, { orgId }) => [
        { type: 'Organization', id: orgId },
        'Organization',
      ],
    }),

    // Statistics
    getOrganizationStats: builder.query<OrganizationStats, string>({
      query: (orgId) => `/developer/organizations/${orgId}/stats`,
      transformResponse: (response: { data: { stats: OrganizationStats } }) =>
        response.data.stats,
    }),

    // Email Configuration
    getOrganizationEmailConfig: builder.query<EmailConfigResponse, string>({
      query: (orgId) => `/developer/organizations/${orgId}/email-config`,
      transformResponse: (response: { data: EmailConfigResponse }) => response.data,
      providesTags: (_result, _error, orgId) => [{ type: 'EmailConfig' as const, id: orgId }],
    }),

    saveOrganizationEmailConfig: builder.mutation<
      EmailConfigResponse,
      { orgId: string; data: SaveEmailConfigRequest }
    >({
      query: ({ orgId, data }) => ({
        url: `/developer/organizations/${orgId}/email-config`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: { data: EmailConfigResponse }) => response.data,
      invalidatesTags: (_result, _error, { orgId }) => [{ type: 'EmailConfig' as const, id: orgId }],
    }),

    testOrganizationEmailConfig: builder.mutation<
      { success: boolean; message?: string; error?: string; testEmailSent?: boolean },
      { orgId: string; testEmail?: string }
    >({
      query: ({ orgId, testEmail }) => ({
        url: `/developer/organizations/${orgId}/email-config/test`,
        method: 'POST',
        body: { testEmail },
      }),
      transformResponse: (response: { data: { success: boolean; message?: string; testEmailSent?: boolean } }) => response.data,
    }),

    activateOrganizationEmailConfig: builder.mutation<{ success: boolean; message: string }, string>({
      query: (orgId) => ({
        url: `/developer/organizations/${orgId}/email-config/activate`,
        method: 'POST',
      }),
      transformResponse: (response: { data: { success: boolean; message: string } }) => response.data,
      invalidatesTags: (_result, _error, orgId) => [{ type: 'EmailConfig' as const, id: orgId }],
    }),

    deactivateOrganizationEmailConfig: builder.mutation<{ message: string }, string>({
      query: (orgId) => ({
        url: `/developer/organizations/${orgId}/email-config/deactivate`,
        method: 'POST',
      }),
      transformResponse: (response: { data: { message: string } }) => response.data,
      invalidatesTags: (_result, _error, orgId) => [{ type: 'EmailConfig' as const, id: orgId }],
    }),

    deleteOrganizationEmailConfig: builder.mutation<{ message: string }, string>({
      query: (orgId) => ({
        url: `/developer/organizations/${orgId}/email-config`,
        method: 'DELETE',
      }),
      transformResponse: (response: { data: { message: string } }) => response.data,
      invalidatesTags: (_result, _error, orgId) => [{ type: 'EmailConfig' as const, id: orgId }],
    }),

    getOrganizationEmailStats: builder.query<{ stats: EmailStats | null; message?: string }, string>({
      query: (orgId) => `/developer/organizations/${orgId}/email-config/stats`,
      transformResponse: (response: { data: { stats: EmailStats | null; message?: string } }) => response.data,
    }),
  }),
  overrideExisting: false,
})

// Export hooks
export const {
  useGetDeveloperDashboardQuery,
  useSwitchTenantContextMutation,
  useGetDeveloperOrganizationsQuery,
  useGetOrganizationByIdQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useToggleMaintenanceModeMutation,
  useUpdateSubscriptionMutation,
  useGetOrganizationStatsQuery,
  // Email Configuration hooks
  useGetOrganizationEmailConfigQuery,
  useSaveOrganizationEmailConfigMutation,
  useTestOrganizationEmailConfigMutation,
  useActivateOrganizationEmailConfigMutation,
  useDeactivateOrganizationEmailConfigMutation,
  useDeleteOrganizationEmailConfigMutation,
  useGetOrganizationEmailStatsQuery,
} = developerApi
