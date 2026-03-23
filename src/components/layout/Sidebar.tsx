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
  PawPrint,
  PanelLeftClose,
  PanelLeft,
  Settings,
  Users,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import { useTenantHref } from '@/hooks/useTenantHref';
import { switchUserSession } from '@/lib/auth/client-auth';

const navPaths = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/tasks', label: 'To-Do List', icon: CheckSquare },
  { path: '/suppliers', label: 'Saved Links', icon: Link2 },
  { path: '/inventory', label: 'Inventory', icon: FileText },
  { path: '/aquariums', label: 'Aquariums', icon: Fish },
  { path: '/animals', label: 'Animals', icon: Heart },
  { path: '/communications', label: 'Communications', icon: MessageSquare },
];

export default function Sidebar() {
  const params = useParams();
  const shopSlug = typeof params.slug === 'string' ? params.slug : '';
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();
  const tenantHref = useTenantHref();

  const isNavActive = (path: string) => {
    const full = tenantHref(path);
    if (path === '/dashboard') {
      return pathname === full || pathname === full + '/';
    }
    return pathname === full || pathname.startsWith(`${full}/`);
  };

  const settingsHref = tenantHref('/settings');

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
          href={tenantHref('/dashboard')}
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
        {navPaths.map(({ path, label, icon: Icon }) => {
          const href = tenantHref(path);
          const active = isNavActive(path);
          return (
            <Link
              key={path}
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
        {shopSlug && (
          <button
            type="button"
            title={isCollapsed ? 'Log off' : undefined}
            onClick={() => void switchUserSession(shopSlug)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-stone-400 hover:bg-sidebar-muted hover:text-amber-100/90 w-full text-left ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <Users className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Log off</span>}
          </button>
        )}
        <Link
          href={settingsHref}
          title={isCollapsed ? 'Settings' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition ${
            pathname === settingsHref || pathname.startsWith(`${settingsHref}/`)
              ? 'bg-amber-600/25 text-amber-100 shadow-[0_0_20px_-4px_rgba(251,191,36,0.35)]'
              : 'text-stone-400 hover:bg-sidebar-muted hover:text-amber-100/90'
          } ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
