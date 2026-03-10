import AppLayout from '@/components/layout/AppLayout';

export default function AquariumsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
