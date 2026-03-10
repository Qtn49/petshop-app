import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

const SQUARE_APP_SECRET = process.env.SQUARE_APPLICATION_SECRET;
const SQUARE_REDIRECT = process.env.SQUARE_REDIRECT_URI;
const SQUARE_ENV = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT || 'sandbox';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // userId

  if (!code || !SQUARE_APP_SECRET || !SQUARE_REDIRECT) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || '/'}/dashboard?square_error=config`
    );
  }

  const baseUrl =
    SQUARE_ENV === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

  const tokenRes = await fetch(`${baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Client ${SQUARE_APP_SECRET}`,
    },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      code,
      grant_type: 'authorization_code',
      redirect_uri: SQUARE_REDIRECT,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || '/'}/dashboard?square_error=token`
    );
  }

  if (state) {
    const supabase = getSupabaseClient();
    await supabase.from('square_connections').upsert(
      {
        user_id: state,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        merchant_id: tokenData.merchant_id,
        expires_at: tokenData.expires_at
          ? new Date(Date.now() + tokenData.expires_at * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL || '/'}/invoices?square_connected=1`
  );
}
