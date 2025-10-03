// src/store/api/groupsApi.ts
import { apiSlice } from './apiSlice'

// Group types based on backend schema
export type GroupType = 'CELL' | 'COMMITTEE' | 'OFFICE_BEARERS' | 'ADVISORS'

export type GroupMemberRole = 
  | 'CONVENER' | 'CO_CONVENER' | 'STAKE_HOLDER'
  | 'PRESIDENT' | 'VICE_PRESIDENT' | 'SECRETARY' | 'JOINT_SECRETARY' 
  | 'TREASURER' | 'JOINT_TREASURER'
  | 'CHIEF_ADVISOR' | 'JOINT_ADVISOR'

export interface User {
  id: string
  firstName: string
  lastName: string
  fullName: string
  profileImage?: string
  batch: number
  batchYear: number
  email: string
}

export interface GroupMember {
  id: string
  role: GroupMemberRole
  isActive: boolean
  addedAt: string
  user: User
}

export interface Group {
  id: string
  name: string
  type: GroupType
  description?: string
  isActive: boolean
  displayOrder: number
  membersCount: number
  allowedRoles: GroupMemberRole[]
  members?: GroupMember[]
  createdAt: string
  updatedAt: string
}

export interface GroupStatistics {
  totalGroups: number
  activeGroups: number
  totalMembers: number
  groupsByType: {
    type: GroupType
    count: number
    activeCount: number
  }[]
}

export interface GetGroupsParams {
  type?: GroupType
  isActive?: boolean
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface GetGroupMembersParams {
  groupId: string
  isActive?: boolean
  role?: GroupMemberRole
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CreateGroupData {
  name: string
  type: GroupType
  description?: string
  displayOrder?: number
}

export interface UpdateGroupData {
  name?: string
  description?: string
  isActive?: boolean
  displayOrder?: number
}

export interface AddMemberData {
  userId: string
  role: GroupMemberRole
}

export interface UpdateMemberData {
  role: GroupMemberRole
  isActive?: boolean
}

export interface BulkMembersData {
  action: 'add' | 'remove' | 'update'
  members: {
    userId: string
    role?: GroupMemberRole
  }[]
}

export interface ReorderGroupsData {
  groups: {
    id: string
    displayOrder: number
  }[]
}

// Groups API slice
export const groupsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Public endpoints
    getPublicGroups: builder.query<Group[], void>({
      query: () => '/groups/public',
      transformResponse: (response: any) => response.data.groups,
      providesTags: ['Group'],
    }),

    // Protected endpoints (USER and ADMIN)
    getGroups: builder.query<{
      groups: Group[]
      pagination: {
        total: number
        pages: number
        page: number
        limit: number
      }
    }, GetGroupsParams>({
      query: (params) => ({
        url: '/groups',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Group'],
    }),

    getGroup: builder.query<Group, { 
      groupId: string 
      includeMembers?: boolean 
    }>({
      query: ({ groupId, includeMembers = true }) => ({
        url: `/groups/${groupId}`,
        params: { includeMembers },
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, { groupId }) => [
        { type: 'Group', id: groupId },
        'GroupMember',
      ],
    }),

    getGroupMembers: builder.query<{
      members: GroupMember[]
      pagination: {
        total: number
        pages: number
        page: number
        limit: number
      }
    }, GetGroupMembersParams>({
      query: ({ groupId, ...params }) => ({
        url: `/groups/${groupId}/members`,
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, { groupId }) => [
        { type: 'GroupMember', id: groupId },
      ],
    }),

    getGroupStatistics: builder.query<GroupStatistics, void>({
      query: () => '/groups/statistics',
      transformResponse: (response: any) => response.data.statistics,
      providesTags: ['GroupStats'],
    }),

    // SUPER_ADMIN only endpoints
    createGroup: builder.mutation<Group, CreateGroupData>({
      query: (data) => ({
        url: '/groups',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data.group,
      invalidatesTags: ['Group', 'GroupStats'],
    }),

    updateGroup: builder.mutation<Group, { 
      groupId: string 
      data: UpdateGroupData 
    }>({
      query: ({ groupId, data }) => ({
        url: `/groups/${groupId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data.group,
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'Group', id: groupId },
        'Group',
        'GroupStats',
      ],
    }),

    deleteGroup: builder.mutation<{ message: string }, string>({
      query: (groupId) => ({
        url: `/groups/${groupId}`,
        method: 'DELETE',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Group', 'GroupStats'],
    }),

    reorderGroups: builder.mutation<{ message: string }, ReorderGroupsData>({
      query: (data) => ({
        url: '/groups/reorder',
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['Group'],
    }),

    // Group member management (SUPER_ADMIN only)
    addGroupMember: builder.mutation<GroupMember, { 
      groupId: string 
      data: AddMemberData 
    }>({
      query: ({ groupId, data }) => ({
        url: `/groups/${groupId}/members`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data.member,
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'Group', id: groupId },
        { type: 'GroupMember', id: groupId },
        'Group', // Invalidate general group list
        'GroupStats',
      ],
    }),

    updateGroupMember: builder.mutation<GroupMember, { 
      groupId: string 
      userId: string 
      data: UpdateMemberData 
    }>({
      query: ({ groupId, userId, data }) => ({
        url: `/groups/${groupId}/members/${userId}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: any) => response.data.member,
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'Group', id: groupId },
        { type: 'GroupMember', id: groupId },
        'Group', // Invalidate general group list
        'GroupStats',
      ],
    }),

    removeGroupMember: builder.mutation<{ message: string }, { 
      groupId: string 
      userId: string 
    }>({
      query: ({ groupId, userId }) => ({
        url: `/groups/${groupId}/members/${userId}/remove`,
        method: 'PUT',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'Group', id: groupId },
        { type: 'GroupMember', id: groupId },
        'Group', // Invalidate general group list
        'GroupStats',
      ],
    }),

    bulkMemberOperations: builder.mutation<{ 
      message: string 
      results: any[] 
    }, { 
      groupId: string 
      data: BulkMembersData 
    }>({
      query: ({ groupId, data }) => ({
        url: `/groups/${groupId}/members/bulk`,
        method: 'POST',
        body: data,
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'Group', id: groupId },
        { type: 'GroupMember', id: groupId },
        'Group', // Invalidate general group list
        'GroupStats',
      ],
    }),
  }),
  overrideExisting: false,
})

// Export hooks
export const {
  // Public
  useGetPublicGroupsQuery,
  
  // Protected
  useGetGroupsQuery,
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useGetGroupStatisticsQuery,
  
  // Mutations (SUPER_ADMIN only)
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useReorderGroupsMutation,
  
  // Member management (SUPER_ADMIN only)
  useAddGroupMemberMutation,
  useUpdateGroupMemberMutation,
  useRemoveGroupMemberMutation,
  useBulkMemberOperationsMutation,
} = groupsApi