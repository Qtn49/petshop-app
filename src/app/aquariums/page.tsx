'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { Plus, Fish, ChevronRight, Pencil, Droplets, X } from 'lucide-react';

type WaterGroup = {
  id: string;
  name: string;
  description: string | null;
};

type Tank = {
  id: string;
  name: string;
  fish_species: string | null;
  fish_count: number;
  notes: string | null;
  slug: string | null;
  water_group_id: string | null;
  temperature: number | null;
  ph: number | null;
  last_cleaned_at: string | null;
};

async function fetchTanks(userId: string): Promise<Tank[]> {
  const res = await fetch(`/api/tanks?userId=${userId}`);
  if (!res.ok) return [];
  const d = await res.json();
  return d.tanks ?? [];
}

async function fetchWaterGroups(userId: string): Promise<WaterGroup[]> {
  const res = await fetch(`/api/water-groups?userId=${userId}`);
  if (!res.ok) return [];
  const d = await res.json();
  return Array.isArray(d) ? d : [];
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export default function AquariumsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newGroupName, setNewGroupName] = useState('');
  const [bulkGroupId, setBulkGroupId] = useState<string | null>(null);
  const [bulkTemp, setBulkTemp] = useState('');
  const [bulkPh, setBulkPh] = useState('');
  const [bulkCleaned, setBulkCleaned] = useState('');

  const { data: tanks = [], isLoading: tanksLoading } = useQuery({
    queryKey: ['tanks', user?.id],
    queryFn: () => fetchTanks(user!.id),
    enabled: !!user?.id,
  });

  const { data: waterGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['water-groups', user?.id],
    queryFn: () => fetchWaterGroups(user!.id),
    enabled: !!user?.id,
  });

  const groupMap = Object.fromEntries(waterGroups.map((g) => [g.id, g]));

  const createGroup = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/water-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user!.id, name: newGroupName.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-groups', user?.id] });
      setNewGroupName('');
    },
  });

  const assignTank = useMutation({
    mutationFn: async ({ tankId, waterGroupId }: { tankId: string; waterGroupId: string | null }) => {
      const res = await fetch(`/api/tanks/${tankId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user!.id, water_group_id: waterGroupId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks', user?.id] });
    },
  });

  const bulkUpdateGroup = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/water-groups/${bulkGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user!.id,
          bulk_update: true,
          temperature: bulkTemp ? parseFloat(bulkTemp) : undefined,
          ph: bulkPh ? parseFloat(bulkPh) : undefined,
          last_cleaned_at: bulkCleaned || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['water-groups', user?.id] });
      setBulkGroupId(null);
      setBulkTemp('');
      setBulkPh('');
      setBulkCleaned('');
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Aquarium Management</h1>
          <p className="text-slate-500 mt-1">Manage your tanks and fish</p>
        </div>
        <a href="/aquariums/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Tank
          </Button>
        </a>
      </header>

      <Card title="Water Groups">
        <p className="text-sm text-slate-600 mb-4">
          Group aquariums that share the same water system (filter/pump). Update parameters for all tanks in a group at once.
        </p>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">New group</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g. Système A"
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm w-48"
            />
          </div>
          <Button
            size="sm"
            disabled={!newGroupName.trim() || createGroup.isPending}
            onClick={() => createGroup.mutate()}
          >
            {createGroup.isPending ? 'Creating...' : 'Add Group'}
          </Button>
        </div>
        {waterGroups.length > 0 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Assign tanks to groups</p>
              <div className="flex flex-wrap gap-4">
                {tanks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 w-28 truncate">{t.name}</span>
                    <select
                      value={t.water_group_id ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        assignTank.mutate({
                          tankId: t.id,
                          waterGroupId: v || null,
                        });
                      }}
                      className="text-sm rounded border border-slate-200 px-2 py-1"
                    >
                      <option value="">— No group</option>
                      {waterGroups.map((wg) => (
                        <option key={wg.id} value={wg.id}>
                          {wg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Update all tanks in a group</p>
              <div className="flex flex-wrap gap-2">
                {waterGroups.map((g) => {
                  const groupTanks = tanks.filter((t) => t.water_group_id === g.id);
                  return (
                    <div key={g.id} className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 flex items-center gap-1">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        {g.name}
                        {groupTanks.length > 0 && (
                          <span className="text-slate-500 font-normal">
                            ({groupTanks.length} tank{groupTanks.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setBulkGroupId(g.id)}
                      >
                        Update parameters
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Card>

      {bulkGroupId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Update group parameters</h3>
              <button
                type="button"
                onClick={() => setBulkGroupId(null)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={bulkTemp}
                  onChange={(e) => setBulkTemp(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">pH</label>
                <input
                  type="number"
                  step="0.1"
                  value={bulkPh}
                  onChange={(e) => setBulkPh(e.target.value)}
                  placeholder="e.g. 7.0"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last cleaned</label>
                <input
                  type="date"
                  value={bulkCleaned}
                  onChange={(e) => setBulkCleaned(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => bulkUpdateGroup.mutate()}
                  disabled={bulkUpdateGroup.isPending}
                >
                  {bulkUpdateGroup.isPending ? 'Updating...' : 'Update all'}
                </Button>
                <Button variant="secondary" onClick={() => setBulkGroupId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {tanksLoading || groupsLoading ? (
        <ListSkeleton rows={4} />
      ) : tanks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <Fish className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No aquariums yet</p>
            <a href="/aquariums/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add your first tank
              </Button>
            </a>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tanks.map((tank) => {
            const group = tank.water_group_id ? groupMap[tank.water_group_id] : null;
            const cleanedDays = daysSince(tank.last_cleaned_at);
            const href = `/aquariums/${tank.slug || tank.id}`;

            return (
              <div key={tank.id} className="relative group">
                <a href={href} className="block">
                  <Card className="hover:border-primary-200 transition cursor-pointer">
                    <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {group && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                            {group.name}
                          </span>
                        )}
                        {tank.temperature != null && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                            {tank.temperature}°C
                          </span>
                        )}
                        {tank.ph != null && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                            pH {tank.ph}
                          </span>
                        )}
                        {tank.last_cleaned_at && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                              (cleanedDays ?? 0) > 30
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            Cleaned {cleanedDays != null ? `${cleanedDays}d ago` : tank.last_cleaned_at}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-800">{tank.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {tank.fish_species || 'No species'}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">{tank.fish_count} fish</p>
                      {tank.notes && (
                        <p className="text-sm text-slate-500 mt-2 truncate max-w-[200px]">
                          {tank.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        aria-label="Edit"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(href);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </Card>
              </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
