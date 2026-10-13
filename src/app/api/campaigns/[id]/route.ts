import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { normalizeRedirectUrl } from '@/lib/redirect-url';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        template: true,
        _count: { select: { logs: true } },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Campaign GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, ssid, templateId, startTime, endTime, active, portalEnabled, redirectUrl } = body;
    const normalizedRedirectUrl = normalizeRedirectUrl(redirectUrl);
    const hasRedirectInput =
      redirectUrl !== undefined &&
      ((typeof redirectUrl === 'string' && redirectUrl.trim().length > 0) ||
        (redirectUrl !== null && typeof redirectUrl !== 'string'));

    if (hasRedirectInput && !normalizedRedirectUrl) {
      return NextResponse.json(
        { success: false, error: 'Redirect URL không hợp lệ' },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (ssid !== undefined) data.ssid = ssid;
    if (templateId !== undefined) data.templateId = templateId;
    if (startTime !== undefined) data.startTime = new Date(startTime);
    if (endTime !== undefined) data.endTime = new Date(endTime);
    if (active !== undefined) data.active = active;
    if (portalEnabled !== undefined) data.portalEnabled = portalEnabled;
    if (redirectUrl !== undefined) {
      data.redirectUrl =
        typeof redirectUrl === 'string' && redirectUrl.trim().length > 0
          ? normalizedRedirectUrl
          : null;
    }

    const campaign = await prisma.campaign.update({
      where: { id: params.id },
      data,
      include: { template: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Campaign PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.campaign.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Campaign DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
