'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import CalculatorButton from '@/components/calculator/CalculatorButton';
import FloatingCalculator from '@/components/calculator/FloatingCalculator';
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
    <div className="min-h-screen flex bg-slate-50">
      <div className={`hidden lg:block flex-shrink-0 ${isCollapsed ? 'w-[72px]' : 'w-64'}`} aria-hidden="true" />

      <Sidebar />

      <main className="flex-1 overflow-auto pb-20 lg:pb-0 min-h-screen">
        <div className="lg:hidden p-4 border-b bg-white">
          <a href="/dashboard" className="font-bold text-primary-600">
            Pet Shop Manager
          </a>
        </div>
        <div className="p-4 md:p-6 lg:p-8 h-full">{children}</div>
      </main>

      <MobileNav />
      <CalculatorButton />
      <FloatingCalculator />
    </div>
  );
}
