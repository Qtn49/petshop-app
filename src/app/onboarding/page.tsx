'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineLoader from '@/components/ui/InlineLoader';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { setOrganizationConnected, getOrganizationConnected } from '@/lib/organization-connection';
import Link from 'next/link';

type Step = 1 | 2 | 3;

const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/status')
      .then((r) => r.json())
      .then((data) => {
        const configured = !!data.configured;
        const orgConnected = getOrganizationConnected();
        if (configured && orgConnected) router.replace('/');
        else setReady(true);
      })
      .catch(() => setReady(true));
  }, [router]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [company_name, setCompany_name] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('AUD');

  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminPinConfirm, setAdminPinConfirm] = useState('');

  const [extraName, setExtraName] = useState('');
  const [extraPin, setExtraPin] = useState('');
  const [extraRole, setExtraRole] = useState<'admin' | 'staff'>('staff');
  const [extraUsers, setExtraUsers] = useState<Array<{ name: string; pin: string; role: 'admin' | 'staff' }>>([]);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!company_name.trim()) {
      setError('Company name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: company_name.trim(),
          address: address.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          currency: currency || 'AUD',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      if (data.id) setOrganizationId(data.id);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!adminName.trim()) {
      setError('Name is required');
      return;
    }
    if (!/^\d{4,6}$/.test(adminPin)) {
      setError('PIN must be 4 to 6 digits');
      return;
    }
    if (adminPin !== adminPinConfirm) {
      setError('PINs do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: adminName.trim(), pin: adminPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create admin');
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const addExtraUser = () => {
    if (!extraName.trim() || !/^\d{4,6}$/.test(extraPin)) return;
    setExtraUsers((prev) => [...prev, { name: extraName.trim(), pin: extraPin, role: extraRole }]);
    setExtraName('');
    setExtraPin('');
  };

  const handleStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      setError('Organization not set. Go back to step 1.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      for (const u of extraUsers) {
        const res = await fetch('/api/onboarding/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: u.name, pin: u.pin, role: u.role, organization_id: organizationId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create user');
      }
      setOrganizationConnected(true);
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create users');
    } finally {
      setLoading(false);
    }
  };

  const skipStep3 = () => {
    setOrganizationConnected(true);
    router.replace('/');
    router.refresh();
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Pet Shop Manager</h1>
          <p className="text-slate-500 mt-1">Setup — Step {step} of 3</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {step === 1 && (
          <Card>
            <form onSubmit={handleStep1} className="space-y-4">
              <h2 className="font-semibold text-slate-800">Company information</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company name *</label>
                <input
                  type="text"
                  value={company_name}
                  onChange={(e) => setCompany_name(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  placeholder="My Pet Shop"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address (optional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  placeholder="123 Main St"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  placeholder="shop@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  placeholder="+61 2 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <InlineLoader size={28} /> : <>Continue <ArrowRight className="w-4 h-4 inline ml-1" /></>}
              </Button>
            </form>
          </Card>
        )}

        {step === 1 && (
          <p className="text-center text-sm text-slate-500">
            Already registered?{' '}
            <Link href="/connect" className="text-primary-600 hover:underline font-medium">
              Connectez vous
            </Link>
          </p>
        )}

        {step === 2 && (
          <Card>
            <form onSubmit={handleStep2} className="space-y-4">
              <h2 className="font-semibold text-slate-800">Create admin account</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Your name *</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  placeholder="Admin"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">PIN (4–6 digits) *</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm PIN *</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={adminPinConfirm}
                  onChange={(e) => setAdminPinConfirm(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  placeholder="••••"
                />
              </div>
              <Button type="submit" disabled={loading || adminPin.length < 4 || adminPin !== adminPinConfirm} className="w-full">
                {loading ? <InlineLoader size={28} /> : <>Continue <ArrowRight className="w-4 h-4 inline ml-1" /></>}
              </Button>
            </form>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <div className="space-y-4">
              <h2 className="font-semibold text-slate-800">Add more users (optional)</h2>
              <p className="text-sm text-slate-600">You can add staff or admin accounts now, or skip and do it later in Settings.</p>

              {extraUsers.length > 0 && (
                <ul className="space-y-1 text-sm text-slate-700">
                  {extraUsers.map((u, i) => (
                    <li key={i}>{u.name} — {u.role}</li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 min-w-[6rem] px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={extraPin}
                  onChange={(e) => setExtraPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN"
                  className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
                <select
                  value={extraRole}
                  onChange={(e) => setExtraRole(e.target.value as 'admin' | 'staff')}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="button" variant="secondary" size="sm" onClick={addExtraUser} disabled={!extraName.trim() || extraPin.length < 4}>
                  Add
                </Button>
              </div>

              <form onSubmit={handleStep3} className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? <InlineLoader size={28} /> : 'Finish setup'}
                </Button>
                <Button type="button" variant="secondary" onClick={skipStep3}>
                  Skip
                </Button>
              </form>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
