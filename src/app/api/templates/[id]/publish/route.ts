import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { expectedVersion, PublishingError, publishDraft } from '@/lib/template-publishing';

async function handlePOST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = authenticateRequest(req);
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    let version: number;
    if (body && body.expectedVersion !== undefined && body.expectedVersion !== null) {
      version = expectedVersion(body.expectedVersion);
    } else {
      const cur = await prisma.template.findUnique({ where: { id: params.id }, select: { draftVersion: true } });
      if (!cur) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
      version = cur.draftVersion;
    }

    const data = await publishDraft(prisma, params.id, version, String(user.id || user.username || 'admin'));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PublishingError) return NextResponse.json({ success: false, error: error.message, details: error.details }, { status: error.status });
    console.error('Template action failed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = withPermission('operate', handlePOST);

