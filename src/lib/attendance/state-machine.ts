import {
  AttendanceRegistrationStatus,
  AttendanceIntervalStatus,
  AttendanceLogType,
} from '@/types/attendance';

export interface ObservedClient {
  mac: string;
  ip?: string;
  apMac?: string;
  apName?: string;
  ssid?: string;
  rssi?: number;
}

export interface CurrentRegistrationState {
  id: string;
  primaryMac: string;
  displayName: string;
  identityValue: string;
  status: AttendanceRegistrationStatus;
  currentApMac?: string | null;
  lastSeenAt?: Date | null;
  absentStartedAt?: Date | null;
  consecutiveMissCount: number;
  totalPresentSeconds: number;
  totalAbsentSeconds: number;
  totalUnknownSeconds: number;
  warningCount: number;
}

export interface StateTransitionResult {
  registrationId: string;
  newStatus: AttendanceRegistrationStatus;
  currentApMac?: string | null;
  lastSeenAt?: Date | null;
  absentStartedAt?: Date | null;
  consecutiveMissCount: number;
  deltaPresentSeconds: number;
  deltaAbsentSeconds: number;
  deltaUnknownSeconds: number;
  newWarningCount: number;
  shouldOpenInterval?: {
    apMac?: string | null;
    status: AttendanceIntervalStatus;
    joinedAt: Date;
  };
  shouldCloseInterval?: {
    leftAt: Date;
  };
  isNewlyDisconnected?: boolean;
  isNewlyReconnected?: boolean;
  logEvents: Array<{
    type: AttendanceLogType;
    message: string;
    details?: Record<string, any>;
  }>;
}

/**
 * Process single observation cycle for a registration
 */
