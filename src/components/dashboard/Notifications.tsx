'use client';

import { memo } from 'react';
import { Bell, Check } from 'lucide-react';

type Notification = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  read: boolean;
};

type Props = {
  notifications: Notification[];
  userId?: string;
} & (
  | { onMarkAsRead: (id: string) => void; onNotificationsChange?: never }
  | { onNotificationsChange: (n: Notification[]) => void; onMarkAsRead?: never }
);

function NotificationsInner(props: Props) {
  const { notifications, userId } = props;

  const markAsRead = async (id: string) => {
    if (props.onMarkAsRead) {
      props.onMarkAsRead(id);
    } else if (props.onNotificationsChange) {
      const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      props.onNotificationsChange(updated);
      if (userId) {
        try {
          await fetch(`/api/notifications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          });
        } catch {}
      }
    }
  };

  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-amber-50/90 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-stone-800 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications
          {unread.length > 0 && (
            <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full">
              {unread.length}
            </span>
          )}
        </h2>
      </div>
      <div className="p-4 flex-1 min-h-0 overflow-auto">
        <ul className="space-y-2">
          {unread.slice(0, 10).map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-primary-100 bg-primary-50/30"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800">{n.title}</p>
                {n.message && (
                  <p className="text-sm text-stone-500 mt-0.5 truncate">{n.message}</p>
                )}
              </div>
              <button
                onClick={() => markAsRead(n.id)}
                className="p-1 rounded hover:bg-primary-100 text-primary-600"
                title="Mark as read"
              >
                <Check className="w-4 h-4" />
              </button>
            </li>
          ))}
          {unread.length === 0 && (
            <p className="text-stone-500 text-sm py-4 text-center">All caught up!</p>
          )}
        </ul>
      </div>
    </div>
  );
}

export default memo(NotificationsInner);
