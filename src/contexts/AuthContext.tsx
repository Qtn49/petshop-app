'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { setOrganizationConnected } from '@/lib/organization-connection';
import { tenantSlugFromPathname } from '@/lib/slug';
import { writeDeviceSession } from '@/lib/auth/device-session';

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
  /** Legacy: user id + PIN (e.g. tools). */
  loginWithUserId: (userId: string, pin: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'petshop_session';

async function persistSessionFromResponse(
  data: {
    user: User;
    organization_id: string;
    login_timestamp: string;
  },
  slug?: string | null
) {
  const session: Session = {
    user: data.user,
    organization_id: data.organization_id,
    login_timestamp: data.login_timestamp,
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    setOrganizationConnected(true);
  }
  const s = (slug ?? '').trim().toLowerCase();
  if (s && data.user?.id && data.organization_id) {
    writeDeviceSession(s, {
      userId: data.user.id,
      userName: data.user.name ?? 'User',
      organizationId: data.organization_id,
      slug: s,
    });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const slug = tenantSlugFromPathname(pathname);

    async function init() {
      if (slug) {
        try {
          const r = await fetch(`/api/auth/me?slug=${encodeURIComponent(slug)}`, {
            credentials: 'include',
            cache: 'no-store',
          });
          if (!cancelled && r.ok) {
            const data = (await r.json()) as { user?: User | null };
            if (data?.user?.id) {
              const u = data.user;
              setUser({
                id: u.id,
                name: u.name ?? null,
                email: u.email ?? null,
                role: (u.role as 'admin' | 'staff') ?? 'staff',
                organization_id: u.organization_id ?? '',
              });
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // fall through
        }
      }

      try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
        if (stored && !cancelled) {
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
        if (!cancelled) setIsLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const loginWithUserId = useCallback(async (userId: string, pin: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, pin }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as {
        slug?: string;
        user: User;
        organization_id?: string;
        login_timestamp: string;
      };
      const organization_id = data.user?.organization_id ?? data.organization_id ?? '';
      await persistSessionFromResponse(
        {
          user: {
            id: data.user.id,
            name: data.user.name ?? null,
            email: data.user.email ?? null,
            role: (data.user.role as 'admin' | 'staff') ?? 'staff',
            organization_id,
          },
          organization_id,
          login_timestamp: data.login_timestamp,
        },
        data.slug ?? null
      );
      setUser({
        id: data.user.id,
        name: data.user.name ?? null,
        email: data.user.email ?? null,
        role: (data.user.role as 'admin' | 'staff') ?? 'staff',
        organization_id,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithUserId }}>
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
