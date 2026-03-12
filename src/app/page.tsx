'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/auth/LoginForm';
import InitialScreen from '@/components/auth/InitialScreen';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { getOrganizationConnected } from '@/lib/organization-connection';

const STATUS_TIMEOUT_MS = 15000;

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [orgConnected, setOrgConnected] = useState<boolean | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    setOrgConnected(getOrganizationConnected());
  }, []);

  const fetchStatus = useCallback(() => {
    setStatusError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
    fetch('/api/onboarding/status', { signal: controller.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        clearTimeout(timeoutId);
        setConfigured(!!data.configured);
        setOnboardingChecked(true);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setStatusError('timeout');
        } else {
          setStatusError('error');
        }
        setConfigured(false);
        setOnboardingChecked(true);
      });
  }, []);

  useEffect(() => {
    if (orgConnected === true) fetchStatus();
  }, [orgConnected, fetchStatus]);

  useEffect(() => {
    if (orgConnected !== true) return;
    if (!onboardingChecked || configured === null) return;
    if (!configured) {
      router.replace('/onboarding');
      return;
    }
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [orgConnected, onboardingChecked, configured, authLoading, user, router]);

  if (orgConnected === false) {
    return <InitialScreen />;
  }

  if (orgConnected === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!onboardingChecked || configured === null) {
    if (statusError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-sm w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h2 className="font-semibold text-slate-800 mb-1">Connection issue</h2>
            <p className="text-sm text-slate-600 mb-4">
              {statusError === 'timeout'
                ? 'The app is taking too long to respond. If you’re using ngrok or a tunnel, open this URL in a new tab and accept the connection warning, then retry.'
                : 'Could not reach the server. Check your connection and retry.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setOnboardingChecked(false);
                setConfigured(null);
                setStatusError(null);
                fetchStatus();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <p className="text-xs text-slate-500 text-center max-w-xs">
          If the app doesn’t load, open this URL in a new tab, accept any connection warning (e.g. ngrok), then refresh.
        </p>
      </div>
    );
  }

  if (!configured) {
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <LoginForm />;
}
