import { NextResponse } from 'next/server';
import { getConnectionStatus } from '@/lib/integrations/square/squareService';

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
    return NextResponse.json(status);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get connection status' },
      { status: 500 }
    );
  }
}
