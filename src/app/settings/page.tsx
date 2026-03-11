'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Link2, Loader2, Check } from 'lucide-react';

type SquareStatus = {
  connected: boolean;
  locationName: string | null;
  locationId: string | null;
  merchantId: string | null;
  connectedAt: string | null;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [squareStatus, setSquareStatus] = useState<SquareStatus | null>(null);
  const [squareLoading, setSquareLoading] = useState(true);
  const [squareDisconnecting, setSquareDisconnecting] = useState(false);

  // When landing with square_connected=1, show success and connected immediately (before user/fetch)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('square_connected') === '1') {
      setMessage({ type: 'success', text: 'Square account connected successfully.' });
      window.history.replaceState({}, '', '/settings');
      setSquareStatus((prev) => ({
        ...(prev ?? {}),
        connected: true,
        locationName: prev?.locationName ?? null,
        locationId: prev?.locationId ?? null,
        merchantId: prev?.merchantId ?? null,
        connectedAt: prev?.connectedAt ?? new Date().toISOString(),
      }));
      setSquareLoading(false);
    }
    if (params.get('square_error')) {
      const desc = params.get('square_error_description') || 'Something went wrong.';
      setMessage({ type: 'error', text: `Square: ${desc}` });
      window.history.replaceState({}, '', '/settings');
      setSquareLoading(false);
    }
  }, []);

  // Fetch Square connection status when user is available (and refetch after connect so persisted data is shown)
  const fetchSquareStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/square/connection?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setSquareStatus((prev) => (prev?.connected && !data.connected ? { ...data, connected: true } : data));
      } else {
        setSquareStatus((prev) => (prev?.connected ? prev : { connected: false, locationName: null, locationId: null, merchantId: null, connectedAt: null }));
      }
    } catch {
      setSquareStatus((prev) => (prev?.connected ? prev : { connected: false, locationName: null, locationId: null, merchantId: null, connectedAt: null }));
    } finally {
      setSquareLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSquareStatus();
  }, [fetchSquareStatus]);

  // Refetch when returning to this tab so connection status stays in sync
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const onFocus = () => fetchSquareStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id, fetchSquareStatus]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, name }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Update failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Update failed' });
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPin !== confirmPin) {
      setMessage({ type: 'error', text: 'PINs do not match' });
      return;
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setMessage({ type: 'error', text: 'PIN must be 4 digits' });
      return;
    }
    try {
      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          currentPin,
          newPin,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'PIN updated' });
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setMessage({ type: 'error', text: data.error || 'PIN change failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'PIN change failed' });
    }
  };

  const handleConnectSquare = () => {
    if (!user?.id) return;
    window.location.href = `/api/square/connect?userId=${encodeURIComponent(user.id)}`;
  };

  const handleDisconnectSquare = async () => {
    if (!user?.id) return;
    setMessage(null);
    setSquareDisconnecting(true);
    try {
      const res = await fetch('/api/square/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSquareStatus({ connected: false, locationName: null, locationId: null, merchantId: null, connectedAt: null });
        setMessage({ type: 'success', text: 'Square account disconnected.' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to disconnect' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    } finally {
      setSquareDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account</p>
      </header>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <Card title="Profile">
        <form onSubmit={handleUpdateName} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <Button type="submit">Save</Button>
        </form>
      </Card>

      <Card title="Change PIN">
        <form onSubmit={handleChangePin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <Button type="submit">Change PIN</Button>
        </form>
      </Card>

      <Card title="Square Integration">
        {squareLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading…</span>
          </div>
        ) : squareStatus?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700">
              <Check className="w-5 h-5" />
              <span className="font-medium">Square Connected</span>
            </div>
            {squareStatus.locationName && (
              <p className="text-sm text-slate-600">
                Location: {squareStatus.locationName}
              </p>
            )}
            <Button
              variant="secondary"
              onClick={handleDisconnectSquare}
              disabled={squareDisconnecting}
            >
              {squareDisconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting…
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Connect your Square account to sync catalog and create purchase orders from invoices.
            </p>
            <Button onClick={handleConnectSquare}>
              <Link2 className="w-4 h-4 mr-2" />
              Connect with Square
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
