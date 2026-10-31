'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { type AdminRole, isAdminRole, hasPermission } from '@/lib/permissions';

interface AuthState {
  token: string | null;
  username: string | null;
  loading: boolean;
  role: AdminRole;
}

interface AuthContextType extends AuthState {
  canOperate: boolean;
  canAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isTokenExpired(token: string | null): boolean {
  if (!token) {
    return true;
  }

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) {
      return true;
    }

    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };

    if (!payload.exp) {
      return false;
    }

    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    username: null,
    loading: true,
    role: 'VIEWER',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    if (isTokenExpired(token)) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      setState({ token: null, username: null, loading: false, role: 'VIEWER' });
      return;
    }

    setState({
      token,
      username,
      loading: true,
      role: 'VIEWER',
    });
    let active = true;
    api.get<{data:{role:AdminRole;username:string}}>('/api/auth/me', token || undefined).then(res => {
      if(active && isAdminRole(res.data?.role)) setState(current => ({...current, role:res.data.role,username:res.data.username}));
    }).catch(() => {}).finally(() => {if(active)setState(current=>({...current,loading:false}));});
    return () => {active=false;};
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setState({ token: null, username: null, loading: false, role: 'VIEWER' });
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ success: boolean; data: { token: string; username: string; role:AdminRole } }>(
      '/api/auth/login',
      { username, password }
    );
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('username', res.data.username);
    setState({ token: res.data.token, username: res.data.username, loading: false, role:isAdminRole(res.data.role)?res.data.role:'VIEWER' });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setState({ token: null, username: null, loading: false, role: 'VIEWER' });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, canOperate:hasPermission(state.role, 'operate'),canAdmin:hasPermission(state.role, 'admin'), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
