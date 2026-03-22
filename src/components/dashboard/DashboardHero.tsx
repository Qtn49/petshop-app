'use client';

import { useEffect, useState } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function DashboardHero({
  greeting,
  clock,
}: {
  greeting: string;
  clock: string;
}) {
  const { company_name, id: orgId, slug } = useOrganization();
  const [tagline, setTagline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = `tagline_${slug ?? orgId}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        setTagline(cached);
        setLoading(false);
        return;
      }
    } catch {
      // ignore
    }

    let cancelled = false;
    setLoading(true);
    fetch('/api/dashboard/tagline', { method: 'POST' })
      .then((r) => r.json())
      .then((d: { tagline?: string }) => {
        if (cancelled) return;
        const t = (d.tagline ?? '').trim() || 'Where every pet leaves happier.';
        setTagline(t);
        try {
          sessionStorage.setItem(key, t);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        if (!cancelled) setTagline('Paws, play, and repeat.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orgId, slug]);

  return (
    <div className="flex-shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-400 to-amber-600 p-3 md:p-4 text-white shadow-warm border border-amber-300/30">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-semibold">
            {greeting} 👋 &nbsp;·&nbsp; {clock}
          </p>
          <div className="shrink-0 text-right">
            {loading ? (
              <div className="h-4 w-36 rounded-md bg-white/25 animate-pulse" aria-hidden />
            ) : (
              <p className="text-xs text-white/90 italic">{tagline}</p>
            )}
          </div>
        </div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white drop-shadow-sm">
          {company_name || 'Your shop'}
        </h2>
      </div>
    </div>
  );
}
