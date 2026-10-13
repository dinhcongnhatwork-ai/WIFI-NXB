import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAttendanceMonitorTick } from '@/lib/attendance/monitor';
import { startAttendanceWorker } from '@/lib/attendance/worker';
import Redis from 'ioredis';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Ensure background worker is running
  startAttendanceWorker(3000);

  let isStreamClosed = false;
  let redisSub: Redis | null = null;
  let pollInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(
            new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          isStreamClosed = true;
        }
      };

      const fetchAndPushData = async () => {
        try {
          const session = await prisma.attendanceSession.findUnique({
            where: { id },
            include: {
              registrations: {
                orderBy: { createdAt: 'desc' },
                include: {
                  intervals: {
                    orderBy: { joinedAt: 'desc' },
                    take: 5,
                  },
                },
              },
              logs: {
                orderBy: { createdAt: 'desc' },
                take: 50,
              },
              unregisteredClients: {
                orderBy: { lastSeenAt: 'desc' },
                take: 30,
              },
            },
          });

          if (!session) return;

          const presentCount = session.registrations.filter((r) => r.status === 'PRESENT').length;
          const temporaryAbsentCount = session.registrations.filter((r) => r.status === 'TEMPORARY_ABSENT').length;
          const alertAbsentCount = session.registrations.filter((r) => r.status === 'ALERT_ABSENT').length;
          const unknownCount = session.registrations.filter((r) => r.status === 'UNKNOWN').length;
          const totalWarnings = session.registrations.reduce((acc, r) => acc + (r.warningCount || 0), 0);

          const payload = {
            sessionId: session.id,
            status: session.status,
            endedAt: session.endedAt?.toISOString() || null,
            warningThresholdMinutes: session.warningThresholdMinutes || 15,
            stats: {
              totalRegistered: session.registrations.length,
              presentCount,
              temporaryAbsentCount,
              alertAbsentCount,
              unknownCount,
              unregisteredCount: session.unregisteredClients.length,
              totalWarnings,
              syncHealth: 'healthy',
              timestamp: new Date().toISOString(),
            },
            registrations: session.registrations.map((r) => ({
              id: r.id,
              displayName: r.displayName,
              identityValue: r.identityValue,
              status: r.status,
              primaryMac: r.primaryMac,
              currentApMac: r.currentApMac,
              currentRssi: r.currentRssi,
              firstSeenAt: r.firstSeenAt?.toISOString() || null,
              lastSeenAt: r.lastSeenAt?.toISOString() || null,
              absentStartedAt: r.absentStartedAt?.toISOString() || null,
              latestInterval: r.intervals[0]
                ? {
                    joinedAt: r.intervals[0].joinedAt.toISOString(),
                    leftAt: r.intervals[0].leftAt?.toISOString() || null,
                    durationSeconds: r.intervals[0].durationSeconds,
                    apMac: r.intervals[0].apMac,
                  }
                : null,
              totalPresentSeconds: r.totalPresentSeconds,
              totalAbsentSeconds: r.totalAbsentSeconds,
              warningCount: r.warningCount,
              consecutiveMissCount: r.consecutiveMissCount,
            })),
            logs: session.logs.map((l) => ({
              id: l.id,
              type: l.type,
              message: l.message,
              details: l.details,
              createdAt: l.createdAt.toISOString(),
            })),
            unregisteredClients: session.unregisteredClients.map((u) => ({
              id: u.id,
              mac: u.mac,
              ip: u.ip,
              apMac: u.apMac,
              signal: u.signal,
              firstSeenAt: u.firstSeenAt.toISOString(),
              lastSeenAt: u.lastSeenAt.toISOString(),
            })),
          };

          sendEvent('attendance_update', payload);
        } catch (err) {
          console.error('[attendance-stream error]:', err);
        }
      };

      // Push fresh data on connect
      await runAttendanceMonitorTick().catch(() => {});
      await fetchAndPushData();

      // Listen to Redis Pub/Sub for immediate updates
      try {
        redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });

        await redisSub.connect().catch(() => {});
        await redisSub.subscribe(`attendance:${id}`);
        redisSub.on('message', async () => {
          await fetchAndPushData();
        });
      } catch {
        // Fallback to interval only
      }

      // Periodic push every 3 seconds to ensure real-time UI display
      pollInterval = setInterval(async () => {
        if (isStreamClosed) {
          if (pollInterval) clearInterval(pollInterval);
          return;
        }
        await fetchAndPushData();
      }, 3000);
    },
    cancel() {
      isStreamClosed = true;
      if (pollInterval) clearInterval(pollInterval);
      if (redisSub) {
        redisSub.disconnect();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
