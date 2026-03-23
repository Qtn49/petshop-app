'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageOpen, X, AlertTriangle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useTenantHref } from '@/hooks/useTenantHref';
import { useNotifications } from '@/hooks/use-notifications';
import Link from 'next/link';

type RestockItem = {
  variationId: string;
  itemName: string;
  currentQty: number;
  minQty: number;
};

type RestockData = {
  items: RestockItem[];
  autoCheckEnabled: boolean;
  squareConnected: boolean;
};

type Props = {
  userId?: string;
};

export default function RestockSuggestionsPopup({ userId }: Props) {
  const tenantHref = useTenantHref();
  const { createNotification } = useNotifications(userId);
  const dismissKey = userId ? `petshop_restock_dismissed_${userId}` : null;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!dismissKey) return;
    try {
      const dismissedUntil = sessionStorage.getItem(dismissKey);
      if (!dismissedUntil || Date.now() > parseInt(dismissedUntil)) {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const { data } = useQuery<RestockData>({
    queryKey: ['restock-suggestions', userId],
    queryFn: async () => {
      if (!userId) return { items: [], autoCheckEnabled: false, squareConnected: false };
      const res = await fetch(`/api/square/inventory/restock-suggestions?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return { items: [], autoCheckEnabled: false, squareConnected: false };
      return res.json();
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const handleDismiss = () => {
    if (!data) return;
    const items = data.items ?? [];
    const title = items.length > 0
      ? `Restock needed: ${items.length} item${items.length !== 1 ? 's' : ''} below minimum`
      : 'Stock check: all levels are healthy';
    const type = items.length > 0 ? 'restock_alert' : 'restock_ok';
    if (userId) {
      createNotification.mutate({ userId, title, type });
    }
    try {
      if (dismissKey) {
        sessionStorage.setItem(dismissKey, String(Date.now() + 8 * 60 * 60 * 1000));
      }
    } catch { /* ignore */ }
    setDismissed(true);
  };

  const shouldShow =
    !dismissed &&
    data?.autoCheckEnabled === true &&
    data?.squareConnected === true;

  if (!shouldShow) return null;

  const items = data!.items ?? [];
  const allClear = items.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-100 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 ${allClear ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              {allClear
                ? <CheckCircle2 className="w-5 h-5 text-white" />
                : <PackageOpen className="w-5 h-5 text-white" />
              }
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">
                {allClear ? 'Stock Check' : 'Restock Alert'}
              </h2>
              <p className="text-white/80 text-xs">
                {allClear
                  ? 'All stock levels are healthy'
                  : `${items.length} item${items.length !== 1 ? 's' : ''} below minimum stock`
                }
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {allClear ? (
          <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-slate-700 font-medium">Everything is well stocked!</p>
            <p className="text-slate-500 text-sm">No items are below their minimum stock threshold.</p>
          </div>
        ) : (
          <div className="px-5 py-4 max-h-72 overflow-y-auto space-y-2">
            {items.map((item) => {
              const pct = Math.min(100, (item.currentQty / item.minQty) * 100);
              return (
                <div key={item.variationId} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.itemName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">
                        {item.currentQty} / {item.minQty}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-3">
          {!allClear && (
            <Link
              href={tenantHref('/inventory')}
              onClick={handleDismiss}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm transition-colors"
            >
              View Inventory
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className={`${allClear ? 'flex-1' : ''} px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors`}
          >
            {allClear ? 'Got it!' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}
