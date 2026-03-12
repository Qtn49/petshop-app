'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { setOrganizationConnected } from '@/lib/organization-connection';

export type User = {
  id: string;
  name: string | null;
  email: string | null;
  role: 'admin' | 'staff';
  organization_id: string;
};

type Session = {
  user: User;
  organization_id: string;
  login_timestamp: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (userId: string, pin: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'petshop_session';
const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef<() => void>(() => {});

  const logout = useCallback(() => {
    setUser(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);

  logoutRef.current = logout;

  useEffect(() => {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored) as Session;
        if (parsed?.user?.id && parsed?.login_timestamp) {
          setUser({
            id: parsed.user.id,
            name: parsed.user.name ?? null,
            email: parsed.user.email ?? null,
            role: parsed.user.role ?? 'staff',
            organization_id: parsed.user.organization_id ?? parsed.organization_id ?? '',
          });
        }
      }
    } catch {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!user) return;
    inactivityTimerRef.current = setTimeout(() => {
      inactivityTimerRef.current = null;
      logoutRef.current();
    }, INACTIVITY_MS);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    resetInactivityTimer();
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetInactivityTimer));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetInactivityTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [user, resetInactivityTimer]);

  const login = async (userId: string, pin: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, pin }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      const organization_id = data.user?.organization_id ?? data.organization_id ?? '';
      const session: Session = {
        user: {
          id: data.user.id,
          name: data.user.name ?? null,
          email: data.user.email ?? null,
          role: data.user.role ?? 'staff',
          organization_id,
        },
        organization_id,
        login_timestamp: data.login_timestamp,
      };
      setUser(session.user);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        setOrganizationConnected(true);
      }
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
