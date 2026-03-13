'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { AlertCircle, X, Settings } from 'lucide-react';

const DISMISS_KEY = 'petshop_square_popup_dismissed';

export default function SquareNotConnectedPopup() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isSettingsPage = pathname === '/settings';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!user?.id || dismissed) {
      setConnected(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/square/connection?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConnected(!!data?.connected);
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, dismissed]);

  const goToSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }, []);

  if (!user || connected !== false || dismissed || isSettingsPage) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="square-popup-title">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 relative">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-4 right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 id="square-popup-title" className="text-lg font-semibold text-slate-800 mb-1">
              Square is not connected
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Connect your Square account in Settings to sync your catalog and create purchase orders from invoices.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={goToSettings}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition"
              >
                <Settings className="w-4 h-4" />
                Go to Settings
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
