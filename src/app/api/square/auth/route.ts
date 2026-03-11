import { NextResponse } from 'next/server';

/**
 * Legacy redirect: /api/square/auth?userId=... → /api/square/connect?userId=...
 * Use /api/square/connect for secure OAuth with state.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') ?? '';
  const url = new URL('/api/square/connect', request.url);
  url.searchParams.set('userId', userId);
  return NextResponse.redirect(url.toString());
}
