import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth/session-cookie';
import { clearAllAuthCookies } from '@/lib/auth/jwt-session';

export async function POST(request: Request) {
  let slug = '';
  try {
    const b = await request.json();
    slug = typeof (b as { slug?: string })?.slug === 'string' ? (b as { slug: string }).slug.trim().toLowerCase() : '';
  } catch {
    // optional body
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  if (slug) {
    clearAllAuthCookies(res, slug);
  }
  return res;
}
