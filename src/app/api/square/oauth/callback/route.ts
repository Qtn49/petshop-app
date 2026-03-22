import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/integrations/square/squareOAuth';
import { saveConnection } from '@/lib/integrations/square/squareService';
import { getSlugForUserId } from '@/lib/organization-slug';

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  '';

async function redirectToSettings(userId: string, params?: Record<string, string>) {
  const slug = await getSlugForUserId(userId);
  const path = slug ? `/${slug}/settings` : '/settings';
  const url = new URL(path, APP_ORIGIN || 'http://localhost:3000');
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId
  const errorParam = searchParams.get('error');

  if (errorParam) {
    const description = searchParams.get('error_description') || 'Authorization was denied or cancelled.';
    const url = new URL('/settings', APP_ORIGIN || 'http://localhost:3000');
    url.searchParams.set('square_error', 'auth_failed');
    url.searchParams.set('square_error_description', description);
    return NextResponse.redirect(url.toString());
  }

  if (!code || !state) {
    const url = new URL('/settings', APP_ORIGIN || 'http://localhost:3000');
    url.searchParams.set('square_error', 'invalid_callback');
    url.searchParams.set('square_error_description', 'Missing code or state.');
    return NextResponse.redirect(url.toString());
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await saveConnection(state, tokens);
    return redirectToSettings(state, { square_connected: '1' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Square';
    return redirectToSettings(state, {
      square_error: 'token_exchange',
      square_error_description: message,
    });
  }
}
