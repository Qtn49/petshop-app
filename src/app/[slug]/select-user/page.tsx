'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { UserCircle } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useOrganization } from '@/contexts/OrganizationContext';
import { writeDeviceSession } from '@/lib/auth/device-session';
import { isReservedSlug } from '@/lib/slug';

type OrgUser = { id: string; name: string; role: string };

function SelectUserContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company_name: companyName } = useOrganization();
  const slugParam = typeof params.slug === 'string' ? params.slug : '';
  const slug = slugParam.toLowerCase();

  const switchMode = searchParams.get('switch') === 'true';

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [peekLastDigit, setPeekLastDigit] = useState(false);
  const [pinError, setPinError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  const returnUrl = useMemo(() => {
    const r = searchParams.get('returnUrl');
    if (r?.startsWith(`/${slug}/`) && !r.includes('//')) return r;
    return `/${slug}/dashboard`;
  }, [searchParams, slug]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  useEffect(() => {
    if (!slug || isReservedSlug(slug) || switchMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/me?slug=${encodeURIComponent(slug)}`, { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { user?: { id?: string } | null };
        if (!data?.user?.id || cancelled) return;
        router.replace(returnUrl);
      } catch {
        // stay
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, switchMode, router, returnUrl]);

  useEffect(() => {
    if (!slug || isReservedSlug(slug)) return;
    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);
    fetch(`/api/auth/users?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load users');
        if (!cancelled) {
          const list = Array.isArray((data as { users?: OrgUser[] }).users) ? (data as { users: OrgUser[] }).users : [];
          const sorted = [...list].sort((a, b) => (a.role === 'admin' ? 0 : 1) - (b.role === 'admin' ? 0 : 1));
          setUsers(sorted);
        }
      })
      .catch((e) => {
        if (!cancelled) setUsersError(e instanceof Error ? e.message : 'Failed to load users');
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Default selection: first admin, else first user
  useEffect(() => {
    if (!users.length || selectedUserId) return;
    const admin = users.find((u) => u.role === 'admin');
    setSelectedUserId(admin?.id ?? users[0].id);
  }, [users, selectedUserId]);

  const fourthDigit = pinDigits[3];
  useEffect(() => {
    if (!fourthDigit) {
      setPeekLastDigit(false);
      return;
    }
    setPeekLastDigit(true);
    const t = window.setTimeout(() => setPeekLastDigit(false), 550);
    return () => window.clearTimeout(t);
  }, [fourthDigit]);

  const submitPin = useCallback(
    async (digits: string[]) => {
      const pin = digits.join('');
      if (pin.length !== 4 || !selectedUserId || !slug) return;
      setSubmitting(true);
      setPinError(false);
      try {
        const res = await fetch('/api/auth/select-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ userId: selectedUserId, pin, slug }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          user?: { id: string; name: string };
          organizationId?: string;
          error?: string;
        };
        if (!res.ok) {
          setPinError(true);
          setPinDigits(['', '', '', '']);
          inputRefs.current[0]?.focus();
          return;
        }
        const u = data.user;
        const orgId = data.organizationId;
        const sel = users.find((x) => x.id === selectedUserId);
        if (u?.id && sel && orgId) {
          writeDeviceSession(slug, {
            userId: u.id,
            userName: u.name ?? sel.name,
            organizationId: orgId,
            slug,
          });
        }
        router.replace(returnUrl);
      } catch {
        setPinError(true);
        setPinDigits(['', '', '', '']);
      } finally {
        setSubmitting(false);
      }
    },
    [selectedUserId, slug, router, returnUrl, users]
  );

  const handleDigitChange = (index: number, value: string) => {
    const d = value.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = d;
    setPinDigits(next);
    setPinError(false);
    if (d && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (d && index === 3) {
      const full = [...next];
      full[3] = d;
      if (full.every((x) => x.length === 1)) {
        void submitPin(full);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (text.length === 0) return;
    const arr = text.split('').concat(['', '', '', '']).slice(0, 4);
    setPinDigits(arr);
    if (text.length === 4) void submitPin(arr);
    else inputRefs.current[Math.min(text.length, 3)]?.focus();
  };

  if (!slug || isReservedSlug(slug)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50 p-6">
        <p className="text-stone-600">Invalid shop URL.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-amber-100/80 bg-white p-8 shadow-warm-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-stone-800">Pet Shop Manager</h1>
          <p className="mt-1 text-center text-sm text-stone-500">Select your profile and enter your PIN</p>
        </div>

        <p className="mt-6 mb-2 text-sm font-medium text-stone-700">Who is signing in?</p>

        {usersLoading && <p className="text-sm text-stone-500 py-2">Loading team…</p>}
        {usersError && <p className="text-sm text-red-600 py-1">{usersError}</p>}
        {!usersLoading && !usersError && users.length === 0 && (
          <p className="text-sm text-stone-500 py-2">No team members found.</p>
        )}

        {!usersLoading && !usersError && users.length > 0 && (
          <div className="space-y-2" id="profiles-list">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setSelectedUserId(u.id);
                  setPinError(false);
                }}
                disabled={submitting}
                className={`flex w-full items-center justify-between rounded-xl border border-amber-200/80 bg-white px-4 py-3 text-left transition-colors hover:bg-amber-50/80 disabled:opacity-60 ${
                  selectedUserId === u.id ? 'bg-primary-50/60 ring-1 ring-primary-300/50' : ''
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start">
                  <UserCircle className="h-5 w-5 shrink-0 text-primary-600/75" aria-hidden />
                  <div className="ml-3 min-w-0">
                    <div className="text-sm font-medium text-stone-800">{u.name}</div>
                    <div className="text-xs text-stone-500">{companyName || 'Pet Shop'}</div>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                    u.role === 'admin'
                      ? 'bg-primary-100 text-primary-800'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {u.role === 'admin' ? 'Admin' : 'Staff'}
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            selectedUser ? 'mt-4 max-h-[280px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          {selectedUser && (
            <div className="pt-1">
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type={i === 3 && peekLastDigit ? 'text' : 'password'}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={pinDigits[i]}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    disabled={submitting || !selectedUserId}
                    className={`h-12 w-12 rounded-lg border border-amber-200/90 bg-white text-center font-mono text-lg text-stone-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400/35 ${
                      pinError ? 'border-red-400' : ''
                    }`}
                    aria-label={`PIN digit ${i + 1}`}
                  />
                ))}
              </div>
              {pinError && <p className="mt-2 text-center text-xs text-red-500">Incorrect PIN</p>}
              <div className="mt-3 text-center">
                <button
                  type="button"
                  className="cursor-pointer text-xs text-stone-500 underline decoration-amber-200/80 hover:text-primary-700"
                  onClick={() => {
                    setPinDigits(['', '', '', '']);
                    setPinError(false);
                  }}
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-sm text-stone-500">
          <Link href="/" className="text-primary-700 underline decoration-amber-200/70 hover:text-primary-800">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SelectUserPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-warm-50 text-stone-500">Loading…</div>
      }
    >
      <SelectUserContent />
    </Suspense>
  );
}
