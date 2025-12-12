// Helper utility functions
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Get the full API URL for image/file endpoints
 * In production, frontend (Vercel) and backend (Railway) are on different domains
 * So we need to prefix relative /api paths with the full backend URL
 */
export const getApiUrl = (path: string): string => {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  // If path already starts with http, return as is
  if (path.startsWith('http')) {
    return path;
  }
  // If path starts with /api, prefix with base URL
  if (path.startsWith('/api')) {
    return `${baseUrl}${path}`;
  }
  // Otherwise return as is
  return path;
}