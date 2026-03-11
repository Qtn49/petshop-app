import { NextResponse } from 'next/server';
import { getConnectionStatus } from '@/lib/integrations/square/squareService';

/**
 * GET /api/square/status?userId=xxx
 * Returns { connected: boolean } — quick check if Square is connected for the user.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    );
  }

  try {
    const status = await getConnectionStatus(userId);
    return NextResponse.json({ connected: status.connected });
  } catch (err) {
    return NextResponse.json(
      { connected: false, error: err instanceof Error ? err.message : 'Failed to check' },
      { status: 500 }
    );
  }
}
