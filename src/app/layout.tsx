import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { CalculatorProvider } from '@/contexts/CalculatorContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import SessionReturnTracker from '@/components/SessionReturnTracker';

export const metadata: Metadata = {
  title: 'Pet Shop Manager',
  description: 'Pet Shop Management SaaS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <AuthProvider>
          <SidebarProvider>
            <CalculatorProvider>
            <SessionReturnTracker />
            {children}
          </CalculatorProvider>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
