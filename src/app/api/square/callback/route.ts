import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/integrations/square/squareOAuth';
import { saveConnection, verifyAndConsumeState } from '@/lib/integrations/square/squareService';

const SETTINGS_PATH = '/settings';

/** Build origin for redirect; use http for localhost (never https://localhost). Prefer stored redirectUri so we send user back to the host they started from (e.g. ngrok). */
function getAppOrigin(request: Request, fromRedirectUri?: string | null): string {
  if (fromRedirectUri) {
    try {
      const u = new URL(fromRedirectUri);
      const host = u.hostname.toLowerCase();
      const scheme = host === 'localhost' || host === '127.0.0.1' ? 'http' : u.protocol.replace(':', '');
      return `${scheme}://${u.host}`;
    } catch {
      // fall through
    }
  }
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.hostname;
  const hostname = host.split(':')[0].toLowerCase();
  const proto = request.headers.get('x-forwarded-proto');
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${host.split(',')[0].trim()}`;
  }
  if (proto && host) {
    const scheme = proto === 'https' || proto.startsWith('https') ? 'https' : 'http';
    return `${scheme}://${host.split(',')[0].trim()}`;
  }
  if (url.origin && url.origin !== 'null') {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return `http://${url.host}`;
    return url.origin;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'
  );
}

function redirectToSettings(request: Request, params?: Record<string, string>, fromRedirectUri?: string | null) {
  const origin = getAppOrigin(request, fromRedirectUri);
  const url = new URL(SETTINGS_PATH, origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return NextResponse.redirect(url.toString());
}

/**
 * Square OAuth callback. Square redirects here with code and state.
 * Verify state from DB (survives redirect from Square on Vercel), exchange code, save connection, redirect to Settings.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    const description = searchParams.get('error_description') || 'Authorization was denied or cancelled.';
    return redirectToSettings(request, {
      square_error: 'auth_failed',
      square_error_description: description,
    });
  }

  if (!code || !state) {
    return redirectToSettings(request, {
      square_error: 'invalid_callback',
      square_error_description: 'Missing code or state.',
    });
  }

  const stateResult = await verifyAndConsumeState(state);
  if (!stateResult) {
    return redirectToSettings(request, {
      square_error: 'invalid_state',
      square_error_description: 'Invalid or expired state. Please try connecting again.',
    });
  }

  const { userId, redirectUri } = stateResult;

  try {
    const tokens = await exchangeCodeForToken(code, redirectUri ?? undefined);
    await saveConnection(userId, tokens);
    return redirectToSettings(request, { square_connected: '1' }, redirectUri);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Square';
    return redirectToSettings(request, {
      square_error: 'token_exchange',
      square_error_description: message,
    }, redirectUri);
  }
}
