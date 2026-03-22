'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Plus, ExternalLink, Trash2 } from 'lucide-react';
import { useSuppliers } from '@/hooks/use-suppliers';

export default function SuppliersPage() {
  const { user } = useAuth();
  const { links, isLoading, addLink, deleteLink } = useSuppliers(user?.id);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    addLink.mutate({ name: name.trim(), url: url.trim() });
    setName('');
    setUrl('');
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Supplier Links</h1>
        <p className="text-slate-500 mt-1">Save and access your supplier websites quickly</p>
      </header>

      <Card title="Add Supplier Link">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aquarium Supplies Inc"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-200 outline-none"
            />
          </div>
          <Button type="submit" disabled={!name.trim() || !url.trim()}>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Link
          </Button>
        </form>
      </Card>

      <Card title="Saved Links">
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : links.length === 0 ? (
          <p className="text-slate-500">No supplier links yet. Add one above.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{link.name}</p>
                  <p className="text-sm text-slate-500 truncate">{link.url}</p>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => deleteLink.mutate(link.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
