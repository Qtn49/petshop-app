'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const LAST_SLUG_KEY = 'ps_last_slug';

export default function LandingPage() {
  const [lastSlug, setLastSlug] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(LAST_SLUG_KEY);
      if (s?.trim()) setLastSlug(s.trim().toLowerCase());
    } catch {
      setLastSlug(null);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF8F0] flex flex-col">
      <header className="border-b border-amber-200/50 bg-white/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-stone-800">
            <span aria-hidden>🐾</span>
            Pet Shop Manager
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-amber-800/80 text-sm font-medium uppercase tracking-widest mb-3">Welcome</p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-stone-900 max-w-2xl leading-tight">Pet Shop Manager</h1>
        <p className="mt-4 text-lg text-stone-600 max-w-lg">Run your shop from one calm, simple place.</p>

        {lastSlug && (
          <div className="mt-10 w-full max-w-md rounded-2xl border border-amber-200/80 bg-white/90 p-5 shadow-warm-sm text-left">
            <p className="text-sm font-medium text-stone-700">Continue as {lastSlug}?</p>
            <Link
              href={`/${lastSlug}/select-user`}
              className="mt-3 inline-flex w-full justify-center py-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-semibold transition"
            >
              Go to {lastSlug}
            </Link>
          </div>
        )}

        <div className={`mt-10 flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center ${lastSlug ? 'mt-6' : ''}`}>
          <Link
            href="/login"
            className="inline-flex justify-center items-center px-8 py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-lg shadow-amber-900/15 transition"
          >
            Sign in to my shop
          </Link>
          <Link
            href="/register"
            className="inline-flex justify-center items-center px-8 py-3.5 rounded-xl border-2 border-amber-700/25 bg-white text-stone-900 font-semibold hover:bg-amber-50 transition"
          >
            Get your own shop
          </Link>
        </div>
      </main>

      <footer className="border-t border-amber-200/40 py-6 text-center text-sm text-stone-500">
        © {new Date().getFullYear()} Pet Shop Manager
      </footer>
    </div>
  );
}
