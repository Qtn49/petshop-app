'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import CalculatorButton from '@/components/calculator/CalculatorButton';
import FloatingCalculator from '@/components/calculator/FloatingCalculator';
import ChatbotButton from '@/components/chatbot/ChatbotButton';
import SquareNotConnectedPopup from '@/components/SquareNotConnectedPopup';
import { useSidebar } from '@/contexts/SidebarContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

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
    <div className="min-h-screen flex bg-warm-50">
      <div className={`hidden lg:block flex-shrink-0 ${isCollapsed ? 'w-[72px]' : 'w-64'}`} aria-hidden="true" />

      <Sidebar />

      <main className="flex-1 overflow-auto pb-20 lg:pb-0 min-h-screen">
        <div className="lg:hidden p-4 border-b border-amber-100/80 bg-white/90 backdrop-blur-sm shadow-warm-sm">
          <a href="/dashboard" className="font-bold text-primary-600 flex items-center gap-2">
            <span className="text-lg">🐾</span>
            Pet Shop Manager
          </a>
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
