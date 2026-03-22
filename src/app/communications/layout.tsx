import AppLayout from '@/components/layout/AppLayout';

export default function CommunicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
