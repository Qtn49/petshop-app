import { NextResponse } from 'next/server';
import { disconnect } from '@/lib/integrations/square/squareService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = body?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    await disconnect(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
