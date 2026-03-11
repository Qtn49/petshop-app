'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Fish, Plus, Loader2, ArrowLeft } from 'lucide-react';

type Tank = {
  id: string;
  name: string;
  fish_species: string | null;
  fish_count: number;
  notes: string | null;
};

type TankEvent = {
  id: string;
  event_date: string;
  deaths: number;
  notes: string | null;
};

export default function TankDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [tank, setTank] = useState<Tank | null>(null);
  const [events, setEvents] = useState<TankEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventDeaths, setEventDeaths] = useState(0);
  const [eventNotes, setEventNotes] = useState('');

  const id = params.id as string;

  useEffect(() => {
    if (!id || !user?.id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [tankRes, eventsRes] = await Promise.all([
          fetch(`/api/tanks/${id}?userId=${user.id}`),
          fetch(`/api/tanks/${id}/events?userId=${user.id}`),
        ]);

        const tankData = await tankRes.json();
        const eventsData = await eventsRes.json();

        if (tankRes.ok) setTank(tankData.tank || tankData);
        if (eventsRes.ok) setEvents(eventsData.events || []);
      } catch {
        setTank(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user?.id]);

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      const res = await fetch(`/api/tanks/${id}/events`, {
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
        setEvents([data, ...events]);
        setShowEventForm(false);
        setEventDeaths(0);
        setEventNotes('');
      }
    } catch {
      const newEvent = {
        id: crypto.randomUUID(),
        event_date: eventDate,
        deaths: eventDeaths,
        notes: eventNotes.trim() || null,
      };
      setEvents([newEvent, ...events]);
      setShowEventForm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
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
    </div>
  );
}
