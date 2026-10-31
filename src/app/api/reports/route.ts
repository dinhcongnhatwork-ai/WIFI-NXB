export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;
    const campaignFilter = searchParams.get('campaignId') || undefined;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (fromParam) {
      const parsedFrom = new Date(fromParam);
      if (!isNaN(parsedFrom.getTime())) {
        startDate = parsedFrom;
      } else {
        startDate = new Date(now.getTime() - days * 86400000);
      }
    } else {
      startDate = new Date(now.getTime() - days * 86400000);
    }

    if (toParam) {
      const parsedTo = new Date(toParam);
      if (!isNaN(parsedTo.getTime())) {
        endDate = parsedTo;
      }
    }

    // Set time boundaries
    startDate.setHours(0, 0, 0, 0);

    const [
      campaigns,
      meetings,
      logsInRange,
      allLogsCount,
      wifiUsersCount,
      targets,
    ] = await Promise.all([
      prisma.campaign.findMany({
        where: campaignFilter ? { id: campaignFilter } : undefined,
        include: {
          template: { select: { id: true, name: true } },
          _count: { select: { logs: true, attendanceSessions: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.attendanceSession.findMany({
        where: campaignFilter ? { campaignId: campaignFilter } : undefined,
        take: 100,
        include: {
          campaign: { select: { id: true, name: true, ssid: true } },
          registrations: {
            select: {
              id: true,
              displayName: true,
              status: true,
              totalPresentSeconds: true,
              totalAbsentSeconds: true,
            },
          },
          _count: { select: { registrations: true, logs: true } },
        },
        orderBy: { startTime: 'desc' },
      }),
      prisma.log.findMany({
        where: {
          loginTime: { gte: startDate, lte: endDate },
          ...(campaignFilter ? { campaignId: campaignFilter } : {}),
        },
        include: {
          campaign: { select: { id: true, name: true, ssid: true } },
        },
        orderBy: { loginTime: 'asc' },
      }),
      prisma.log.count(),
      prisma.wifiUser.count(),
      prisma.monitoringTarget.findMany({
        where: { kind: { in: ['ap', 'router', 'controller'] } },
        select: { id: true, name: true, kind: true, status: true, metadata: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    // 1. Group daily stats across date window
    const durationDays = Math.max(1, Math.min(90, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000)));
    const dailyMap = new Map<string, { date: string; label: string; logins: number; uniqueMacs: Set<string> }>();
    
    for (let i = durationDays - 1; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
      dailyMap.set(dateKey, { date: dateKey, label: dayLabel, logins: 0, uniqueMacs: new Set() });
    }

    // 2. Hourly stats (0-23h)
    const hourlyDistribution = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h.toString().padStart(2, '0')}:00`,
      logins: 0,
    }));

    // 3. Campaign visits aggregation
    const campaignVisitsMap = new Map<string, { visits: number; uniqueMacs: Set<string> }>();
    const ssidVisitsMap = new Map<string, number>();

    for (const log of logsInRange) {
      const dateKey = log.loginTime.toISOString().slice(0, 10);
      const hour = log.loginTime.getHours();

      // Daily
      const dayEntry = dailyMap.get(dateKey);
      if (dayEntry) {
        dayEntry.logins++;
        dayEntry.uniqueMacs.add(log.mac);
      }

      // Hourly
      if (hour >= 0 && hour < 24) {
        hourlyDistribution[hour].logins++;
      }

      // Campaign visits
      if (log.campaignId) {
        const cEntry = campaignVisitsMap.get(log.campaignId) || { visits: 0, uniqueMacs: new Set() };
        cEntry.visits++;
        cEntry.uniqueMacs.add(log.mac);
        campaignVisitsMap.set(log.campaignId, cEntry);
      }

      // SSID visits
      const ssidName = log.campaign?.ssid || 'WIFI MARKETING';
      ssidVisitsMap.set(ssidName, (ssidVisitsMap.get(ssidName) || 0) + 1);
    }

    const dailyGrowth = Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      label: d.label,
      logins: d.logins,
      uniqueUsers: d.uniqueMacs.size,
    }));

    // Top campaigns performance
    const campaignPerformance = campaigns.map((c) => {
      const metrics = campaignVisitsMap.get(c.id) || { visits: 0, uniqueMacs: new Set() };
      const uniqueCount = metrics.uniqueMacs.size;
      const conversionRate = metrics.visits > 0 ? Math.round((uniqueCount / metrics.visits) * 100) : 0;
      return {
        id: c.id,
        name: c.name,
        ssid: c.ssid,
        active: c.active,
        visits: metrics.visits,
        uniqueUsers: uniqueCount,
        conversionRate,
        meetingSessionsCount: c._count.attendanceSessions,
        templateName: c.template?.name || 'Mặc định',
      };
    }).sort((a, b) => b.visits - a.visits);

    // SSID breakdown
    const totalSsidVisits = Array.from(ssidVisitsMap.values()).reduce((a, b) => a + b, 0);
    const ssidUsage = Array.from(ssidVisitsMap.entries()).map(([ssid, visits]) => ({
      ssid,
      visits,
      percentage: totalSsidVisits > 0 ? Math.round((visits / totalSsidVisits) * 100) : 0,
    })).sort((a, b) => b.visits - a.visits);

    // Meetings breakdown & KPIs
    const meetingSessions = meetings.map((m) => {
      const regList = m.registrations;
      const totalReg = regList.length;
      const presentCount = regList.filter((r) => r.status?.toUpperCase() === 'PRESENT').length;
      const absentCount = totalReg - presentCount;
      const attendanceRate = totalReg > 0 ? Math.round((presentCount / totalReg) * 100) : 0;

      return {
        id: m.id,
        name: m.name,
        location: m.location || 'Hội trường chính',
        startTime: m.startTime,
        endTime: m.endTime,
        status: m.status,
        campaignName: m.campaign?.name || 'Liên kết hệ thống',
        totalParticipants: totalReg,
        presentCount,
        absentCount,
        attendanceRate,
      };
    });

    const totalParticipantsAll = meetingSessions.reduce((acc, m) => acc + m.totalParticipants, 0);
    const totalPresentAll = meetingSessions.reduce((acc, m) => acc + m.presentCount, 0);
    const avgAttendanceRate = totalParticipantsAll > 0 ? Math.round((totalPresentAll / totalParticipantsAll) * 100) : 0;

    // Top APs & Network load
    const topAPs = targets
      .filter((t) => t.kind === 'ap')
      .map((t) => {
        const meta: any = t.metadata || {};
        return {
          id: t.id,
          name: t.name,
          status: t.status,
          model: meta.model || 'UniFi AP',
          clients: typeof meta.metrics?.['clients.count'] === 'number' ? meta.metrics['clients.count'] : 0,
          rxBytes: meta.metrics?.['rx.bytes_sec'] || 0,
          txBytes: meta.metrics?.['tx.bytes_sec'] || 0,
        };
      })
      .sort((a, b) => b.clients - a.clients);

    const totalLoginsInRange = logsInRange.length;
    const uniqueUsersInRange = new Set(logsInRange.map((l) => l.mac)).size;
    const avgDailyLogins = dailyGrowth.length > 0 ? Math.round(totalLoginsInRange / dailyGrowth.length) : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalCampaigns: campaigns.length,
          activeCampaigns: campaigns.filter((c) => c.active).length,
          totalLogins: totalLoginsInRange,
          avgDailyLogins,
          uniqueVisitors: uniqueUsersInRange,
          allTimeLogins: allLogsCount,
          totalWifiUsers: Math.max(wifiUsersCount, uniqueUsersInRange),
          totalMeetings: meetingSessions.length,
          avgAttendanceRate,
          totalMeetingAttendees: totalParticipantsAll,
          onlineAPs: topAPs.filter((a) => a.status === 'online').length,
          totalAPs: targets.filter((t) => t.kind === 'ap').length,
        },
        charts: {
          dailyGrowth,
          hourlyActivity: hourlyDistribution,
          topCampaigns: campaignPerformance,
          ssidUsage,
          meetingSessions,
          topAPs: topAPs.slice(0, 15),
        },
        recentLogs: logsInRange.slice(-50).reverse().map((l) => ({
          id: l.id,
          mac: l.mac,
          phone: l.phone || null,
          loginTime: l.loginTime.toISOString(),
          campaign: l.campaign ? { id: l.campaign.id, name: l.campaign.name, ssid: l.campaign.ssid } : null,
        })),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Reports API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lỗi truy xuất báo cáo' },
      { status: 500 }
    );
  }
}
