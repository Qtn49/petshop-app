import AppLayout from '@/components/layout/AppLayout';

export default function TenantAppShell({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
