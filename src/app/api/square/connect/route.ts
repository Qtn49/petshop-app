import { NextResponse } from 'next/server';
import { generateSquareOAuthUrl, generateSecureState, isSquareOAuthConfigured } from '@/lib/integrations/square/squareOAuth';
import { storeOAuthState } from '@/lib/integrations/square/squareService';

/**
 * Start Square OAuth: generate secure state, store in DB (works across redirects on Vercel), redirect to Square.
 * Call with: GET /api/square/connect?userId=<user_id>
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') ?? '';

  if (!isSquareOAuthConfigured()) {
    return NextResponse.json(
      { error: 'Square OAuth not configured' },
      { status: 500 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    );
  }

  try {
    // redirect_uri must match Square Dashboard exactly (no trailing slash)
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

    const state = generateSecureState();
    await storeOAuthState(state, userId, redirectUri);
    const url = generateSquareOAuthUrl(state, redirectUri);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start Square connect' },
      { status: 500 }
    );
  }
}
