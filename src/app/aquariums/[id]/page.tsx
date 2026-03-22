'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineLoader from '@/components/ui/InlineLoader';
import { Fish, Plus, ArrowLeft, Droplets, X } from 'lucide-react';

type WaterGroup = {
  id: string;
  name: string;
};

type Tank = {
  id: string;
  name: string;
  slug: string | null;
  fish_species: string | null;
  fish_count: number;
  notes: string | null;
  water_group_id: string | null;
  temperature: number | null;
  ph: number | null;
  last_cleaned_at: string | null;
};

type TankEvent = {
  id: string;
  event_date: string;
  deaths: number;
  notes: string | null;
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export default function TankDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slugOrId = params.id as string;
  const queryClient = useQueryClient();

  const [showEventForm, setShowEventForm] = useState(false);
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventDeaths, setEventDeaths] = useState(0);
  const [eventNotes, setEventNotes] = useState('');
  const [showParamsModal, setShowParamsModal] = useState(false);
  const [paramsTemp, setParamsTemp] = useState('');
  const [paramsPh, setParamsPh] = useState('');
  const [paramsCleaned, setParamsCleaned] = useState('');

  const { data: tank, isLoading: tankLoading } = useQuery({
    queryKey: ['tank', slugOrId, user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/tanks/${slugOrId}?userId=${user!.id}`);
      if (!res.ok) return null;
      const d = await res.json();
      return d.tank as Tank;
    },
    enabled: !!slugOrId && !!user?.id,
  });

  const { data: events = [], refetch: refetchEvents } = useQuery({
    queryKey: ['tank-events', slugOrId, user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/tanks/${slugOrId}/events?userId=${user!.id}`);
      if (!res.ok) return [];
      const d = await res.json();
      return (d.events ?? []) as TankEvent[];
    },
    enabled: !!slugOrId && !!user?.id && !!tank?.id,
  });

  const { data: waterGroups = [] } = useQuery({
    queryKey: ['water-groups', user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/water-groups?userId=${user!.id}`);
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!user?.id,
  });

  const { data: groupTanks = [] } = useQuery({
    queryKey: ['tanks', user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/tanks?userId=${user!.id}`);
      if (!res.ok) return [];
      const d = await res.json();
      return (d.tanks ?? []) as Tank[];
    },
    enabled: !!user?.id && !!tank?.water_group_id,
  });

  useEffect(() => {
    if (tank) {
      setParamsTemp(tank.temperature != null ? String(tank.temperature) : '');
      setParamsPh(tank.ph != null ? String(tank.ph) : '');
      setParamsCleaned(tank.last_cleaned_at || '');
    }
  }, [tank]);

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/tanks/${slugOrId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          event_date: eventDate,
          deaths: eventDeaths,
          notes: eventNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data) {
        refetchEvents();
        setShowEventForm(false);
        setEventDeaths(0);
        setEventNotes('');
      }
    } catch {
      refetchEvents();
      setShowEventForm(false);
    }
  };

  const updateParams = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !tank?.id) return;

    try {
      const res = await fetch(`/api/tanks/${tank.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          temperature: paramsTemp ? parseFloat(paramsTemp) : null,
          ph: paramsPh ? parseFloat(paramsPh) : null,
          last_cleaned_at: paramsCleaned || null,
        }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['tank', slugOrId, user?.id] });
        setShowParamsModal(false);
      }
    } catch {
      // ignore
    }
  };

  const group = tank?.water_group_id
    ? waterGroups.find((g: WaterGroup) => g.id === tank.water_group_id)
    : null;
  const othersInGroup = tank?.water_group_id
    ? groupTanks.filter((t: Tank) => t.water_group_id === tank.water_group_id && t.id !== tank.id)
    : [];
  const cleanedDays = daysSince(tank?.last_cleaned_at ?? null);

  if (tankLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <InlineLoader label="Loading aquarium..." />
      </div>
    );
  }

  if (!tank) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Tank not found</p>
        <Button className="mt-4" onClick={() => router.push('/aquariums')}>
          Back to Aquariums
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <a
          href="/aquariums"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </a>
        <h1 className="text-2xl font-bold text-slate-800">{tank.name}</h1>
        <p className="text-slate-500 mt-1">
          {tank.fish_species || 'No species'} • {tank.fish_count} fish
        </p>
        {tank.notes && <p className="text-slate-600 mt-2">{tank.notes}</p>}
      </header>

      <Card title="Water Parameters">
        <div className="flex flex-wrap gap-4 mb-4">
          {tank.temperature != null && (
            <div>
              <span className="text-xs text-slate-500">Temperature</span>
              <p className="font-medium text-slate-800">{tank.temperature}°C</p>
            </div>
          )}
          {tank.ph != null && (
            <div>
              <span className="text-xs text-slate-500">pH</span>
              <p className="font-medium text-slate-800">{tank.ph}</p>
            </div>
          )}
          {tank.last_cleaned_at && (
            <div>
              <span className="text-xs text-slate-500">Last cleaned</span>
              <p
                className={`font-medium ${(cleanedDays ?? 0) > 30 ? 'text-red-600' : 'text-slate-800'}`}
              >
                {tank.last_cleaned_at}
                {cleanedDays != null && ` (${cleanedDays} days ago)`}
              </p>
            </div>
          )}
          {tank.temperature == null && tank.ph == null && !tank.last_cleaned_at && (
            <p className="text-slate-500 text-sm">No parameters recorded yet</p>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowParamsModal(true)}>
          Update parameters
        </Button>
      </Card>

      {group && othersInGroup.length > 0 && (
        <Card title={`Water group: ${group.name}`}>
          <p className="text-sm text-slate-600 mb-2">
            These aquariums share the same water system:
          </p>
          <ul className="space-y-1">
            {othersInGroup.map((t: Tank) => (
              <li key={t.id}>
                <a
                  href={`/aquariums/${t.slug || t.id}`}
                  className="text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {t.name}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Tank Events">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowEventForm(!showEventForm)}
          className="mb-4"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Event
        </Button>

        {showEventForm && (
          <form onSubmit={addEvent} className="mb-6 p-4 bg-slate-50 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Deaths</label>
              <input
                type="number"
                min={0}
                value={eventDeaths}
                onChange={(e) => setEventDeaths(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <Button type="submit" size="sm">Save Event</Button>
          </form>
        )}

        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center gap-4 p-3 rounded-lg border border-slate-100"
            >
              <span className="text-slate-600">{ev.event_date}</span>
              {ev.deaths > 0 && (
                <span className="text-red-600 font-medium">{ev.deaths} death(s)</span>
              )}
              {ev.notes && <span className="text-slate-500 flex-1 truncate">{ev.notes}</span>}
            </li>
          ))}
          {events.length === 0 && (
            <p className="text-slate-500 py-4">No events logged yet</p>
          )}
        </ul>
      </Card>

      {showParamsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800">Update parameters</h3>
              <button
                type="button"
                onClick={() => setShowParamsModal(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={updateParams} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={paramsTemp}
                  onChange={(e) => setParamsTemp(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">pH</label>
                <input
                  type="number"
                  step="0.1"
                  value={paramsPh}
                  onChange={(e) => setParamsPh(e.target.value)}
                  placeholder="e.g. 7.0"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Last cleaned
                </label>
                <input
                  type="date"
                  value={paramsCleaned}
                  onChange={(e) => setParamsCleaned(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save</Button>
                <Button type="button" variant="secondary" onClick={() => setShowParamsModal(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
