'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/use-notifications';

export default function NotificationBell() {
  const { user } = useAuth();
  const userId = user?.id;
  const { notifications, isLoading, markAsRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read);
  const unreadCount = unread.length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl text-stone-600 hover:bg-amber-100/80 hover:text-primary-800 transition-colors"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,24rem)] overflow-hidden rounded-2xl border border-amber-100/90 bg-white shadow-warm z-50 flex flex-col"
          role="dialog"
        >
          <div className="px-4 py-3 border-b border-amber-50/90 flex items-center justify-between bg-warm-50/50">
            <span className="font-semibold text-stone-800 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-primary-700 bg-primary-100 px-2 py-0.5 rounded-full">{unreadCount} new</span>
            )}
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {isLoading ? (
              <p className="text-stone-500 text-sm py-6 text-center">Loading…</p>
            ) : unread.length === 0 ? (
              <p className="text-stone-500 text-sm py-8 text-center px-4">All caught up!</p>
            ) : (
              <ul className="space-y-1">
                {unread.slice(0, 20).map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-2 p-3 rounded-xl border border-primary-100/80 bg-primary-50/20"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-800 text-sm">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => markAsRead.mutate(n.id)}
                      className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-600 shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
