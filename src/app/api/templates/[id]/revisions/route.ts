export const dynamic = 'force-dynamic';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeStoredMedia } from '@/lib/template-publishing';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

async function handleGET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    if (!await prisma.template.findUnique({ where: { id: params.id }, select: { id: true } })) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
    const data = await prisma.templateRevision.findMany({ where: { templateId: params.id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, data: data.map(revision => ({ ...revision, layoutJson: normalizeStoredMedia(revision.layoutJson) })) });
  } catch (error) {
    console.error('Revision list failed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withPermission('read', handleGET);
