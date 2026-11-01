import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthResponse } from '../types/auth';
import api, { setAccessToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (institutionCode: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUserPasswordResetStatus: (status: boolean) => void;
  updateUserProfile: (profile: Pick<User, 'firstName' | 'lastName'>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize session on mount
  useEffect(() => {
    const initAuth = async () => {
      const hasSession = localStorage.getItem('has_auth_session');
      if (hasSession) {
        try {
          const res = await api.post<AuthResponse>('/auth/refresh');
          setAccessToken(res.data.accessToken);
          setUser(res.data.user);
        } catch {
          setAccessToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleExpired = () => {
      setUser(null);
      setAccessToken(null);
    };
    window.addEventListener('auth:session_expired', handleExpired);
    return () => window.removeEventListener('auth:session_expired', handleExpired);
  }, []);

  const login = async (institutionCode: string, email: string, password: string): Promise<User> => {
    const res = await api.post<AuthResponse>('/auth/login', {
      institutionCode,
      email,
      password,
    });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const updateUserPasswordResetStatus = (status: boolean) => {
    if (user) {
      setUser({ ...user, mustResetPassword: status });
    }
  };

  const updateUserProfile = (profile: Pick<User, 'firstName' | 'lastName'>) => {
    setUser((current) => current ? { ...current, ...profile } : current);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUserPasswordResetStatus,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
