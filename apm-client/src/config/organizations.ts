// src/config/organizations.ts
// Organization configuration for multi-tenant support
// Each organization has a unique code and corresponding API URL

import { getApiUrl } from '@/utils/helpers'

export interface Organization {
  code: string
  name: string
  shortName: string
  apiUrl: string
  logo?: string // Static logo URL (optional)
  logoUrl?: string // Logo URL from API
  logoProxyUrl?: string // Logo proxy URL for R2 files
  description?: string
}

// Helper to get organization logo URL
// Logo URL is stored in the organization's database and returned via /api/organization endpoint
// This function constructs the API URL to fetch org details (which includes logoUrl)
export const getOrgLogoUrl = (org: Organization): string | null => {
  // If static logo is provided in config, use it
  if (org.logo) {
    return org.logo
  }
  // If logoProxyUrl is available (for R2 files), use the full proxy URL
  if (org.logoProxyUrl) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
    // Remove /api from baseUrl if present to construct correct proxy URL
    const serverUrl = baseUrl.replace(/\/api$/, '')
    return `${serverUrl}${org.logoProxyUrl}`
  }
  // If logoUrl is available from API response, use it
  if (org.logoUrl) {
    return org.logoUrl
  }
  // Return null - logo will be fetched dynamically from org API
  return null
}

// Fetch organization details (including logo) from their API
export const fetchOrgDetails = async (org: Organization): Promise<{
  logoUrl?: string
  name?: string
  shortName?: string
} | null> => {
  try {
    const response = await fetch(`${org.apiUrl}/organization`)
    if (!response.ok) return null
    const data = await response.json()
    return data?.data?.organization || null
  } catch {
    return null
  }
}

// Fetch all organizations from the public API endpoint
export const fetchAllOrganizations = async (): Promise<Organization[]> => {
  try {
    // Use getApiUrl to construct the full backend URL in production
    const response = await fetch(getApiUrl('/api/public/organizations'))
    if (!response.ok) {
      console.error('Failed to fetch organizations:', response.statusText)
      return []
    }
    const data = await response.json()
    return data?.data?.organizations || []
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return []
  }
}

// Fetch organizations that a specific email is associated with
// CRITICAL: Used when switching organizations to only show orgs the user belongs to
export const fetchOrganizationsByEmail = async (email: string): Promise<Organization[]> => {
  try {
    const response = await fetch(getApiUrl('/api/auth/organizations-by-email'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })
    if (!response.ok) {
      console.error('Failed to fetch organizations by email:', response.statusText)
      return []
    }
    const data = await response.json()
    // Transform the response to match Organization interface
    const orgs = data?.data?.organizations || []
    return orgs.map((org: { id: string; name: string; tenantCode: string; logoUrl?: string; logoProxyUrl?: string }) => ({
      code: org.tenantCode,
      name: org.name,
      shortName: org.tenantCode,
      apiUrl: getApiUrl('/api').replace('/api', ''), // Base URL without /api suffix
      logoUrl: org.logoUrl,
      logoProxyUrl: org.logoProxyUrl,
    }))
  } catch (error) {
    console.error('Error fetching organizations by email:', error)
    return []
  }
}

// Local development organization - not shown in list, only accessible via code
const LOCAL_DEV_ORG: Organization = {
  code: 'LOCAL-DEV',
  name: 'Local Development',
  shortName: 'LOCAL',
  apiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  description: 'Local development server - use for testing',
}

// Static organization registry (fallback if API is unavailable)
// For local development, use code 'LOCAL-DEV' to connect to localhost:3000
export const ORGANIZATIONS: Organization[] = [
  // Static organizations can be added here as fallback
  // Dynamic organizations are fetched from /api/public/organizations
]

// localStorage keys for organization data
export const ORG_STORAGE_KEYS = {
  ORG_CODE: 'guild-org-code',
  API_URL: 'guild-api-url',
  ORG_NAME: 'guild-org-name',
} as const

// Get organization by code
export const getOrganizationByCode = (code: string): Organization | undefined => {
  // Check for local dev code (hidden from list, accessible via manual code entry only)
  if (code.toUpperCase() === 'LOCAL-DEV') {
    return LOCAL_DEV_ORG
  }
  return ORGANIZATIONS.find(
    (org) => org.code.toLowerCase() === code.toLowerCase()
  )
}

// Get stored organization code from localStorage
export const getStoredOrgCode = (): string | null => {
  return localStorage.getItem(ORG_STORAGE_KEYS.ORG_CODE)
}

// Get stored API URL from localStorage
export const getStoredApiUrl = (): string | null => {
  return localStorage.getItem(ORG_STORAGE_KEYS.API_URL)
}

// Get stored organization name from localStorage
export const getStoredOrgName = (): string | null => {
  return localStorage.getItem(ORG_STORAGE_KEYS.ORG_NAME)
}

// Store organization selection in localStorage
export const storeOrganization = (org: Organization): void => {
  localStorage.setItem(ORG_STORAGE_KEYS.ORG_CODE, org.code)
  localStorage.setItem(ORG_STORAGE_KEYS.API_URL, org.apiUrl)
  localStorage.setItem(ORG_STORAGE_KEYS.ORG_NAME, org.name)
}

// Clear organization selection from localStorage
export const clearOrganization = (): void => {
  localStorage.removeItem(ORG_STORAGE_KEYS.ORG_CODE)
  localStorage.removeItem(ORG_STORAGE_KEYS.API_URL)
  localStorage.removeItem(ORG_STORAGE_KEYS.ORG_NAME)
}

// Check if organization is selected
export const hasOrganizationSelected = (): boolean => {
  const orgCode = getStoredOrgCode()
  const apiUrl = getStoredApiUrl()
  return !!(orgCode && apiUrl)
}

// Get the API base URL (dynamic based on selected org or fallback to env)
export const getApiBaseUrl = (): string => {
  // Priority 1: Environment variable (most reliable for production)
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
  if (envUrl) {
    // Ensure it ends with /api
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
  }

  // Priority 2: Stored organization URL (but protect against localhost in production)
  const storedUrl = getStoredApiUrl()
  if (storedUrl) {
    // In production (non-localhost window location), reject localhost stored URLs
    const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
    if (isProduction && storedUrl.includes('localhost')) {
      console.warn('Ignoring localhost API URL in production environment')
      // Clear the invalid localStorage entry
      localStorage.removeItem(ORG_STORAGE_KEYS.API_URL)
    } else {
      return storedUrl
    }
  }

  // Fallback: localhost for development
  return 'http://localhost:3000/api'
}

// Validate organization code (check if it exists in registry or allow custom)
export const validateOrgCode = (code: string): { valid: boolean; org?: Organization; message?: string } => {
  if (!code || code.trim().length === 0) {
    return { valid: false, message: 'Organization code is required' }
  }

  const org = getOrganizationByCode(code.trim())

  if (org) {
    return { valid: true, org }
  }

  // For now, only allow organizations in the registry
  // You can change this to allow custom org codes if needed
  return {
    valid: false,
    message: 'Invalid organization code. Please check and try again.'
  }
}
