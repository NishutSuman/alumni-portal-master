// src/store/api/pollApi.ts
import { apiSlice } from './apiSlice';

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
}

export interface Poll {
  id: string;
  title: string;
  description?: string;
  options: PollOption[];
  allowMultiple: boolean;
  isAnonymous: boolean;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  creator: {
    id: string;
    fullName: string;
    batch: string;
  };
  totalVotes: number;
  hasVoted: boolean;
  userVote?: string[];
}

export interface CreatePollData {
  title: string;
  description?: string;
  options: string[];
  allowMultiple?: boolean;
  isAnonymous?: boolean;
  expiresAt?: string;
}

export interface UpdatePollData {
  title?: string;
  description?: string;
  isActive?: boolean;
  allowMultiple?: boolean;
  isAnonymous?: boolean;
  expiresAt?: string;
}

export interface VotePollData {
  optionIds: string[];
}

export interface PollFilters {
  isActive?: boolean;
  createdBy?: string;
  hasExpired?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'expiresAt' | 'voteCount';
  sortOrder?: 'asc' | 'desc';
}

export interface PollStatistics {
  totalPolls: number;
  activePolls: number;
  expiredPolls: number;
  totalVotes: number;
  averageVotesPerPoll: number;
  mostVotedPoll: {
    id: string;
    title: string;
    voteCount: number;
  };
}

export interface UserVote {
  id: string;
  poll: {
    id: string;
    title: string;
    isActive: boolean;
  };
  options: {
    id: string;
    text: string;
  }[];
  createdAt: string;
}

const pollApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // Get polls with filters
    getPolls: builder.query<
      { polls: Poll[]; pagination: any; filters: PollFilters },
      PollFilters
    >({
      query: (filters) => ({
        url: '/polls',
        params: filters,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['Poll'],
    }),

    // Get active polls
    getActivePolls: builder.query<
      { activePolls: Poll[]; count: number; lastUpdated: string },
      void
    >({
      query: () => '/polls/active',
      transformResponse: (response: any) => response.data,
      providesTags: ['Poll'],
    }),

    // Get single poll
    getPoll: builder.query<Poll, string>({
      query: (pollId) => `/polls/${pollId}`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, pollId) => [{ type: 'Poll', id: pollId }],
    }),

    // Get poll results
    getPollResults: builder.query<Poll, string>({
      query: (pollId) => `/polls/${pollId}/results`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, pollId) => [{ type: 'Poll', id: pollId }],
    }),

    // Get poll statistics
    getPollStats: builder.query<{
      poll: Poll;
      totalVotes: number;
      totalVoters: number;
      options: Array<{
        id: string;
        text: string;
        voteCount: number;
        percentage: number;
        voters: Array<{
          id: string;
          fullName: string;
          batch: string;
          profileImage?: string;
          votedAt: string;
        }>;
      }>;
      voters: Array<{
        id: string;
        fullName: string;
        batch: string;
        profileImage?: string;
        votedAt: string;
        options: Array<{
          id: string;
          text: string;
        }>;
      }>;
    }, string>({
      query: (pollId) => `/polls/${pollId}/stats`,
      transformResponse: (response: any) => response.data,
      providesTags: (result, error, pollId) => [{ type: 'Poll', id: pollId }],
    }),

    // Get user's vote history
    getUserVotes: builder.query<
      { votes: UserVote[]; pagination: any },
      { page?: number; limit?: number; sortBy?: string; sortOrder?: string }
    >({
      query: (params) => ({
        url: '/polls/my/votes',
        params,
      }),
      transformResponse: (response: any) => response.data,
      providesTags: ['UserVotes'],
    }),

    // Vote in poll
    votePoll: builder.mutation<
      { success: boolean; message: string; poll: Poll },
      { pollId: string; data: VotePollData }
    >({
      query: ({ pollId, data }) => ({
        url: `/polls/${pollId}/vote`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { pollId }) => [
        'Poll',
        { type: 'Poll', id: pollId },
        'UserVotes',
      ],
    }),

    // Create poll (admin only)
    createPoll: builder.mutation<
      { success: boolean; message: string; poll: Poll },
      CreatePollData
    >({
      query: (data) => ({
        url: '/polls',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Poll', 'PollStats'],
    }),

    // Update poll (admin/creator only)
    updatePoll: builder.mutation<
      { success: boolean; message: string; poll: Poll },
      { pollId: string; data: UpdatePollData }
    >({
      query: ({ pollId, data }) => ({
        url: `/polls/${pollId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { pollId }) => [
        'Poll',
        { type: 'Poll', id: pollId },
        'PollStats',
      ],
    }),

    // Delete poll (admin/creator only)
    deletePoll: builder.mutation<
      { success: boolean; message: string },
      string
    >({
      query: (pollId) => ({
        url: `/polls/${pollId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Poll', 'PollStats'],
    }),

    // Force delete poll (super admin only)
    forceDeletePoll: builder.mutation<
      { success: boolean; message: string },
      string
    >({
      query: (pollId) => ({
        url: `/polls/${pollId}/force`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Poll', 'PollStats'],
    }),

    // Get poll statistics (admin only)
    getPollStatistics: builder.query<PollStatistics, void>({
      query: () => '/polls/admin/statistics',
      transformResponse: (response: any) => response.data,
      providesTags: ['PollStats'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPollsQuery,
  useGetActivePollsQuery,
  useGetPollQuery,
  useGetPollResultsQuery,
  useGetPollStatsQuery,
  useGetUserVotesQuery,
  useVotePollMutation,
  useCreatePollMutation,
  useUpdatePollMutation,
  useDeletePollMutation,
  useForceDeletePollMutation,
  useGetPollStatisticsQuery,
} = pollApi;