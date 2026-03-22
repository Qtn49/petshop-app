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
  PawPrint,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/tasks', label: 'To-Do List', icon: CheckSquare },
  { href: '/suppliers', label: 'Saved Links', icon: Link2 },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/aquariums', label: 'Aquariums', icon: Fish },
  { href: '/communications', label: 'Communications', icon: MessageSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { isCollapsed, toggle } = useSidebar();

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-30 flex flex-col bg-sidebar text-stone-300 border-r border-sidebar-muted transition-all duration-200 hidden lg:flex ${
        isCollapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      <div
        className={`p-4 border-b border-sidebar-muted flex items-center gap-2 flex-shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-lg text-amber-400 truncate hover:text-amber-300 transition"
          title={isCollapsed ? 'Pet Shop' : undefined}
        >
          <PawPrint className="w-7 h-7 text-amber-400 flex-shrink-0" aria-hidden />
          {!isCollapsed && <span>Pet Shop</span>}
        </Link>
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-sidebar-muted text-amber-200/80 hover:text-amber-100 flex-shrink-0 transition"
          aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
                active
                  ? 'bg-amber-600/25 text-amber-100 shadow-[0_0_20px_-4px_rgba(251,191,36,0.35)]'
                  : 'text-stone-400 hover:bg-sidebar-muted hover:text-amber-100/90 hover:shadow-[inset_0_0_0_1px_rgba(251,191,36,0.15)]'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-muted flex-shrink-0 space-y-1">
        <Link
          href="/settings"
          title={isCollapsed ? 'Settings' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
            pathname === '/settings'
              ? 'bg-amber-600/25 text-amber-100 shadow-[0_0_20px_-4px_rgba(251,191,36,0.35)]'
              : 'text-stone-400 hover:bg-sidebar-muted hover:text-amber-100/90'
          } ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Settings</span>}
        </Link>
        <button
          onClick={logout}
          title="Log off"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-500 hover:bg-red-950/40 hover:text-red-300 w-full transition ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Log off</span>}
        </button>
      </div>
    </aside>
  );
}
