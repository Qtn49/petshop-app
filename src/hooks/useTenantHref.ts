'use client';

import { useParams } from 'next/navigation';

/** Path prefix for current tenant, e.g. `/my-shop`. */
export function useTenantPrefix(): string {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  return slug ? `/${slug}` : '';
}

/** Build tenant-scoped href: `p` is `/dashboard` or `dashboard`. */
export function useTenantHref() {
  const prefix = useTenantPrefix();
  return (path: string) => {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${prefix}${p}`;
  };
}
