export const dynamic = 'force-dynamic';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';
import { normalizeRedirectUrl } from '@/lib/redirect-url';

async function handleGET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ssid: { contains: search, mode: 'insensitive' } },
      ];
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, status: true } },
        _count: { select: { logs: true } },
      },
    });

    return NextResponse.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Campaigns GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handlePOST(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, ssid, templateId, startTime, endTime, active, portalEnabled, redirectUrl, wlanConfId, unifiSite } = body;
    const normalizedRedirectUrl = normalizeRedirectUrl(redirectUrl);
    const hasRedirectInput =
      (typeof redirectUrl === 'string' && redirectUrl.trim().length > 0) ||
      (redirectUrl !== undefined && redirectUrl !== null && typeof redirectUrl !== 'string');

    if (!name || !ssid || !templateId || !startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (hasRedirectInput && !normalizedRedirectUrl) {
      return NextResponse.json(
        { success: false, error: 'Redirect URL không hợp lệ' },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name,
        ssid,
        templateId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        active: active ?? true,
        portalEnabled: portalEnabled ?? false,
        redirectUrl: normalizedRedirectUrl,
        wlanConfId: wlanConfId || null,
        unifiSite: unifiSite || 'default',
      },
      include: { template: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, data: campaign }, { status: 201 });
  } catch (error) {
    console.error('Campaigns POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);

export const POST = withPermission('operate', handlePOST);
