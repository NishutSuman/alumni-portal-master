// src/services/api.ts
import axios, { AxiosResponse, AxiosError } from 'axios';
import { store } from '@/store';
import { logout } from '@/store/slices/authSlice';

// Detect if we're running in Capacitor (mobile) vs web
const isCapacitor = typeof window !== 'undefined' && 
  (window as any).Capacitor && 
  (window as any).Capacitor.isNativePlatform();

// Use different API URLs based on environment
const getApiBaseUrl = () => {
  if (isCapacitor) {
    // Mobile app - use Android emulator localhost address
    return 'http://10.0.2.2:3000/api';
  } else {
    // Desktop web - use regular localhost
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  }
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000, // 10 seconds timeout
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state.auth.token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401) {
      // Check if it's not a login or register request
      const isAuthRequest = error.config?.url?.includes('/auth/login') || 
                           error.config?.url?.includes('/auth/register');
      
      if (!isAuthRequest) {
        // Token is invalid, logout user
        store.dispatch(logout());
        window.location.href = '/auth/login';
      }
    }
    
    // Handle network errors
    if (!error.response) {
      error.message = 'Network error - please check your connection';
    }
    
    return Promise.reject(error);
  }
);

// Utility functions for different HTTP methods
export const apiClient = {
  get: <T = unknown>(url: string, config?: any) => 
    api.get<T>(url, config),
    
  post: <T = unknown>(url: string, data?: any, config?: any) => 
    api.post<T>(url, data, config),
    
  put: <T = unknown>(url: string, data?: any, config?: any) => 
    api.put<T>(url, data, config),
    
  patch: <T = unknown>(url: string, data?: any, config?: any) => 
    api.patch<T>(url, data, config),
    
  delete: <T = unknown>(url: string, config?: any) => 
    api.delete<T>(url, config),
    
  // Special method for file uploads
  postFormData: <T = unknown>(url: string, formData: FormData, config?: any) => 
    api.post<T>(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers,
      },
    }),
};

// Export as both named and default for compatibility
export { api };
export default api;