'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Link2,
  FileUp,
  Fish,
  CalendarDays,
  CheckSquare,
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
  { href: '/invoices', label: 'Invoices', icon: FileUp },
  { href: '/aquariums', label: 'Aquariums', icon: Fish },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { isCollapsed, toggle } = useSidebar();

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-30 flex flex-col bg-white border-r border-slate-200 transition-all duration-200 hidden lg:flex ${
        isCollapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      <div className={`p-4 border-b border-slate-100 flex items-center gap-2 flex-shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <Link href="/dashboard" className="font-bold text-xl text-primary-600 truncate">
          {isCollapsed ? 'PS' : 'Pet Shop'}
        </Link>
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 flex-shrink-0"
          aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {isCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={isCollapsed ? label : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
              pathname === href
                ? 'bg-primary-50 text-primary-700'
                : 'text-slate-600 hover:bg-slate-50'
            } ${isCollapsed ? 'justify-center' : ''}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span>{label}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 flex-shrink-0 space-y-1">
        <Link
          href="/settings"
          title={isCollapsed ? 'Settings' : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
            pathname === '/settings'
              ? 'bg-primary-50 text-primary-700'
              : 'text-slate-600 hover:bg-slate-50'
          } ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </Link>
        <button
          onClick={logout}
          title="Log off"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 w-full transition ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span>Log off</span>}
        </button>
      </div>
    </aside>
  );
}
