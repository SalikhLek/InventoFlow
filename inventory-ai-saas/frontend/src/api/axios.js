import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      // Don't log to console.error to avoid React error boundary
      console.warn('Network Error: Is the backend running on http://127.0.0.1:8000?');
      // Return a structured error that can be handled gracefully
      error.response = {
        status: 0,
        data: {
          error: true,
          message: 'Cannot connect to server. Please make sure the backend is running on http://127.0.0.1:8000',
          status_code: 0
        }
      };
    }
    if (error.response?.status === 401) {
      // Silently handle 401 - token is invalid or expired
      // Don't log as error to avoid React error boundary
      localStorage.removeItem('access_token');
      // Ensure error has a proper structure
      if (!error.response.data) {
        error.response.data = {
          error: true,
          message: 'Unauthorized. Please log in again.',
          status_code: 401
        };
      }
    }
    return Promise.reject(error);
  }
);

export default api;


