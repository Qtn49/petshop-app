'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { switchUserSession } from '@/lib/auth/client-auth';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import CalculatorButton from '@/components/calculator/CalculatorButton';
import FloatingCalculator from '@/components/calculator/FloatingCalculator';
import ChatbotButton from '@/components/chatbot/ChatbotButton';
import SquareNotConnectedPopup from '@/components/SquareNotConnectedPopup';
import NotificationBell from '@/components/layout/NotificationBell';
import { useSidebar } from '@/contexts/SidebarContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const org = useOrganization();
  const slug = org.slug ?? '';

  useEffect(() => {
    if (!isLoading && !user && slug) {
      const q = new URLSearchParams();
      q.set('returnUrl', typeof window !== 'undefined' ? window.location.pathname : `/${slug}/dashboard`);
      router.replace(`/${slug}/select-user?${q.toString()}`);
    }
  }, [user, isLoading, router, slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-warm-50">
      <div className={`hidden lg:block flex-shrink-0 ${isCollapsed ? 'w-[72px]' : 'w-64'}`} aria-hidden="true" />

      <Sidebar />

      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <div className="lg:hidden p-4 border-b border-amber-100/80 bg-white/90 backdrop-blur-sm shadow-warm-sm flex items-center justify-between gap-2">
          <a href={`/${slug}/dashboard`} className="font-bold text-primary-600 flex items-center gap-2 min-w-0">
            <span className="text-lg">🐾</span>
            Pet Shop Manager
          </a>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />
            <button
              type="button"
              onClick={() => void switchUserSession(slug)}
              className="text-xs font-medium text-amber-800/80 hover:text-primary-600 whitespace-nowrap px-2 py-1 rounded-lg hover:bg-amber-50"
            >
              Log off
            </button>
          </div>
        </div>
        <div className="hidden lg:flex items-center justify-end gap-2 px-6 py-3 border-b border-amber-100/80 bg-warm-50/90 sticky top-0 z-20">
          <NotificationBell />
        </div>
        <div className="p-4 md:p-6 lg:p-8 h-full text-stone-800">{children}</div>
      </main>

      <MobileNav />
      <ChatbotButton />
      <CalculatorButton />
      <FloatingCalculator />
      <SquareNotConnectedPopup />
    </div>
  );
}
