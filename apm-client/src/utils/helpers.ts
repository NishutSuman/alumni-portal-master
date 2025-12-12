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
 *
 * Priority:
 * 1. VITE_API_URL env var (most reliable for production)
 * 2. Stored org URL from localStorage (if not localhost)
 * 3. VITE_API_BASE_URL env var (fallback)
 * 4. Empty string (for local development where proxy handles /api)
 */
export const getApiUrl = (path: string): string => {
  // If path already starts with http, return as is
  if (path.startsWith('http')) {
    return path;
  }

  // Get base URL - prioritize env var over localStorage
  // This prevents localStorage containing localhost:3000 from breaking production
  let baseUrl = import.meta.env.VITE_API_URL || '';

  // If no VITE_API_URL, check stored org URL (but reject localhost in production)
  if (!baseUrl) {
    const storedUrl = localStorage.getItem('guild-api-url');
    if (storedUrl && !storedUrl.includes('localhost')) {
      // Remove trailing /api if present to avoid double /api
      baseUrl = storedUrl.replace(/\/api$/, '');
    }
  }

  // Fallback to VITE_API_BASE_URL (also remove /api suffix if present)
  if (!baseUrl) {
    const fallback = import.meta.env.VITE_API_BASE_URL || '';
    baseUrl = fallback.replace(/\/api$/, '');
  }

  // If path starts with /api, prefix with base URL
  if (path.startsWith('/api')) {
    return `${baseUrl}${path}`;
  }

  // Otherwise return as is
  return path;
}