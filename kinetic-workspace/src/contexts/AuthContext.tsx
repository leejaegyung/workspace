import React, { createContext, useContext, useState, useEffect } from 'react';
import { register401Handler } from '../lib/apiFetch';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (name: string, email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// 글로벌 401 콜백 — AuthProvider가 등록
let _on401: (() => void) | null = null;
export function setOn401(fn: () => void) { _on401 = fn; }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (res.status === 401 && !path.includes('/api/auth/')) {
    _on401?.();
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 글로벌 401 → 자동 로그아웃 + 로그인 페이지 이동
  useEffect(() => {
    register401Handler(() => {
      setUser(null);
    });
  }, []);

  // 앱 시작 시 세션 복원
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(({ ok, data }) => { if (ok) setUser(data.user); })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { ok, data } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!ok) return { success: false, error: data.error ?? '로그인 실패' };
    setUser(data.user);
    return { success: true };
  };

  const register = async (name: string, email: string, password: string) => {
    const { ok, data } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (!ok) return { success: false, error: data.error ?? '회원가입 실패' };
    setUser(data.user);
    return { success: true };
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const updateProfile = async (name: string, email: string) => {
    const { ok, data } = await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name, email }),
    });
    if (!ok) return { success: false, error: data.error ?? '저장 실패' };
    setUser(data.user);
    return { success: true };
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    const { ok, data } = await apiFetch('/api/auth/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!ok) return { success: false, error: data.error ?? '변경 실패' };
    return { success: true };
  };

  const isAdmin = user?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, login, register, logout, updateProfile, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
