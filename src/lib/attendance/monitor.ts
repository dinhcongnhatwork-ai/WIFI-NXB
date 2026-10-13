import { prisma } from '@/lib/prisma';
import { UnifiClient } from '@/lib/unifi';
import { MikrotikClient } from '@/lib/mikrotik';
import Redis from 'ioredis';
import {
  evaluateRegistrationState,
  CurrentRegistrationState,
  ObservedClient,
} from './state-machine';
import { DEFAULT_WARNING_THRESHOLD_MINUTES } from './constants';

let redisPublisher: Redis | null = null;
function getRedisPublisher(): Redis | null {
  if (!redisPublisher) {
    try {
      redisPublisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      redisPublisher.connect().catch((err) => {
        console.warn('[attendance-monitor] Redis connection warning:', err.message);
      });
    } catch {
      redisPublisher = null;
    }
  }
  return redisPublisher;
}

export async function broadcastSessionUpdate(sessionId: string, payload: any) {
  const pub = getRedisPublisher();
  if (pub) {
    try {
      await pub.publish(`attendance:${sessionId}`, JSON.stringify(payload));
    } catch (e) {
      // Redis error handled gracefully
    }
  }
}

/**
 * Execute one cycle of attendance monitoring across all ACTIVE sessions.
 * Can be triggered via background interval or tick API.
 */
