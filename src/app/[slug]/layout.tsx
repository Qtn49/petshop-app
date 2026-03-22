import { notFound } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-server';
import { OrganizationProvider } from '@/contexts/OrganizationContext';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const slug = params.slug?.toLowerCase();
  const supabase = getSupabaseClient();
  const { data: org } = await supabase
    .from('organization')
    .select('id, company_name, slug, currency')
    .eq('slug', slug)
    .maybeSingle();

  if (!org?.id || !org.slug) {
    notFound();
  }

  return (
    <OrganizationProvider
      organization={{
        id: org.id,
        company_name: org.company_name ?? '',
        slug: org.slug,
        currency: org.currency,
      }}
    >
      {children}
    </OrganizationProvider>
  );
}
