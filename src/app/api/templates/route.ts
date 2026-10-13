import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { isLegacyLocalUploadUrl } from '@/types';
import { normalizeDraft, normalizeStoredMedia, PublishingError } from '@/lib/template-publishing';

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { campaigns: true } }, publishedRevision: { select: { id: true, author: true, createdAt: true } } },
    });

    return NextResponse.json({ success: true, data: templates.map(template => ({ ...template, layoutJson: normalizeStoredMedia(template.layoutJson) })) });
  } catch (error) {
    console.error('Templates GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, layoutJson, thumbnail } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const normalizedLayout = normalizeDraft(layoutJson);

    const normalizedThumbnail =
      typeof thumbnail === 'string' && !isLegacyLocalUploadUrl(thumbnail)
        ? thumbnail
        : null;

    const template = await prisma.template.create({
      data: {
        name,
        layoutJson: normalizedLayout,
        status: 'draft',
        thumbnail: normalizedThumbnail,
      },
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    if (error instanceof PublishingError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error('Templates POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
