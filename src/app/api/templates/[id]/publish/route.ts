import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { expectedVersion, PublishingError, publishDraft } from '@/lib/template-publishing';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authenticateRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const version = expectedVersion(body.expectedVersion);
    const data = await publishDraft(prisma, params.id, version, String(user.id || user.username || 'admin'));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PublishingError) return NextResponse.json({ success: false, error: error.message, details: error.details }, { status: error.status });
    console.error('Template action failed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
