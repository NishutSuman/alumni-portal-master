import { apiSlice } from './apiSlice';
import type {
  Album,
  Photo,
  AlbumStats,
  PhotoStats,
  UserPhotoStats,
  GetAlbumsParams,
  GetAlbumsResponse,
  GetAlbumResponse,
  CreateAlbumData,
  UpdateAlbumData,
  GetPhotosParams,
  GetPhotosResponse,
  UploadPhotoData,
  BulkUploadPhotosData,
  UpdatePhotoData,
  BulkDeletePhotosData,
  MovePhotosData,
  SearchPhotosParams,
  SetCoverData,
} from '../../types/gallery';

export const galleryApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ==================== ALBUM ENDPOINTS ====================

    // Get all albums
    getAlbums: builder.query<GetAlbumsResponse, GetAlbumsParams | void>({
      query: (params) => ({
        url: '/albums',
        params: params || {},
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.albums.map(({ id }) => ({ type: 'Album' as const, id })),
              { type: 'Album', id: 'LIST' },
            ]
          : [{ type: 'Album', id: 'LIST' }],
    }),

    // Get single album with photos
    getAlbum: builder.query<GetAlbumResponse, { albumId: string; includePhotos?: boolean; photoPage?: number; photoLimit?: number }>({
      query: ({ albumId, includePhotos = true, photoPage = 1, photoLimit = 20 }) => ({
        url: `/albums/${albumId}`,
        params: { includePhotos, photoPage, photoLimit },
      }),
      providesTags: (result, error, { albumId }) => [
        { type: 'Album', id: albumId },
        { type: 'Photo', id: `ALBUM_${albumId}` },
      ],
    }),

    // Create album
    createAlbum: builder.mutation<{ success: boolean; data: Album; message: string }, CreateAlbumData>({
      query: (data) => {
        const formData = new FormData();
        formData.append('name', data.name);
        if (data.description) formData.append('description', data.description);
        if (data.coverImage) formData.append('coverImage', data.coverImage);

        return {
          url: '/albums',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: [{ type: 'Album', id: 'LIST' }, { type: 'AlbumStats' }],
    }),

    // Update album
    updateAlbum: builder.mutation<{ success: boolean; data: Album; message: string }, { albumId: string; data: UpdateAlbumData }>({
      query: ({ albumId, data }) => {
        const formData = new FormData();
        if (data.name) formData.append('name', data.name);
        if (data.description !== undefined) formData.append('description', data.description || '');
        if (data.isArchived !== undefined) formData.append('isArchived', String(data.isArchived));
        if (data.coverImage) formData.append('coverImage', data.coverImage);

        return {
          url: `/albums/${albumId}`,
          method: 'PUT',
          body: formData,
        };
      },
      invalidatesTags: (result, error, { albumId }) => [
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
        { type: 'AlbumStats' },
      ],
    }),

    // Delete album
    deleteAlbum: builder.mutation<{ success: boolean; message: string }, string>({
      query: (albumId) => ({
        url: `/albums/${albumId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, albumId) => [
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
        { type: 'Photo', id: 'LIST' },
        { type: 'AlbumStats' },
        { type: 'PhotoStats' },
      ],
    }),

    // Archive/Unarchive album
    toggleArchiveAlbum: builder.mutation<{ success: boolean; data: Album; message: string }, string>({
      query: (albumId) => ({
        url: `/albums/${albumId}/archive`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, albumId) => [
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
      ],
    }),

    // Set album cover
    setAlbumCover: builder.mutation<{ success: boolean; data: Album; message: string }, { albumId: string; data: SetCoverData }>({
      query: ({ albumId, data }) => ({
        url: `/albums/${albumId}/cover`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { albumId }) => [
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
      ],
    }),

    // Get album stats
    getAlbumStats: builder.query<{ success: boolean; data: AlbumStats; message: string }, string>({
      query: (albumId) => `/albums/${albumId}/stats`,
      providesTags: (result, error, albumId) => [{ type: 'AlbumStats', id: albumId }],
    }),

    // ==================== PHOTO ENDPOINTS (ALBUM-BASED) ====================

    // Get photos in album
    getAlbumPhotos: builder.query<GetPhotosResponse, { albumId: string; page?: number; limit?: number }>({
      query: ({ albumId, page = 1, limit = 20 }) => ({
        url: `/albums/${albumId}/photos`,
        params: { page, limit },
      }),
      providesTags: (result, error, { albumId }) => [
        { type: 'Photo', id: `ALBUM_${albumId}` },
        ...(result?.data.photos.map(({ id }) => ({ type: 'Photo' as const, id })) || []),
      ],
    }),

    // Upload single photo to album
    uploadPhotoToAlbum: builder.mutation<{ success: boolean; data: Photo; message: string }, { albumId: string; data: UploadPhotoData }>({
      query: ({ albumId, data }) => {
        const formData = new FormData();
        formData.append('photo', data.photo);
        if (data.caption) formData.append('caption', data.caption);
        if (data.tags && data.tags.length > 0) {
          formData.append('tags', JSON.stringify(data.tags));
        }

        return {
          url: `/albums/${albumId}/photos`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: (result, error, { albumId }) => [
        { type: 'Photo', id: `ALBUM_${albumId}` },
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
        { type: 'Photo', id: 'LIST' },
        { type: 'AlbumStats', id: albumId },
        { type: 'PhotoStats' },
      ],
    }),

    // Bulk upload photos to album
    bulkUploadPhotos: builder.mutation<{ success: boolean; data: { uploaded: Photo[]; failed: any[] }; message: string }, { albumId: string; data: BulkUploadPhotosData }>({
      query: ({ albumId, data }) => {
        const formData = new FormData();
        data.photos.forEach((photo) => {
          formData.append('photos', photo);
        });
        if (data.bulkCaption) formData.append('bulkCaption', data.bulkCaption);

        return {
          url: `/albums/${albumId}/photos/bulk`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: (result, error, { albumId }) => [
        { type: 'Photo', id: `ALBUM_${albumId}` },
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
        { type: 'Photo', id: 'LIST' },
        { type: 'AlbumStats', id: albumId },
        { type: 'PhotoStats' },
      ],
    }),

    // Get single photo
    getPhoto: builder.query<{ success: boolean; data: Photo; message: string }, { albumId: string; photoId: string }>({
      query: ({ albumId, photoId }) => `/albums/${albumId}/photos/${photoId}`,
      providesTags: (result, error, { photoId }) => [{ type: 'Photo', id: photoId }],
    }),

    // Update photo
    updatePhoto: builder.mutation<{ success: boolean; data: Photo; message: string }, { albumId: string; photoId: string; data: UpdatePhotoData }>({
      query: ({ albumId, photoId, data }) => ({
        url: `/albums/${albumId}/photos/${photoId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { albumId, photoId }) => [
        { type: 'Photo', id: photoId },
        { type: 'Photo', id: `ALBUM_${albumId}` },
      ],
    }),

    // Delete photo
    deletePhoto: builder.mutation<{ success: boolean; message: string }, { albumId: string; photoId: string }>({
      query: ({ albumId, photoId }) => ({
        url: `/albums/${albumId}/photos/${photoId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { albumId, photoId }) => [
        { type: 'Photo', id: photoId },
        { type: 'Photo', id: `ALBUM_${albumId}` },
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
        { type: 'AlbumStats', id: albumId },
        { type: 'PhotoStats' },
      ],
    }),

    // Bulk delete photos
    bulkDeletePhotos: builder.mutation<{ success: boolean; data: { deleted: number; failed: number }; message: string }, { albumId: string; data: BulkDeletePhotosData }>({
      query: ({ albumId, data }) => ({
        url: `/albums/${albumId}/photos/bulk-delete`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { albumId }) => [
        { type: 'Photo', id: `ALBUM_${albumId}` },
        { type: 'Album', id: albumId },
        { type: 'Album', id: 'LIST' },
        { type: 'Photo', id: 'LIST' },
        { type: 'AlbumStats', id: albumId },
        { type: 'PhotoStats' },
      ],
    }),

    // Move photos to different album
    movePhotos: builder.mutation<{ success: boolean; data: { moved: number; failed: number }; message: string }, { albumId: string; data: MovePhotosData }>({
      query: ({ albumId, data }) => ({
        url: `/albums/${albumId}/photos/move`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { albumId, data }) => [
        { type: 'Photo', id: `ALBUM_${albumId}` },
        { type: 'Photo', id: `ALBUM_${data.targetAlbumId}` },
        { type: 'Album', id: albumId },
        { type: 'Album', id: data.targetAlbumId },
        { type: 'AlbumStats', id: albumId },
        { type: 'AlbumStats', id: data.targetAlbumId },
      ],
    }),

    // ==================== GLOBAL PHOTO ENDPOINTS ====================

    // Get all photos
    getPhotos: builder.query<GetPhotosResponse, GetPhotosParams | void>({
      query: (params) => ({
        url: '/photos',
        params: params || {},
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.photos.map(({ id }) => ({ type: 'Photo' as const, id })),
              { type: 'Photo', id: 'LIST' },
            ]
          : [{ type: 'Photo', id: 'LIST' }],
    }),

    // Search photos
    searchPhotos: builder.query<GetPhotosResponse, SearchPhotosParams>({
      query: (params) => ({
        url: '/photos/search',
        params,
      }),
      providesTags: [{ type: 'Photo', id: 'SEARCH' }],
    }),

    // Get recent photos
    getRecentPhotos: builder.query<{ success: boolean; data: Photo[]; message: string }, number | void>({
      query: (limit = 20) => ({
        url: '/photos/recent',
        params: { limit },
      }),
      providesTags: [{ type: 'Photo', id: 'RECENT' }],
    }),

    // ==================== STATS ENDPOINTS ====================

    // Get overall photo stats
    getPhotoStats: builder.query<{ success: boolean; data: PhotoStats; message: string }, void>({
      query: () => '/photos/stats',
      providesTags: [{ type: 'PhotoStats' }],
    }),

    // Get user photo stats
    getUserPhotoStats: builder.query<{ success: boolean; data: UserPhotoStats; message: string }, string>({
      query: (userId) => `/photos/stats/user/${userId}`,
      providesTags: (result, error, userId) => [{ type: 'PhotoStats', id: userId }],
    }),
  }),
});

export const {
  // Album hooks
  useGetAlbumsQuery,
  useGetAlbumQuery,
  useCreateAlbumMutation,
  useUpdateAlbumMutation,
  useDeleteAlbumMutation,
  useToggleArchiveAlbumMutation,
  useSetAlbumCoverMutation,
  useGetAlbumStatsQuery,
  // Album photo hooks
  useGetAlbumPhotosQuery,
  useUploadPhotoToAlbumMutation,
  useBulkUploadPhotosMutation,
  useGetPhotoQuery,
  useUpdatePhotoMutation,
  useDeletePhotoMutation,
  useBulkDeletePhotosMutation,
  useMovePhotosMutation,
  // Global photo hooks
  useGetPhotosQuery,
  useSearchPhotosQuery,
  useGetRecentPhotosQuery,
  // Stats hooks
  useGetPhotoStatsQuery,
  useGetUserPhotoStatsQuery,
} = galleryApi;
