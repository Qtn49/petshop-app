import AppLayout from '@/components/layout/AppLayout';

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
