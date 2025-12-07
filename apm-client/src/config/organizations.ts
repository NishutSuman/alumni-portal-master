// src/config/organizations.ts
// Organization configuration for multi-tenant support
// Each organization has a unique code and corresponding API URL

export interface Organization {
  code: string
  name: string
  shortName: string
  apiUrl: string
  logo?: string // Static logo URL (optional)
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

// Local development organization - not shown in list, only accessible via code
const LOCAL_DEV_ORG: Organization = {
  code: 'LOCAL-DEV',
  name: 'Local Development',
  shortName: 'LOCAL',
  apiUrl: 'http://localhost:3000/api',
  description: 'Local development server - use for testing',
}

// Organization registry - Add new organizations here
// When deploying a new school, add their entry to this list
export const ORGANIZATIONS: Organization[] = [
  {
    code: 'GUILD-DEMO',
    name: 'GUILD ALUMNI PORTAL DEMO ',
    shortName: 'GUILD DEMO',
    apiUrl: 'https://guild-alumni-portal-demo.railway.app/api',
    description: 'An association of proud alumni of JNV Bagudi, Balasore',
  },
  {
    code: 'JNAAB',
    name: 'Jawahar Navodaya Alumni Association Belpada',
    shortName: 'JNAAB',
    apiUrl: 'https://jnaab-bolangir.railway.app/api',
    description: 'An association of proud alumni of JNV Bagudi, Balasore',
  },
  {
    code: 'ASJNVBB',
    name: 'ALUMNI SOCIETY OF JNV BAGUDI, BALASORE',
    shortName: 'ASJNVBB',
    apiUrl: 'https://asjnvbb-balasore.railway.app/api',
    description: 'An association of proud alumni of JNV Belpada, Bolangir',
  },
  // Add more organizations as needed
  // {
  //   code: 'SCHOOLXYZ',
  //   name: 'XYZ School Alumni',
  //   shortName: 'XYZ',
  //   apiUrl: 'https://xyz-alumni-api.railway.app/api',
  //   description: 'XYZ School Alumni Network',
  // },
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
  const storedUrl = getStoredApiUrl()
  if (storedUrl) {
    return storedUrl
  }
  // Fallback to environment variable or localhost for development
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
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
