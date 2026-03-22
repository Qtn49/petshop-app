'use client';

import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthBranding from '@/components/auth/AuthBranding';
import InlineLoader from '@/components/ui/InlineLoader';

const LAST_SLUG_KEY = 'ps_last_slug';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shopSlug, setShopSlug] = useState('');
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hostPreview, setHostPreview] = useState('petshop.app');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    if (typeof window !== 'undefined') setHostPreview(window.location.host || 'petshop.app');
  }, []);

  const normalizedSlug = shopSlug.trim().toLowerCase().replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-');

  const submit = useCallback(
    async (pin: string) => {
      if (pin.length !== 4 || !normalizedSlug) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch('/api/auth/register-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ slug: normalizedSlug, pin }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
        if (!res.ok) {
          const msg = data.error ?? 'Something went wrong';
          if (res.status === 404 || msg.toLowerCase().includes('not found')) setError('Shop not found');
          else if (msg.toLowerCase().includes('admin')) setError('Only admins can register a new device');
          else if (res.status === 401) setError('Incorrect PIN');
          else setError(msg);
          setPinDigits(['', '', '', '']);
          inputRefs.current[0]?.focus();
          return;
        }
        try {
          localStorage.setItem(LAST_SLUG_KEY, normalizedSlug);
        } catch {
          // ignore
        }
        const next = searchParams.get('returnUrl');
        const target =
          next && next.startsWith('/') && !next.startsWith('//')
            ? next
            : `/${normalizedSlug}/select-user`;
        router.replace(target);
      } catch {
        setError('Network error');
        setPinDigits(['', '', '', '']);
      } finally {
        setSubmitting(false);
      }
    },
    [normalizedSlug, router, searchParams]
  );

  const handleDigitChange = (index: number, value: string) => {
    const d = value.replace(/\D/g, '').slice(-1);
    const next = [...pinDigits];
    next[index] = d;
    setPinDigits(next);
    setError(null);
    if (d && index < 3) inputRefs.current[index + 1]?.focus();
    if (d && index === 3) {
      const full = [...next];
      full[3] = d;
      if (full.every((x) => x.length === 1)) void submit(full.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pinDigits.join('');
    if (pin.length === 4 && normalizedSlug) void submit(pin);
  };

  return (
    <div className="min-h-screen bg-auth-cream flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-amber-100 border border-amber-100/80">
        <AuthBranding subtitle="Sign in on this device" />

        <div className="flex justify-center -mt-4 mb-6">
          <span
            className={`inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 truncate ${
              normalizedSlug
                ? 'bg-primary-100 text-primary-800 ring-primary-200/60'
                : 'bg-stone-100 text-stone-500 ring-stone-200/80'
            }`}
          >
            Your shop: {normalizedSlug || 'chinchilla-pet-equine'}
          </span>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div>
            <label htmlFor="shop-slug" className="block text-sm font-medium text-stone-800 mb-1.5">
              Your shop URL
            </label>
            <input
              id="shop-slug"
              type="text"
              value={shopSlug}
              onChange={(e) => setShopSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="chinchilla-pet-equine"
              className="w-full px-4 py-3 rounded-xl border border-amber-200/90 bg-white text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-primary-400/45 focus:border-primary-500 transition-shadow"
              autoComplete="off"
              autoCapitalize="none"
            />
            {normalizedSlug && (
              <p className="text-xs text-stone-500 mt-2 font-mono">
                {hostPreview}/{normalizedSlug}
              </p>
            )}
          </div>

          <div>
            <p className="block text-sm font-medium text-stone-800 mb-2">Admin PIN</p>
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={pinDigits[i]}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={submitting}
                  className="h-16 w-[4.25rem] text-center text-3xl font-semibold tracking-tight text-stone-800 rounded-xl border-2 border-amber-200/90 bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-400/40 focus:outline-none transition-shadow disabled:opacity-60"
                  aria-label={`PIN digit ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !normalizedSlug || pinDigits.join('').length !== 4}
            className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed text-white font-semibold shadow-md shadow-primary-600/20 transition-colors"
          >
            {submitting ? <InlineLoader size={32} /> : 'Access my shop'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-stone-500">
          New to PetShop?{' '}
          <Link href="/register" className="text-primary-700 font-medium hover:text-primary-800 hover:underline">
            Get your own shop →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-auth-cream flex items-center justify-center">
          <InlineLoader size={40} />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
