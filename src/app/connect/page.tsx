'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InlineLoader from '@/components/ui/InlineLoader';
import { setOrganizationConnected } from '@/lib/organization-connection';

const SESSION_STORAGE_KEY = 'petshop_session';

export default function ConnectPage() {
  const router = useRouter();
  const [organizationIdentifier, setOrganizationIdentifier] = useState('');
  const [userName, setUserName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!organizationIdentifier.trim() || !userName.trim() || pin.length < 4) {
      setError('Please fill all fields. PIN must be 4–6 digits.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/connect-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationIdentifier: organizationIdentifier.trim(),
          userName: userName.trim(),
          pin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connection failed');
        return;
      }
      const session = {
        user: {
          id: data.user.id,
          name: data.user.name ?? null,
          email: data.user.email ?? null,
          role: data.user.role ?? 'staff',
          organization_id: data.organization_id,
        },
        organization_id: data.organization_id,
        login_timestamp: data.login_timestamp,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      setOrganizationConnected(true);
      window.location.href = '/dashboard';
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Connect to organization</h1>
          <p className="text-slate-500 mt-1">Sign in with your organization and user account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Organization name</label>
            <input
              type="text"
              value={organizationIdentifier}
              onChange={(e) => setOrganizationIdentifier(e.target.value)}
              placeholder="Your company name"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
              autoComplete="organization"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PIN (4–6 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white font-medium rounded-xl transition"
          >
            {loading ? <InlineLoader size={32} /> : 'Connect'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          <a href="/" className="text-primary-600 hover:underline">Back to start</a>
        </p>
      </div>
    </div>
  );
}
