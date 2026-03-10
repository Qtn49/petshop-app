import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { CalculatorProvider } from '@/contexts/CalculatorContext';
import { SidebarProvider } from '@/contexts/SidebarContext';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <AuthProvider>
          <SidebarProvider>
            <CalculatorProvider>{children}</CalculatorProvider>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
