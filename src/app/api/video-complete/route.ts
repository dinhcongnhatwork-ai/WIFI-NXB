import { NextRequest, NextResponse } from 'next/server';
import { setVideoWatched } from '@/lib/redis';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, mac } = await req.json();

    if (!sessionId || !mac) {
      return NextResponse.json(
        { success: false, error: 'sessionId and mac are required' },
        { status: 400 }
      );
    }

    await setVideoWatched(`${sessionId}:${mac}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Video complete error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
