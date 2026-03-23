'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Link2,
  FileText,
  Fish,
  CalendarDays,
  CheckSquare,
  MessageSquare,
  Heart,
  Settings,
} from 'lucide-react';
import { useTenantHref } from '@/hooks/useTenantHref';

const navPaths = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/tasks', label: 'To-Do', icon: CheckSquare },
  { path: '/suppliers', label: 'Links', icon: Link2 },
  { path: '/inventory', label: 'Inventory', icon: FileText },
  { path: '/aquariums', label: 'Aquariums', icon: Fish },
  { path: '/animals', label: 'Animals', icon: Heart },
  { path: '/communications', label: 'Comms', icon: MessageSquare },
];

export default function MobileNav() {
  const pathname = usePathname();
  const tenantHref = useTenantHref();
  const settingsHref = tenantHref('/settings');

  const isActive = (path: string) => {
    const full = tenantHref(path);
    if (path === '/dashboard') {
      return pathname === full || pathname === full + '/';
    }
    return pathname === full || pathname.startsWith(`${full}/`);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-muted safe-area-pb z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex justify-around items-center py-2 overflow-x-auto">
        {navPaths.map(({ path, label, icon: Icon }) => {
          const href = tenantHref(path);
          return (
            <Link
              key={path}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition min-w-[3.25rem] ${
                isActive(path) ? 'text-amber-400 bg-amber-600/20' : 'text-stone-500 hover:text-amber-200/90'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight text-center">{label}</span>
            </Link>
          );
        })}
        <div className="w-px h-8 bg-sidebar-muted self-center flex-shrink-0" />
        <Link
          href={settingsHref}
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition min-w-[3.25rem] ${
            pathname === settingsHref || pathname.startsWith(`${settingsHref}/`)
              ? 'text-amber-400 bg-amber-600/20'
              : 'text-stone-500 hover:text-amber-200/90'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
