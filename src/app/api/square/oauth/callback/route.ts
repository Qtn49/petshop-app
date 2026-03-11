import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/integrations/square/squareOAuth';
import { saveConnection } from '@/lib/integrations/square/squareService';

const SETTINGS_PATH = '/settings';
const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  '';

function redirect(path: string, params?: Record<string, string>) {
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

  // User cancelled or Square returned an error
  if (errorParam) {
    const description = searchParams.get('error_description') || 'Authorization was denied or cancelled.';
    return redirect(SETTINGS_PATH, {
      square_error: 'auth_failed',
      square_error_description: description,
    });
  }

  if (!code || !state) {
    return redirect(SETTINGS_PATH, {
      square_error: 'invalid_callback',
      square_error_description: 'Missing code or state.',
    });
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await saveConnection(state, tokens);
    return redirect(SETTINGS_PATH, { square_connected: '1' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Square';
    return redirect(SETTINGS_PATH, {
      square_error: 'token_exchange',
      square_error_description: message,
    });
  }
}
