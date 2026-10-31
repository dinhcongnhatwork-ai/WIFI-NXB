export const dynamic = 'force-dynamic';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { isLegacyLocalUploadUrl } from '@/types';
import { expectedVersion, normalizeDraft, publishDraft, PublishingError, saveDraft, templateForRead } from '@/lib/template-publishing';

async function handleGET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!authenticateRequest(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const template = await prisma.template.findUnique({
      where: { id: params.id },
      include: { campaigns: true, publishedRevision: true },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: templateForRead(template) });
  } catch (error) {
    console.error('Template GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, layoutJson, status: templateStatus, thumbnail } = body;

    const data: Record<string, unknown> = {};
    const version = body.expectedVersion === undefined ? undefined : expectedVersion(body.expectedVersion);
    if (name !== undefined) data.name = name;
    if (layoutJson !== undefined) {
      data.layoutJson = normalizeDraft(layoutJson);
    }
    if (templateStatus !== undefined) data.status = templateStatus;
    if (thumbnail !== undefined) {
      data.thumbnail =
        typeof thumbnail === 'string' && !isLegacyLocalUploadUrl(thumbnail)
          ? thumbnail
          : null;
    }

    if (templateStatus === 'published') {
      const current = await prisma.template.findUnique({ where: { id: params.id } });
      if (!current) return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 });
      if (name !== undefined || layoutJson !== undefined || thumbnail !== undefined) {
        delete data.status;
        await saveDraft(prisma, params.id, version, data);
      }
      const updated = await prisma.template.findUniqueOrThrow({ where: { id: params.id } });
      const published = await publishDraft(
        prisma,
        params.id,
        updated.draftVersion,
        String(user.id || user.username || 'admin')
      );
      return NextResponse.json({ success: true, data: templateForRead(published) });
    }

    const template = await saveDraft(prisma, params.id, version, data);

    return NextResponse.json({ success: true, data: templateForRead(template) });
  } catch (error) {
    if (error instanceof PublishingError) return NextResponse.json({ success: false, error: error.message, details: error.details }, { status: error.status });
    console.error('Template PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleDELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const references = await prisma.attendanceSession.count({ where: { templateId: params.id } });
    if (references) return NextResponse.json({ success: false, error: 'Mẫu đang được dùng trực tiếp bởi buổi điểm danh. Hãy đổi mẫu hoặc xóa buổi điểm danh trước.' }, { status: 409 });
    await prisma.template.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);

export const PUT = withPermission('operate', handlePUT);

export const DELETE = withPermission('operate', handleDELETE);
