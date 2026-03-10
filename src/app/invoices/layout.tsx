import AppLayout from '@/components/layout/AppLayout';

export default function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
