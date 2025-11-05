import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch((err) => {
        // If token is invalid (401) or backend is down, clear it silently
        // Don't throw error to avoid React error boundary
        if (err.response?.status === 401 || err.code === 'ERR_NETWORK') {
          localStorage.removeItem('access_token');
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('access_token', data.access_token);
      const me = await api.get('/auth/me');
      setUser(me.data);
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        throw new Error('Cannot connect to server. Please make sure the backend is running.');
      }
      const message = err.response?.data?.message || err.message || 'Login failed';
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (username, password) => {
    try {
      await api.post('/auth/register', { username, password });
      await login(username, password);
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        throw new Error('Cannot connect to server. Please make sure the backend is running.');
      }
      const message = err.response?.data?.message || err.message || 'Registration failed';
      throw new Error(message);
    }
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout, loading }), [user, login, register, logout, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}


