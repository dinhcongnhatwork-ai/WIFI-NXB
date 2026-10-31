export const dynamic = 'force-dynamic';
import { withPermission } from '@/lib/api-access';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

async function handleGET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const [
      templateCount,
      campaignCount,
      userCount,
      recentLogs,
      logsInRange,
      topCampaignsData,
      ssidData,
    ] = await Promise.all([
      prisma.template.count(),
      prisma.campaign.count(),
      prisma.wifiUser.count(),
      prisma.log.findMany({
        take: 20,
        orderBy: { loginTime: 'desc' },
        include: {
          campaign: { select: { name: true, ssid: true } },
        },
      }),
      prisma.log.findMany({
        where: { loginTime: { gte: startDate } },
        select: { loginTime: true, campaignId: true, mac: true },
        orderBy: { loginTime: 'asc' },
      }),
      prisma.campaign.findMany({
        select: { id: true, name: true, ssid: true, active: true },
      }),
      prisma.campaign.findMany({
        select: { ssid: true },
      }),
    ]);

    const activeCampaigns = await prisma.campaign.count({
      where: {
        active: true,
        startTime: { lte: new Date() },
        endTime: { gte: new Date() },
      },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayLogins = await prisma.log.count({
      where: { loginTime: { gte: todayStart } },
    });

    const dateMap = new Map<string, { logins: number; uniqueUsers: Set<string>; newUsers: Set<string> }>();
    const campaignVisits = new Map<string, { name: string; ssid: string; active: boolean; visits: number }>();
    const ssidVisits = new Map<string, number>();
    const hourlyMap = new Map<number, number>();

    const newUserMacs = new Set(
      (await prisma.wifiUser.findMany({
        where: { createdAt: { gte: startDate } },
        select: { mac: true },
      })).map((u) => u.mac)
    );

    for (const log of logsInRange) {
      const dateKey = log.loginTime.toISOString().slice(0, 10);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { logins: 0, uniqueUsers: new Set(), newUsers: new Set() });
      }
      const day = dateMap.get(dateKey)!;
      day.logins++;
      day.uniqueUsers.add(log.mac || '');
      if (newUserMacs.has(log.mac || '')) {
        day.newUsers.add(log.mac || '');
      }

      const hour = log.loginTime.getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);

      if (log.campaignId) {
        const camp = topCampaignsData.find((c) => c.id === log.campaignId);
        if (camp) {
          const existing = campaignVisits.get(camp.id) || {
            name: camp.name,
            ssid: camp.ssid,
            active: camp.active,
            visits: 0,
          };
          existing.visits++;
          campaignVisits.set(camp.id, existing);
        }
        if (camp?.ssid) {
          ssidVisits.set(camp.ssid, (ssidVisits.get(camp.ssid) || 0) + 1);
        }
      }
    }

    const dailyGrowth = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        label: new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        logins: d.logins,
        uniqueUsers: d.uniqueUsers.size,
        newUsers: d.newUsers.size,
      }));

    const topCampaigns = Array.from(campaignVisits.entries())
      .sort((a, b) => b[1].visits - a[1].visits)
      .slice(0, 5)
      .map(([id, c]) => ({ id, name: c.name, ssid: c.ssid, active: c.active, visits: c.visits }));

    const ssidUsage = Array.from(ssidVisits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([ssid, visits]) => ({ ssid, visits }));

    const hourlyLogins = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      logins: hourlyMap.get(hour) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          templates: templateCount,
          campaigns: campaignCount,
          activeCampaigns,
          totalUsers: userCount,
          todayLogins,
        },
        charts: {
          dailyGrowth,
          topCampaigns,
          ssidUsage,
          hourlyLogins,
        },
        recentLogs,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const GET = withPermission('read', handleGET);
