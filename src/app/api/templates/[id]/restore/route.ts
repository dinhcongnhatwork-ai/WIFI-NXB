import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { expectedVersion, PublishingError, restoreRevision } from '@/lib/template-publishing';

async function handlePOST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authenticateRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const version = expectedVersion(body.expectedVersion);
    if (typeof body.revisionId !== 'string' || !body.revisionId) throw new PublishingError(400, 'revisionId is required');
    const data = await restoreRevision(prisma, params.id, body.revisionId, version);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PublishingError) return NextResponse.json({ success: false, error: error.message, details: error.details }, { status: error.status });
    console.error('Template action failed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withPermission('operate', handlePOST);
