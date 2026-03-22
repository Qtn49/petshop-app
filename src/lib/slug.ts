/**
 * URL slug from display name (matches DB backfill: lowercase, dashes, strip specials).
 */
export function slugFromCompanyName(name: string): string {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return '';
  let s = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s;
}

/** Tank / entity slug from display name (same rules as company slug). */
export const slugFromName = slugFromCompanyName;

/** First-segment paths that cannot be tenant slugs. */
export const RESERVED_SLUGS = new Set([
  'api',
  '_next',
  'static',
  'login',
  'register',
  'onboarding',
  'connect',
  'favicon.ico',
  'apple-touch-icon.png',
  'apple-touch-icon-precomposed.png',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase()) || slug.includes('.');
}

/** First path segment when it is a tenant slug (not `/api`, `/login`, etc.). */
export function tenantSlugFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const seg = pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  const s = seg.toLowerCase();
  if (isReservedSlug(s)) return null;
  return s;
}
