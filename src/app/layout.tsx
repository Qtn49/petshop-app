import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { CalculatorProvider } from '@/contexts/CalculatorContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import QueryProvider from '@/lib/query-provider';
import SessionReturnTracker from '@/components/SessionReturnTracker';
import PageLoader from '@/components/ui/PageLoader';

export const metadata: Metadata = {
  title: 'Pet Shop Manager',
  description: 'Pet Shop Management SaaS',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <PageLoader />
        <Suspense fallback={null}>
          <QueryProvider>
          <AuthProvider>
            <SidebarProvider>
              <CalculatorProvider>
                <SessionReturnTracker />
                {children}
              </CalculatorProvider>
            </SidebarProvider>
          </AuthProvider>
        </QueryProvider>
        </Suspense>
      </body>
    </html>
  );
}
