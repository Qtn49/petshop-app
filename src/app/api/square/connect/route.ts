import { NextResponse } from 'next/server';
import { generateSquareOAuthUrl, generateSecureState, isSquareOAuthConfigured } from '@/lib/integrations/square/squareOAuth';

const STATE_COOKIE = 'square_oauth_state';
const USER_COOKIE = 'square_oauth_user_id';
const COOKIE_MAX_AGE = 600; // 10 minutes

/**
 * Start Square OAuth: generate secure state, store in session (cookies), redirect to Square.
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
    const state = generateSecureState();
    const url = generateSquareOAuthUrl(state);

    const res = NextResponse.redirect(url);
    res.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    res.cookies.set(USER_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start Square connect' },
      { status: 500 }
    );
  }
}
