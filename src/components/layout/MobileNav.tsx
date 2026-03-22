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
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/tasks', label: 'To-Do', icon: CheckSquare },
  { href: '/suppliers', label: 'Links', icon: Link2 },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/aquariums', label: 'Aquariums', icon: Fish },
  { href: '/communications', label: 'Comms', icon: MessageSquare },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-muted safe-area-pb z-40 shadow-[0_-4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex justify-around items-center py-2 overflow-x-auto">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition min-w-[3.25rem] ${
              pathname === href
                ? 'text-amber-400 bg-amber-600/20'
                : 'text-stone-500 hover:text-amber-200/90'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] leading-tight text-center">{label}</span>
          </Link>
        ))}
        <div className="w-px h-8 bg-sidebar-muted self-center flex-shrink-0" />
        <Link
          href="/settings"
          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition min-w-[3.25rem] ${
            pathname === '/settings' ? 'text-amber-400 bg-amber-600/20' : 'text-stone-500 hover:text-amber-200/90'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
