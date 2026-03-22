import { redirect } from 'next/navigation';

/** `/[slug]` → `/[slug]/dashboard` */
export default function TenantRootPage({ params }: { params: { slug: string } }) {
  const slug = params.slug?.toLowerCase() ?? '';
  redirect(`/${slug}/dashboard`);
}
