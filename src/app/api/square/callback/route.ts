import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken } from '@/lib/integrations/square/squareOAuth';
import { saveConnection } from '@/lib/integrations/square/squareService';

const SETTINGS_PATH = '/settings';
const STATE_COOKIE = 'square_oauth_state';
const USER_COOKIE = 'square_oauth_user_id';
const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  '';

function redirectToSettings(params?: Record<string, string>) {
  const url = new URL(SETTINGS_PATH, APP_ORIGIN || 'http://localhost:3000');
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return NextResponse.redirect(url.toString());
}

function clearSquareCookies(res: NextResponse) {
  res.cookies.set(STATE_COOKIE, '', { maxAge: 0, path: '/' });
  res.cookies.set(USER_COOKIE, '', { maxAge: 0, path: '/' });
  return res;
}

/**
 * Square OAuth callback. Square redirects here with code and state.
 * Verify state matches session (cookies), exchange code for token, save connection, redirect to Settings.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  const cookieStore = await cookies();
  const sessionState = cookieStore.get(STATE_COOKIE)?.value;
  const userId = cookieStore.get(USER_COOKIE)?.value;

  if (errorParam) {
    const description = searchParams.get('error_description') || 'Authorization was denied or cancelled.';
    const res = redirectToSettings({
      square_error: 'auth_failed',
      square_error_description: description,
    });
    return clearSquareCookies(res);
  }

  if (!code || !state) {
    const res = redirectToSettings({
      square_error: 'invalid_callback',
      square_error_description: 'Missing code or state.',
    });
    return clearSquareCookies(res);
  }

  if (!sessionState || state !== sessionState || !userId) {
    const res = redirectToSettings({
      square_error: 'invalid_state',
      square_error_description: 'Invalid or expired session. Please try connecting again.',
    });
    return clearSquareCookies(res);
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await saveConnection(userId, tokens);
    const res = redirectToSettings({ square_connected: '1' });
    return clearSquareCookies(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Square';
    const res = redirectToSettings({
      square_error: 'token_exchange',
      square_error_description: message,
    });
    return clearSquareCookies(res);
  }
}