export function evaluateRegistrationState(
  currentState: CurrentRegistrationState,
  observedClient: ObservedClient | null | undefined, // undefined/null means missing from target APs
  targetApMacs: string[],
  targetSsid: string,
  now: Date,
  warningThresholdMinutes = 15,
  isControllerHealthy = true
): StateTransitionResult {
  const normTargetAps = targetApMacs.map((m) => m.toLowerCase().trim());
  const normTargetSsid = targetSsid.toLowerCase().trim();

  // If controller is unhealthy/error, move to or maintain UNKNOWN without adding to present or absent
  if (!isControllerHealthy) {
    const isFirstUnknown = currentState.status !== 'UNKNOWN';
    return {
      registrationId: currentState.id,
      newStatus: 'UNKNOWN',
      currentApMac: currentState.currentApMac,
      lastSeenAt: currentState.lastSeenAt,
      absentStartedAt: currentState.absentStartedAt,
      consecutiveMissCount: currentState.consecutiveMissCount,
      deltaPresentSeconds: 0,
      deltaAbsentSeconds: 0,
      deltaUnknownSeconds: 10,
      newWarningCount: currentState.warningCount,
      shouldCloseInterval: isFirstUnknown ? { leftAt: now } : undefined,
      logEvents: isFirstUnknown
        ? [
            {
              type: 'SYSTEM_SYNC',
              message: `Mất liên lạc với UniFi Controller. Trạng thái người tham dự chuyển sang Không xác định.`,
              details: { previousStatus: currentState.status },
            },
          ]
        : [],
    };
  }

  // Check if client was observed on one of our TARGET APs and TARGET SSID
  const observedAp = observedClient?.apMac?.toLowerCase().trim();
  const observedSsid = observedClient?.ssid?.toLowerCase().trim();

  const isPresentOnTarget =
    Boolean(observedClient) &&
    Boolean(observedAp && (normTargetAps.length === 0 || normTargetAps.includes(observedAp))) &&
    (!observedSsid || observedSsid === normTargetSsid);

  const logEvents: StateTransitionResult['logEvents'] = [];

  // =========================================================================
  // CASE 1: Client IS DETECTED on target AP & SSID
  // =========================================================================
  if (isPresentOnTarget && observedClient) {
    const apMac = observedClient.apMac || currentState.currentApMac;
    let newStatus: AttendanceRegistrationStatus = 'PRESENT';
    let shouldOpenInterval: StateTransitionResult['shouldOpenInterval'];
    let shouldCloseInterval: StateTransitionResult['shouldCloseInterval'];

    // Roaming check: AP changed among target APs
    if (currentState.currentApMac && currentState.currentApMac.toLowerCase() !== apMac?.toLowerCase()) {
      logEvents.push({
        type: 'ROAM_AP',
        message: `${currentState.displayName} chuyển AP từ ${currentState.currentApMac} sang ${apMac}`,
        details: { oldAp: currentState.currentApMac, newAp: apMac },
      });
    }

    // Returning to presence from absence / unknown
    if (currentState.status === 'TEMPORARY_ABSENT' || currentState.status === 'ALERT_ABSENT' || currentState.status === 'UNKNOWN') {
      const wasAlert = currentState.status === 'ALERT_ABSENT';
      logEvents.push({
        type: wasAlert ? 'RECOVERED' : 'RECONNECT',
        message: wasAlert
          ? `${currentState.displayName} đã quay lại phòng họp sau thời gian vắng mặt cảnh báo.`
          : `${currentState.displayName} đã kết nối lại phòng họp.`,
        details: { apMac, previousStatus: currentState.status },
      });

      // Open new presence interval
      shouldOpenInterval = {
        apMac,
        status: 'PRESENT',
        joinedAt: now,
      };
    } else if (!currentState.lastSeenAt) {
      // Very first connect
      shouldOpenInterval = {
        apMac,
        status: 'PRESENT',
        joinedAt: now,
      };
      logEvents.push({
        type: 'CONNECT',
        message: `${currentState.displayName} đã kết nối vào phòng họp (AP: ${apMac}).`,
        details: { apMac },
      });
    }

    const isNewlyReconnected =
      currentState.status === 'TEMPORARY_ABSENT' ||
      currentState.status === 'ALERT_ABSENT' ||
      currentState.status === 'UNKNOWN';

    return {
      registrationId: currentState.id,
      newStatus,
      currentApMac: apMac,
      lastSeenAt: now,
      absentStartedAt: null, // Reset absent timer
      consecutiveMissCount: 0, // Reset miss counter
      deltaPresentSeconds: 10,
      deltaAbsentSeconds: 0,
      deltaUnknownSeconds: 0,
      newWarningCount: currentState.warningCount, // Keep historical warnings count!
      shouldOpenInterval,
      shouldCloseInterval,
      isNewlyReconnected,
      logEvents,
    };
  }

  // =========================================================================
  // CASE 2: Client IS NOT DETECTED on target AP
  // =========================================================================
  const nextMissCount = currentState.consecutiveMissCount + 1;
  const absentStarted = currentState.absentStartedAt || now;

  let newStatus: AttendanceRegistrationStatus = currentState.status;
  let newWarningCount = currentState.warningCount;
  let shouldCloseInterval: StateTransitionResult['shouldCloseInterval'];
  let isNewlyDisconnected = false;

  // Grace period check: If attendee was confirmed present very recently (within 25s),
  // do not trigger disconnect yet (absorbs AP inform cycle latency right after portal submission)
  const secondsSinceLastSeen = currentState.lastSeenAt
    ? Math.floor((now.getTime() - new Date(currentState.lastSeenAt).getTime()) / 1000)
    : 999;
  const isWithinRecentGrace = secondsSinceLastSeen < 25;

  // Confirmation threshold: require at least 2 consecutive misses (~6s of confirmed absence)
  // and past initial grace period to avoid sub-second false positives
  if (currentState.status === 'PRESENT') {
    if (nextMissCount >= 2 && !isWithinRecentGrace) {
      newStatus = 'TEMPORARY_ABSENT';
      shouldCloseInterval = { leftAt: absentStarted };
      isNewlyDisconnected = true;

      logEvents.push({
        type: 'DISCONNECT',
        message: `${currentState.displayName} đã mất kết nối / rời khỏi phòng họp.`,
        details: { absentStartedAt: absentStarted.toISOString(), primaryMac: currentState.primaryMac },
      });
    }
  }

  // Calculate elapsed absent time from when disconnection started
  const absentElapsedSeconds = Math.max(0, Math.floor((now.getTime() - absentStarted.getTime()) / 1000));
  const warningThresholdSeconds = warningThresholdMinutes * 60;

  // Check if absent continuously exceeded warning threshold (e.g. 15 minutes) -> Mark ALERT_ABSENT
  if (absentElapsedSeconds >= warningThresholdSeconds && currentState.status !== 'ALERT_ABSENT' && newStatus === 'TEMPORARY_ABSENT') {
    newStatus = 'ALERT_ABSENT';
    newWarningCount = currentState.warningCount + 1;

    logEvents.push({
      type: 'ALERT_TRIGGERED',
      message: `CẢNH BÁO ĐỎ: ${currentState.displayName} đã mất kết nối liên tục ${Math.round(absentElapsedSeconds / 60)} phút (ngưỡng: ${warningThresholdMinutes} phút). Trạng thái chuyển sang VẮNG MẶT.`,
      details: {
        absentElapsedMinutes: Math.round(absentElapsedSeconds / 60),
        warningThresholdMinutes,
      },
    });
  }

  return {
    registrationId: currentState.id,
    newStatus,
    currentApMac: currentState.currentApMac,
    lastSeenAt: currentState.lastSeenAt,
    absentStartedAt: absentStarted,
    consecutiveMissCount: nextMissCount,
    deltaPresentSeconds: 0,
    deltaAbsentSeconds: 10,
    deltaUnknownSeconds: 0,
    newWarningCount,
    shouldCloseInterval,
    isNewlyDisconnected,
    logEvents,
  };
}