export async function runAttendanceMonitorTick(): Promise<{
  activeSessionsCount: number;
  processedRegistrations: number;
  unregisteredClientsCount: number;
  timestamp: string;
}> {
  const now = new Date();

  // Find all ACTIVE sessions
  const activeSessions = await prisma.attendanceSession.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      registrations: {
        include: {
          intervals: {
            orderBy: { joinedAt: 'asc' },
          },
        },
      },
    },
  });

  if (activeSessions.length === 0) {
    return {
      activeSessionsCount: 0,
      processedRegistrations: 0,
      unregisteredClientsCount: 0,
      timestamp: now.toISOString(),
    };
  }

  // Connect to UniFi Controller
  let unifiClient: UnifiClient | null = null;
  let rawClients: any[] = [];
  let rawDevices: any[] = [];
  let isControllerHealthy = true;

  try {
    unifiClient = new UnifiClient();
    await unifiClient.login();
    [rawClients, rawDevices] = await Promise.all([
      unifiClient.getClients(),
      unifiClient.getDevices().catch(() => []),
    ]);
  } catch (err) {
    console.error('[attendance-monitor] UniFi Controller fetch error:', err);
    isControllerHealthy = false;
  }

  let totalProcessedRegistrations = 0;
  let totalUnregistered = 0;

  for (const session of activeSessions) {
    const targetApMacs = Array.isArray(session.targetApMacs)
      ? (session.targetApMacs as string[]).map((m) => m.toLowerCase().trim())
      : [];
    const targetSsid = session.ssid.trim();
    const warningThreshold = session.warningThresholdMinutes || DEFAULT_WARNING_THRESHOLD_MINUTES;

    // Check if target APs are online on UniFi
    let isSessionApHealthy = isControllerHealthy;
    if (isControllerHealthy && targetApMacs.length > 0 && rawDevices.length > 0) {
      const onlineApMacs = new Set(
        rawDevices
          .filter((d) => d.status === 'online' || d.state === 1 || d.isConnected === true)
          .map((d) => (d.mac || '').toLowerCase().trim())
      );
      const anyTargetApOnline = targetApMacs.some((mac) => onlineApMacs.has(mac));
      if (!anyTargetApOnline) {
        isSessionApHealthy = false;
      }
    }

    // Filter raw clients observed on this session's APs
    const clientsOnTargetAps: ObservedClient[] = [];
    const clientMapByMac = new Map<string, ObservedClient>();

    for (const c of rawClients) {
      const cMac = (c.mac || '').toLowerCase().trim();
      const cAp = (c.apMac || c.ap_mac || '').toLowerCase().trim();
      const cSsid = (c.ssid || c.essid || '').trim();

      const item: ObservedClient = {
        mac: cMac,
        ip: c.ip || c.ipAddress,
        apMac: cAp,
        apName: c.apName || c.ap_name,
        ssid: cSsid,
        rssi: c.signal || c.rssi,
      };

      clientMapByMac.set(cMac, item);

      // Is on target AP & SSID
      if (
        cMac &&
        (targetApMacs.length === 0 || targetApMacs.includes(cAp)) &&
        (!targetSsid || cSsid.toLowerCase() === targetSsid.toLowerCase())
      ) {
        clientsOnTargetAps.push(item);
      }
    }

    const registeredMacSet = new Set<string>();

    // Process each registered attendee in this session
    for (const reg of session.registrations) {
      totalProcessedRegistrations++;
      const normPrimaryMac = reg.primaryMac.toLowerCase().trim();
      registeredMacSet.add(normPrimaryMac);

      const observed = clientMapByMac.get(normPrimaryMac);

      const currentState: CurrentRegistrationState = {
        id: reg.id,
        primaryMac: reg.primaryMac,
        displayName: reg.displayName,
        identityValue: reg.identityValue,
        status: reg.status as any,
        currentApMac: reg.currentApMac,
        lastSeenAt: reg.lastSeenAt,
        absentStartedAt: reg.absentStartedAt,
        consecutiveMissCount: reg.consecutiveMissCount,
        totalPresentSeconds: reg.totalPresentSeconds,
        totalAbsentSeconds: reg.totalAbsentSeconds,
        totalUnknownSeconds: reg.totalUnknownSeconds,
        warningCount: reg.warningCount,
      };

      const result = evaluateRegistrationState(
        currentState,
        observed,
        targetApMacs,
        targetSsid,
        now,
        warningThreshold,
        isSessionApHealthy
      );

      // Handle Intervals first
      let updatedIntervals = [...reg.intervals];
      let openInterval = reg.intervals.find((i) => !i.leftAt);

      if (result.shouldCloseInterval && openInterval) {
        const duration = Math.max(
          1,
          Math.floor(
            (result.shouldCloseInterval.leftAt.getTime() - new Date(openInterval.joinedAt).getTime()) / 1000
          )
        );
        const closed = await prisma.attendanceInterval.update({
          where: { id: openInterval.id },
          data: {
            leftAt: result.shouldCloseInterval.leftAt,
            durationSeconds: duration,
          },
        });
        updatedIntervals = updatedIntervals.map((i) => (i.id === openInterval!.id ? closed : i));
        openInterval = undefined;
      }

      if (result.shouldOpenInterval) {
        if (!openInterval) {
          const created = await prisma.attendanceInterval.create({
            data: {
              registrationId: reg.id,
              apMac: result.shouldOpenInterval.apMac,
              joinedAt: result.shouldOpenInterval.joinedAt,
              status: result.shouldOpenInterval.status,
            },
          });
          updatedIntervals.push(created);
          openInterval = created;
        }
      }

      // Calculate exact totalPresentSeconds deterministically
      let exactPresentSeconds = 0;
      for (const intv of updatedIntervals) {
        if (intv.leftAt) {
          exactPresentSeconds +=
            intv.durationSeconds ??
            Math.max(
              0,
              Math.floor(
                (new Date(intv.leftAt).getTime() - new Date(intv.joinedAt).getTime()) / 1000
              )
            );
        } else if (result.newStatus === 'PRESENT') {
          const ongoing = Math.max(
            0,
            Math.floor((now.getTime() - new Date(intv.joinedAt).getTime()) / 1000)
          );
          exactPresentSeconds += ongoing;
        }
      }

      // Calculate exact totalAbsentSeconds deterministically
      const effectiveFirstSeen = reg.firstSeenAt || (result.newStatus === 'PRESENT' ? now : null);
      let exactAbsentSeconds = 0;
      if (effectiveFirstSeen) {
        const totalElapsed = Math.max(
          0,
          Math.floor((now.getTime() - new Date(effectiveFirstSeen).getTime()) / 1000)
        );
        exactAbsentSeconds = Math.max(0, totalElapsed - exactPresentSeconds);
      }

      // Perform DB updates with exact second counts
      await prisma.attendanceRegistration.update({
        where: { id: reg.id },
        data: {
          status: result.newStatus,
          currentApMac: result.currentApMac,
          firstSeenAt: reg.firstSeenAt || (result.newStatus === 'PRESENT' ? now : null),
          lastSeenAt: result.lastSeenAt,
          absentStartedAt: result.absentStartedAt,
          consecutiveMissCount: result.consecutiveMissCount,
          totalPresentSeconds: exactPresentSeconds,
          totalAbsentSeconds: exactAbsentSeconds,
          totalUnknownSeconds: 0,
          warningCount: result.newWarningCount,
          currentRssi: observed?.rssi || reg.currentRssi,
        },
      });

      // Record logs
      for (const event of result.logEvents) {
        await prisma.attendanceLog.create({
          data: {
            sessionId: session.id,
            registrationId: reg.id,
            type: event.type,
            message: event.message,
            details: event.details || {},
            createdAt: now,
          },
        });
      }

      // MikroTik Integration: Automatically remove DHCP IP Lease when user disconnects / leaves room
      if (result.isNewlyDisconnected) {
        try {
          const mikrotikClient = new MikrotikClient();
          const removeResult = await mikrotikClient.removeDhcpLeaseByMac(reg.primaryMac);
          await mikrotikClient.removeAllHotspotActiveByMac(reg.primaryMac).catch(() => {});

          await prisma.attendanceLog.create({
            data: {
              sessionId: session.id,
              registrationId: reg.id,
              type: 'SYSTEM_SYNC',
              message:
                removeResult.removedCount > 0
                  ? `Đã thu hồi ${removeResult.removedCount} IP DHCP trên MikroTik cho thiết bị ${reg.displayName} (${reg.primaryMac}).`
                  : `Hệ thống MikroTik xác nhận đã giải phóng IP DHCP cho thiết bị ${reg.displayName} (${reg.primaryMac}).`,
              details: {
                mac: reg.primaryMac,
                action: 'REMOVE_DHCP_LEASE',
                removedCount: removeResult.removedCount,
              },
              createdAt: now,
            },
          });
        } catch (mkErr: any) {
          console.warn(`[attendance-monitor] MikroTik DHCP removal error for ${reg.primaryMac}:`, mkErr.message);
        }
      }
    }

    // Process Unregistered Clients detected on target APs
    for (const client of clientsOnTargetAps) {
      if (!registeredMacSet.has(client.mac)) {
        totalUnregistered++;
        await prisma.attendanceUnregisteredClient.upsert({
          where: {
            sessionId_mac: {
              sessionId: session.id,
              mac: client.mac,
            },
          },
          update: {
            ip: client.ip || undefined,
            apMac: client.apMac || undefined,
            signal: client.rssi || undefined,
            lastSeenAt: now,
          },
          create: {
            sessionId: session.id,
            mac: client.mac,
            ip: client.ip,
            apMac: client.apMac,
            signal: client.rssi,
            firstSeenAt: now,
            lastSeenAt: now,
          },
        });
      }
    }

    // Broadcast session update over Redis
    await broadcastSessionUpdate(session.id, {
      type: 'TICK_UPDATE',
      sessionId: session.id,
      timestamp: now.toISOString(),
    });
  }

  return {
    activeSessionsCount: activeSessions.length,
    processedRegistrations: totalProcessedRegistrations,
    unregisteredClientsCount: totalUnregistered,
    timestamp: now.toISOString(),
  };
}
