export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error?: string
  timestamp?: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

export interface PaginationResponse<T = any> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface FilterOptions {
  [key: string]: any
}

export interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
  icon?: string
}

export interface FileUpload {
  file: File
  preview?: string
  progress?: number
  status?: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

export interface Address {
  id?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  addressType: 'CURRENT' | 'PERMANENT' | 'WORK'
}

export interface ContactInfo {
  email?: string
  phone?: string
  whatsapp?: string
  website?: string
  linkedin?: string
  twitter?: string
  facebook?: string
  instagram?: string
}

// ADDED: Payment status type (was missing)
export type PaymentStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'