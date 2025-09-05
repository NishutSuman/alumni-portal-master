// src/hooks/useApi.ts
// Generic API Hook for Loading States

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface ApiState<T = any> {
  data: T | null
  loading: boolean
  error: string | null
}

export const useApi = <T = any>() => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = async (
    apiCall: () => Promise<T>,
    options?: {
      showSuccessToast?: boolean
      successMessage?: string
      showErrorToast?: boolean
      onSuccess?: (data: T) => void
      onError?: (error: string) => void
    }
  ) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      const data = await apiCall()
      
      setState({ data, loading: false, error: null })
      
      if (options?.showSuccessToast && options?.successMessage) {
        toast.success(options.successMessage)
      }
      
      options?.onSuccess?.(data)
      
      return { success: true, data }
    } catch (error: any) {
      const errorMessage = error?.data?.message || error?.message || 'An error occurred'
      
      setState(prev => ({ ...prev, loading: false, error: errorMessage }))
      
      if (options?.showErrorToast !== false) {
        toast.error(errorMessage)
      }
      
      options?.onError?.(errorMessage)
      
      return { success: false, error: errorMessage }
    }
  }

  const reset = () => {
    setState({ data: null, loading: false, error: null })
  }

  return {
    ...state,
    execute,
    reset,
  }
}