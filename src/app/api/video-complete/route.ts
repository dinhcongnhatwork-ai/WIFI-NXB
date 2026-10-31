import { NextRequest, NextResponse } from 'next/server';
import { setVideoWatched } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { cleanMac, hasPublishedGate, readPortalSessionId, resolvePortalAccess } from '@/lib/attendance/runtime';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const portalSessionId = body.portalSessionId || body.sessionId;
    const signed = readPortalSessionId(portalSessionId);
    const mac = cleanMac(body.mac);
    if (!signed || !mac || signed.mac !== mac) return NextResponse.json({ success: false, error: 'Valid portalSessionId and mac are required' }, { status: 400 });
    const runtime = await resolvePortalAccess(prisma, { mac }, portalSessionId);
    if (!runtime || !hasPublishedGate(runtime.layout, 'video_gate', runtime.device)) return NextResponse.json({ success: false, error: 'No published video for this portal session' }, { status: 400 });
    await setVideoWatched(`${runtime.portalSessionId}:${mac}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Video complete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
