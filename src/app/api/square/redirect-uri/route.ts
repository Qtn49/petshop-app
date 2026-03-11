import { NextResponse } from 'next/server';

/**
 * GET /api/square/redirect-uri
 * Returns the redirect_uri this app would send to Square (from env or request).
 * Use this exact value in Square Developer Dashboard > Your App > OAuth > Redirect URL.
 */
export async function GET(request: Request) {
  const envRedirect = process.env.SQUARE_REDIRECT_URI?.trim();
  let redirectUri: string;
  if (envRedirect) {
    redirectUri = envRedirect.replace(/\/+$/, '');
  } else {
    const proto = request.headers.get('x-forwarded-proto') || request.headers.get('x-forwarded-protocol');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const requestUrl = new URL(request.url);
    let origin: string;
    if (proto && host) {
      const scheme = proto === 'https' || proto === 'https,' ? 'https' : 'http';
      origin = `${scheme}://${host.split(',')[0].trim()}`;
    } else {
      origin = requestUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }
    redirectUri = `${origin.replace(/\/+$/, '')}/api/square/callback`;
  }
  return NextResponse.json({
    redirectUri,
    hint: 'Add this exact URL in Square Developer Dashboard (OAuth redirect URL). No trailing slash.',
  });
}
