'use client';

import { Bell, Check } from 'lucide-react';

type Notification = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
};

export default function Notifications({
  notifications,
  onNotificationsChange,
  userId,
}: {
  notifications: Notification[];
  onNotificationsChange: (n: Notification[]) => void;
  userId?: string;
}) {
  const markAsRead = async (id: string) => {
    const updated = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    onNotificationsChange(updated);

    if (userId) {
      try {
        await fetch(`/api/notifications/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ read: true }),
        });
      } catch {
        // Silent fail
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {unreadCount > 0 && (
            <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </h2>
      </div>
      <div className="p-4">
        <ul className="space-y-2">
          {notifications.slice(0, 5).map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                n.read ? 'border-slate-100 bg-slate-50/50' : 'border-primary-100 bg-primary-50/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${n.read ? 'text-slate-600' : 'text-slate-800'}`}>
                  {n.title}
                </p>
                {n.message && (
                  <p className="text-sm text-slate-500 mt-0.5 truncate">{n.message}</p>
                )}
              </div>
              {!n.read && (
                <button
                  onClick={() => markAsRead(n.id)}
                  className="p-1 rounded hover:bg-primary-100 text-primary-600"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
          {notifications.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">No notifications</p>
          )}
        </ul>
      </div>
    </div>
  );
}
