'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import InlineLoader from '@/components/ui/InlineLoader';
import { User } from 'lucide-react';

type UserItem = { id: string; name: string | null; role: string; organization_name?: string };

export default function LoginForm() {
  const { loginWithUserId } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.users)) setUsers(data.users);
      })
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !pin) return;
    setError('');
    setSubmitting(true);
    const success = await loginWithUserId(selectedUserId, pin);
    setSubmitting(false);
    if (!success) {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
  };

  const handlePinChange = (value: string) => {
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setPin(value);
      setError('');
    }
  };

  if (usersLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" />;
  }

  if (users.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="text-center text-slate-600">
          <p>No users found. Complete onboarding first.</p>
          <a href="/onboarding" className="text-primary-600 underline mt-2 inline-block">Go to setup</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Pet Shop Manager</h1>
          <p className="text-slate-500 mt-1">Select your profile and enter your PIN</p>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-700">Who is signing in?</p>
          <div className="grid gap-2">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setSelectedUserId(u.id);
                  setPin('');
                  setError('');
                }}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border text-left transition ${
                  selectedUserId === u.id
                    ? 'border-primary-500 bg-primary-50 text-primary-800'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <User className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium block truncate">{u.name || 'Unnamed'}</span>
                  {u.organization_name ? (
                    <span className="text-xs text-slate-500 block truncate">{u.organization_name}</span>
                  ) : null}
                </div>
                <span className="text-xs text-slate-500 capitalize flex-shrink-0">{u.role}</span>
              </button>
            ))}
          </div>

          {selectedUserId && (
            <form onSubmit={handleSubmit} className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">PIN (4–6 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.5em] py-4 px-4 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={pin.length < 4 || submitting}
                className="w-full mt-4 py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition"
              >
                {submitting ? <InlineLoader size={32} /> : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
