import { NextResponse } from 'next/server';

const SQUARE_APP_ID = process.env.SQUARE_APPLICATION_ID;
const SQUARE_REDIRECT = process.env.SQUARE_REDIRECT_URI;
const SQUARE_ENV = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT || 'sandbox';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!SQUARE_APP_ID || !SQUARE_REDIRECT) {
    return NextResponse.json(
      { error: 'Square OAuth not configured' },
      { status: 500 }
    );
  }

  const baseUrl =
    SQUARE_ENV === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

  const params = new URLSearchParams({
    client_id: SQUARE_APP_ID,
    scope: 'MERCHANT_PROFILE_READ ITEM_READ_WRITE INVENTORY_READ_WRITE PURCHASE_ORDER_READ_WRITE',
    session: 'false',
    redirect_uri: SQUARE_REDIRECT,
    state: userId || '',
  });

  return NextResponse.redirect(`${baseUrl}/oauth2/authorize?${params}`);
}
