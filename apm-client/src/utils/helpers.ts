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
 * 2. VITE_API_BASE_URL env var (fallback)
 * 3. Stored org URL from localStorage (if not localhost in production)
 * 4. Infer from current window location for production domains
 */
export const getApiUrl = (path: string): string => {
  // If path already starts with http, return as is
  if (path.startsWith('http')) {
    return path;
  }

  // Get base URL - prioritize env var over localStorage
  // This prevents localStorage containing localhost:3000 from breaking production
  let baseUrl = import.meta.env.VITE_API_URL || '';

  // Fallback to VITE_API_BASE_URL (also remove /api suffix if present)
  if (!baseUrl) {
    const fallback = import.meta.env.VITE_API_BASE_URL || '';
    baseUrl = fallback.replace(/\/api$/, '');
  }

  // If still no baseUrl, check stored org URL (but reject localhost in production)
  if (!baseUrl) {
    const storedUrl = localStorage.getItem('guild-api-url');
    if (storedUrl) {
      const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
      if (!isProduction || !storedUrl.includes('localhost')) {
        // Remove trailing /api if present to avoid double /api
        baseUrl = storedUrl.replace(/\/api$/, '');
      }
    }
  }

  // Final fallback for production: infer backend URL from known deployment pattern
  // If we're on Vercel (guild-client.vercel.app or similar), use Railway backend
  if (!baseUrl && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Don't add fallback for localhost - let proxy handle it
    if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
      // Production fallback - use Railway deployment
      baseUrl = 'https://guild-alumni-portal-demo.up.railway.app';
    }
  }

  // If path starts with /api, prefix with base URL
  if (path.startsWith('/api')) {
    return `${baseUrl}${path}`;
  }

  // Otherwise return as is
  return path;
}