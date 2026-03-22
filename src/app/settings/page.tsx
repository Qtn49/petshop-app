'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineLoader from '@/components/ui/InlineLoader';
import { Link2, Check, Plus, Trash2, Info, UserPlus } from 'lucide-react';
import { getPsychologicalPricingEnabled, setPsychologicalPricingEnabled } from '@/lib/pricing/psychologicalPricing';
import { clearOrganizationConnection } from '@/lib/organization-connection';
import { setReturnPathAfterSquareConnect, getAndClearReturnPathAfterSquare, setReturnPathAfterOrgReconnect } from '@/lib/sessionReturnPath';

type FormulaRow = { label: string; formula_percent: string };

type Organization = {
  id: string;
  company_name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  currency: string;
  invoice_new_item_fields?: string[];
};

type SquareItemField = { id: string; name: string; optionValues?: { id: string; name: string }[] };

type UserItem = { id: string; name: string | null; role: string };

type SquareStatus = {
  connected: boolean;
  locationName: string | null;
  locationId: string | null;
  merchantId: string | null;
  connectedAt: string | null;
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [squareStatus, setSquareStatus] = useState<SquareStatus | null>(null);
  const [squareLoading, setSquareLoading] = useState(true);
  const [squareDisconnecting, setSquareDisconnecting] = useState(false);

  const [invoiceFormulas, setInvoiceFormulas] = useState<FormulaRow[]>([]);
  const [invoiceFormulasLoading, setInvoiceFormulasLoading] = useState(true);
  const [invoiceFormulasSaving, setInvoiceFormulasSaving] = useState(false);
  const [invoiceFieldsSaving, setInvoiceFieldsSaving] = useState(false);
  const [psychologicalPricing, setPsychologicalPricing] = useState(false);

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationLoading, setOrganizationLoading] = useState(true);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [company_name, setCompany_name] = useState('');
  const [address, setAddress] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('AUD');
  const [squareItemFields, setSquareItemFields] = useState<SquareItemField[]>([]);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'staff'>('staff');
  const [userSaving, setUserSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'staff'>('staff');
  const [editPin, setEditPin] = useState('');

  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectConfirmText, setDisconnectConfirmText] = useState('');

  // When landing with square_connected=1, show success and redirect to return path if set
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('square_connected') === '1') {
      setMessage({ type: 'success', text: 'Square account connected successfully.' });
      const returnPath = getAndClearReturnPathAfterSquare();
      if (returnPath && returnPath.startsWith('/') && returnPath !== '/settings') {
        window.location.href = returnPath;
        return;
      }
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

  // Fetch Square item fields for "new product fields" settings (when Square connected)
  useEffect(() => {
    if (!user?.id || !squareStatus?.connected) return;
    fetch(`/api/square/catalog/item-fields?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.fields) && data.fields.length > 0) {
          setSquareItemFields(data.fields);
        }
      })
      .catch(() => {});
  }, [user?.id, squareStatus?.connected]);

  // Refetch when returning to this tab so connection status stays in sync
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const onFocus = () => fetchSquareStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.id, fetchSquareStatus]);

  // Fetch invoice formulas
  const fetchInvoiceFormulas = useCallback(async () => {
    if (!user?.id) return;
    setInvoiceFormulasLoading(true);
    try {
      const res = await fetch(`/api/settings/invoice-formulas?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.formulas)) {
        setInvoiceFormulas(
          data.formulas.map((f: { label: string; formula_percent: string }) => ({
            label: f.label ?? '',
            formula_percent: f.formula_percent ?? '',
          }))
        );
      } else {
        setInvoiceFormulas([{ label: '100%', formula_percent: '100,10' }, { label: '35%', formula_percent: '35,10' }]);
      }
    } catch {
      setInvoiceFormulas([{ label: '100%', formula_percent: '100,10' }, { label: '35%', formula_percent: '35,10' }]);
    } finally {
      setInvoiceFormulasLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchInvoiceFormulas();
  }, [fetchInvoiceFormulas]);

  useEffect(() => {
    setPsychologicalPricing(getPsychologicalPricingEnabled());
  }, []);

  const fetchOrganization = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/settings/organization?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (res.ok && data.id) {
        setOrganization(data);
        setCompany_name(data.company_name ?? '');
        setAddress(data.address ?? '');
        setOrgEmail(data.email ?? '');
        setPhone(data.phone ?? '');
        setCurrency(data.currency ?? 'AUD');
      }
    } catch {
      // ignore
    } finally {
      setOrganizationLoading(false);
    }
  }, [user?.id]);

  const fetchUsers = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/users?userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) setUsers(data.users);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.role === 'admin') {
      Promise.all([fetchOrganization(), fetchUsers()]);
    } else {
      setOrganizationLoading(false);
      setUsersLoading(false);
    }
  }, [user?.role, user?.id, fetchOrganization, fetchUsers]);

  const saveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setOrganizationSaving(true);
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          company_name: company_name.trim(),
          address: address.trim() || null,
          email: orgEmail.trim() || null,
          phone: phone.trim() || null,
          currency: currency || 'AUD',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrganization(data);
        setMessage({ type: 'success', text: 'Company settings saved.' });
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setOrganizationSaving(false);
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !newUserName.trim() || newUserPin.length < 4) return;
    setMessage(null);
    setUserSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName.trim(), pin: newUserPin, role: newUserRole, userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => [...prev, data.user]);
        setNewUserName('');
        setNewUserPin('');
        setMessage({ type: 'success', text: 'User created.' });
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed to create user' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to create user' });
    } finally {
      setUserSaving(false);
    }
  };

  const updateUser = async (id: string) => {
    if (!user?.id) return;
    setMessage(null);
    setUserSaving(true);
    try {
      const body: { name?: string; role?: string; pin?: string; userId: string } = { name: editName.trim(), role: editRole, userId: user.id };
      if (editPin.length >= 4) body.pin = editPin;
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, name: data.name, role: data.role } : u)));
        setEditingUserId(null);
        setEditName('');
        setEditRole('staff');
        setEditPin('');
        setMessage({ type: 'success', text: 'User updated.' });
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed to update' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update' });
    } finally {
      setUserSaving(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (!user?.id) return;
    if (!confirm('Remove this user? This cannot be undone.')) return;
    setMessage(null);
    setUserSaving(true);
    try {
      const res = await fetch(`/api/users/${id}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        setEditingUserId(null);
        setMessage({ type: 'success', text: 'User removed.' });
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Failed to remove user' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove user' });
    } finally {
      setUserSaving(false);
    }
  };

  const startEditUser = (u: UserItem) => {
    setEditingUserId(u.id);
    setEditName(u.name ?? '');
    setEditRole((u.role as 'admin' | 'staff') || 'staff');
    setEditPin('');
  };

  const saveInvoiceFormulas = async () => {
    if (!user?.id) return;
    setInvoiceFormulasSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/invoice-formulas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, formulas: invoiceFormulas }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Invoice formulas saved.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error ?? 'Failed to save formulas' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to save formulas' });
    } finally {
      setInvoiceFormulasSaving(false);
    }
  };

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
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      setMessage({ type: 'error', text: 'PIN must be 4 to 6 digits' });
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
    setReturnPathAfterSquareConnect();
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

      {user?.role === 'admin' && (
        <>
          <Card title="Company">
            {organizationLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <InlineLoader size={24} />
                <span>Loading…</span>
              </div>
            ) : (
              <form onSubmit={saveOrganization} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Company name</label>
                  <input
                    type="text"
                    value={company_name}
                    onChange={(e) => setCompany_name(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                  >
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <Button type="submit" disabled={organizationSaving}>
                  {organizationSaving ? <InlineLoader size={24} /> : null}
                  Save company
                </Button>
              </form>
            )}
          </Card>

          <Card title="User management">
            <p className="text-sm text-slate-600 mb-4">Create, edit, or remove user accounts. At least one admin must exist.</p>
            {usersLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <InlineLoader size={24} />
                <span>Loading…</span>
              </div>
            ) : (
              <div className="space-y-4">
                <form onSubmit={createUser} className="flex flex-wrap gap-2 items-end">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-40"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="PIN (4–6 digits)"
                    value={newUserPin}
                    onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-28"
                  />
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'staff')}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button type="submit" size="sm" disabled={userSaving || !newUserName.trim() || newUserPin.length < 4}>
                    {userSaving ? <InlineLoader size={24} /> : <UserPlus className="w-4 h-4" />}
                    <span className="ml-1">Add user</span>
                  </Button>
                </form>
                <ul className="space-y-2">
                  {users.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                      {editingUserId === u.id ? (
                        <>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-3 py-1.5 rounded border border-slate-200 text-sm w-40"
                          />
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as 'admin' | 'staff')}
                            className="px-3 py-1.5 rounded border border-slate-200 text-sm"
                          >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                          </select>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="New PIN (optional)"
                            value={editPin}
                            onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                            className="px-3 py-1.5 rounded border border-slate-200 text-sm w-28"
                          />
                          <Button size="sm" onClick={() => updateUser(u.id)} disabled={userSaving || !editName.trim()}>
                            Save
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => { setEditingUserId(null); setEditPin(''); }}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-slate-800 w-40 truncate">{u.name || 'Unnamed'}</span>
                          <span className="text-xs text-slate-500 capitalize">{u.role}</span>
                          <Button size="sm" variant="secondary" onClick={() => startEditUser(u)} disabled={userSaving}>
                            Edit
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => deleteUser(u.id)} disabled={userSaving || (users.filter((x) => x.role === 'admin').length <= 1 && u.role === 'admin')}>
                            Delete
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </>
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
              maxLength={6}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New PIN (4–6 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
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
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <Button type="submit">Change PIN</Button>
        </form>
      </Card>

      <Card title="Invoices" className="border-t border-slate-100">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-start gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                  Round price
                  <span className="relative group inline-flex">
                    <Info className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
                    <span className="absolute left-0 top-full mt-1.5 px-3 py-2 w-72 text-xs font-normal text-slate-700 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10 pointer-events-none">
                      After your percentage markup is applied, prices are rounded down: under $10 or $10–$100 → X.99 (e.g. 16.80 → 15.99); $100 and above → X.95 (e.g. 129.40 → 128.95). Only rounds down, never up.
                    </span>
                  </span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  When on, calculated prices are rounded down to .99 (under $100) or .95 ($100+). Default: off.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="roundPrice"
                  checked={!psychologicalPricing}
                  onChange={() => {
                    setPsychologicalPricing(false);
                    setPsychologicalPricingEnabled(false);
                  }}
                  className="w-4 h-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">Off</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="roundPrice"
                  checked={psychologicalPricing}
                  onChange={() => {
                    setPsychologicalPricing(true);
                    setPsychologicalPricingEnabled(true);
                  }}
                  className="w-4 h-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700">On</span>
              </label>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Calculated price formulas: label and formula in % only (e.g. <code className="bg-slate-100 px-1 rounded text-xs">100,10</code> = 100% then 10%).
          </p>
          {invoiceFormulasLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <InlineLoader size={24} />
              <span>Loading…</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {invoiceFormulas.map((row, i) => (
                  <div key={i} className="flex gap-2 items-center flex-wrap">
                    <input
                      type="text"
                      placeholder="Label"
                      value={row.label}
                      onChange={(e) =>
                        setInvoiceFormulas((prev) => {
                          const next = [...prev];
                          next[i] = { ...next[i], label: e.target.value };
                          return next;
                        })
                      }
                      className="flex-1 min-w-[6rem] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Formula % (e.g. 100,10)"
                      value={row.formula_percent}
                      onChange={(e) =>
                        setInvoiceFormulas((prev) => {
                          const next = [...prev];
                          next[i] = { ...next[i], formula_percent: e.target.value };
                          return next;
                        })
                      }
                      className="flex-1 min-w-[8rem] px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setInvoiceFormulas((prev) => prev.filter((_, j) => j !== i))}
                      className="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setInvoiceFormulas((prev) => [...prev, { label: '', formula_percent: '' }])}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add formula
                </Button>
                <Button type="button" onClick={saveInvoiceFormulas} disabled={invoiceFormulasSaving}>
                  {invoiceFormulasSaving ? (
                    <>
                      <InlineLoader size={24} />
                      Saving…
                    </>
                  ) : (
                    'Save formulas'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card title="Square Integration">
        {squareLoading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <InlineLoader size={24} />
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
                <span className="inline-flex items-center gap-2">
                  <InlineLoader size={24} />
                  Disconnecting…
                </span>
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
            {process.env.NODE_ENV === 'development' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                <p className="font-medium mb-1">If you get a 400 error (Sandbox):</p>
                <ol className="list-decimal list-inside space-y-1 text-amber-800">
                  <li>Open the <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Square Developer Dashboard</a> in another tab.</li>
                  <li>Select <strong>Sandbox</strong>, open your app, and open the Sandbox seller dashboard (or log in to Sandbox).</li>
                  <li>Keep that tab open, then click &quot;Connect with Square&quot; below.</li>
                  <li>Ensure the <strong>Redirect URL</strong> in Square OAuth settings matches exactly: your callback URL with no trailing slash.</li>
                </ol>
              </div>
            )}
            <Button onClick={handleConnectSquare}>
              <Link2 className="w-4 h-4 mr-2" />
              Connect with Square
            </Button>
          </div>
        )}
      </Card>

      {user?.role === 'admin' && (
        <Card title="Danger Zone" className="border-red-200 bg-red-50/30">
          <p className="text-sm text-slate-600 mb-4">
            Disconnect this application from the current organization. You will need to create or connect to an organization again to use the app.
          </p>
          <Button
            variant="secondary"
            onClick={() => { setShowDisconnectModal(true); setDisconnectConfirmText(''); }}
            className="w-full sm:w-auto py-3 px-6 bg-red-600 hover:bg-red-700 text-white border-red-600 font-medium text-base"
          >
            Disconnect this organization
          </Button>
        </Card>
      )}

      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDisconnectModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Disconnect organization</h3>
            <p className="text-sm text-slate-600 mb-4">
              You are about to disconnect this application from the current organization.
              This will remove the organization from this device and end all active sessions.
              You will need to reconnect or configure a new organization to continue using the application.
            </p>
            <input
              type="text"
              value={disconnectConfirmText}
              onChange={(e) => setDisconnectConfirmText(e.target.value)}
              placeholder="Type confirm to confirm"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-200 outline-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => { setShowDisconnectModal(false); setDisconnectConfirmText(''); }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setReturnPathAfterOrgReconnect();
                  clearOrganizationConnection();
                  setShowDisconnectModal(false);
                  logout();
                }}
                disabled={disconnectConfirmText.trim().toLowerCase() !== 'confirm'}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none text-white"
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
