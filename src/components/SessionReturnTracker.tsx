'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { saveLastPath } from '@/lib/sessionReturnPath';

/** Tracks current path so we can return the user there after disconnect/reconnect. Skips /settings so we remember the page before going to settings. */
export default function SessionReturnTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    if (pathname?.includes('/settings')) return;
    const full = pathname + (typeof window !== 'undefined' ? window.location.search : '');
    saveLastPath(full);
  }, [pathname]);
  return null;
}
