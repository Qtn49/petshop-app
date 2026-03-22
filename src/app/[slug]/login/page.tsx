import { redirect } from 'next/navigation';

/** Legacy URL — user selection and PIN live at /[slug]/select-user */
export default function TenantLoginRedirect({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/select-user`);
}
