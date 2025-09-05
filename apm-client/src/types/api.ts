// src/types/api.ts
// API related types

export interface QueryOptions {
  enabled?: boolean
  refetchOnWindowFocus?: boolean
  refetchInterval?: number
  staleTime?: number
  cacheTime?: number
}

export interface MutationOptions<TData = any, TError = any, TVariables = any> {
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: TError, variables: TVariables) => void
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void
}

export interface ApiError {
  status: number
  message: string
  code?: string
  details?: Record<string, any>
  timestamp?: string
}