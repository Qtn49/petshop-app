'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Link2, FileUp, Fish, Settings } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/suppliers', label: 'Saved Links', icon: Link2 },
  { href: '/invoices', label: 'Invoices', icon: FileUp },
  { href: '/aquariums', label: 'Aquariums', icon: Fish },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-pb z-40">
      <div className="flex justify-around items-center py-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition ${
              pathname === href ? 'text-primary-600' : 'text-slate-500'
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs">{label}</span>
          </Link>
        ))}
        <div className="w-px h-8 bg-slate-200" />
        <Link
          href="/settings"
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition ${
            pathname === '/settings' ? 'text-primary-600' : 'text-slate-500'
          }`}
        >
          <Settings className="w-6 h-6" />
          <span className="text-xs">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
