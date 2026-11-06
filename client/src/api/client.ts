import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem('has_auth_session', 'true');
  } else {
    localStorage.removeItem('has_auth_session');
  }
};

export const getAccessToken = () => accessToken;

/**
 * Resolves a download or view URL returned by the backend.
 * If url is already absolute (http://, https://, blob:), returns it.
 * Otherwise, combines with the API host / base URL so it works in both
 * local development and production (e.g. Vercel -> Render).
 */
export const resolveFileUrl = (url: string, token?: string | null): string => {
  if (!url) return '';
  let fullUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('blob:')) {
    const rawBase = import.meta.env.VITE_API_URL || '/api';
    const base = rawBase.replace(/\/+$/, '');
    // If base ends with '/api' and url starts with '/api/', remove duplicate '/api'
    const cleanPath = url.startsWith('/api/') ? url.slice(4) : (url.startsWith('/') ? url : `/${url}`);
    fullUrl = `${base}${cleanPath}`;
  }

  const effectiveToken = token || accessToken;
  if (effectiveToken && !fullUrl.includes('token=')) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}token=${encodeURIComponent(effectiveToken)}`;
  }
  return fullUrl;
};

// Request Interceptor: Attach Bearer token and normalize URLs
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }
    // Prevent duplicate "/api/api/" when baseURL already ends with "/api"
    if (config.url && config.url.startsWith('/api/')) {
      config.url = config.url.slice(4);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-refresh access token on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/login') && !originalRequest.url?.includes('/auth/refresh')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${api.defaults.baseURL?.replace(/\/$/, '')}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.accessToken;
        setAccessToken(newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as AxiosError, null);
        setAccessToken(null);
        window.dispatchEvent(new Event('auth:session_expired'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
