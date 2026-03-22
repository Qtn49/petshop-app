'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Test page for GET /api/vendors.
 * Open http://localhost:3000/test-vendors (while logged in) then click "Load vendors".
 */
export default function TestVendorsPage() {
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const fetchVendors = async () => {
    if (!user?.id) return;
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/vendors?userId=${encodeURIComponent(user.id)}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      setData({ status: res.status, ok: res.ok, body: json });
    } catch (e) {
      setData({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading session…</div>;
  }
  if (!user) {
    return (
      <div className="p-6">
        <p>Log in to test GET /api/vendors.</p>
        <a href="/" className="text-blue-600 underline">Back to home</a>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-2">Test GET /api/vendors</h1>
      <p className="text-sm text-gray-600 mb-2">
        userId = <code className="bg-gray-100 px-1 rounded">{user.id}</code>
      </p>
      <p className="text-xs text-amber-700 mb-4">
        Use <strong>localhost</strong> (e.g. http://localhost:3000/test-vendors). Ngrok can return HTML for assets and break the page.
      </p>
      <button
        type="button"
        onClick={fetchVendors}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Load vendors'}
      </button>
      {data != null && (
        <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
