import { describe, it, expect } from 'vitest';
import {
  evaluateRegistrationState,
  CurrentRegistrationState,
  ObservedClient,
} from '@/lib/attendance/state-machine';

describe('Attendance State Machine (PLAN.MD rules)', () => {
  const baseAttendee: CurrentRegistrationState = {
    id: 'reg-1',
    primaryMac: '70:a7:41:00:11:22',
    displayName: 'Nguyễn Văn A',
    identityValue: 'NV001',
    status: 'PRESENT',
    currentApMac: 'ap-11-a',
    lastSeenAt: new Date('2026-09-09T08:00:00Z'),
    absentStartedAt: null,
    consecutiveMissCount: 0,
    totalPresentSeconds: 300,
    totalAbsentSeconds: 0,
    totalUnknownSeconds: 0,
    warningCount: 0,
  };

  const targetAps = ['ap-11-a', 'ap-11-b'];
  const targetSsid = 'HOP_TANG_11';

  it('maintains PRESENT when client is observed on target AP and SSID', () => {
    const now = new Date('2026-09-09T08:05:00Z');
    const observed: ObservedClient = {
      mac: '70:a7:41:00:11:22',
      apMac: 'ap-11-a',
      ssid: 'HOP_TANG_11',
      rssi: -55,
    };

    const result = evaluateRegistrationState(
      baseAttendee,
      observed,
      targetAps,
      targetSsid,
      now,
      15,
      true
    );

    expect(result.newStatus).toBe('PRESENT');
    expect(result.consecutiveMissCount).toBe(0);
    expect(result.deltaPresentSeconds).toBe(10);
    expect(result.deltaAbsentSeconds).toBe(0);
    expect(result.lastSeenAt).toEqual(now);
    expect(result.absentStartedAt).toBeNull();
  });

  it('detects roaming between AP 11-A and AP 11-B without creating a new user or interrupting presence', () => {
    const now = new Date('2026-09-09T08:10:00Z');
    const observed: ObservedClient = {
      mac: '70:a7:41:00:11:22',
      apMac: 'ap-11-b', // roamed from ap-11-a to ap-11-b
      ssid: 'HOP_TANG_11',
      rssi: -62,
    };

    const result = evaluateRegistrationState(
      baseAttendee,
      observed,
      targetAps,
      targetSsid,
      now,
      15,
      true
    );

    expect(result.newStatus).toBe('PRESENT');
    expect(result.currentApMac).toBe('ap-11-b');
    expect(result.logEvents.some((e) => e.type === 'ROAM_AP')).toBe(true);
  });

  it('marks first healthy-controller miss as lost WiFi under the immediate-detection policy', () => {
    const now = new Date('2026-09-09T08:15:00Z');

    const result = evaluateRegistrationState(
      baseAttendee,
      null, // not seen on target APs
      targetAps,
      targetSsid,
      now,
      15,
      true
    );

    expect(result.newStatus).toBe('TEMPORARY_ABSENT'); // Controller snapshot is authoritative
    expect(result.consecutiveMissCount).toBe(1);
    expect(result.absentStartedAt).toEqual(now); // Absence clock starts
    expect(result.isNewlyDisconnected).toBe(true);
  });

  it('transitions to TEMPORARY_ABSENT on second consecutive miss', () => {
    const now = new Date('2026-09-09T08:15:10Z');
    const stateAfterOneMiss: CurrentRegistrationState = {
      ...baseAttendee,
      status: 'PRESENT',
      consecutiveMissCount: 1,
      absentStartedAt: new Date('2026-09-09T08:15:00Z'),
      lastSeenAt: new Date('2026-09-09T08:10:00Z'), // >25s ago
    };

    const result = evaluateRegistrationState(
      stateAfterOneMiss,
      null,
      targetAps,
      targetSsid,
      now,
      15,
      true
    );

    expect(result.newStatus).toBe('TEMPORARY_ABSENT');
    expect(result.consecutiveMissCount).toBe(2);
    expect(result.isNewlyDisconnected).toBe(true);
    expect(result.shouldCloseInterval).toBeDefined();
    expect(result.logEvents.some((e) => e.type === 'DISCONNECT')).toBe(true);
  });

  it('transitions to ALERT_ABSENT (red) when missing continuously >= 15 minutes', () => {
    const absentStarted = new Date('2026-09-09T08:00:00Z');
    const nowAfter15Min = new Date('2026-09-09T08:15:05Z'); // 15 min 5s

    const stateInTemporaryAbsent: CurrentRegistrationState = {
      ...baseAttendee,
      status: 'TEMPORARY_ABSENT',
      consecutiveMissCount: 10,
      absentStartedAt: absentStarted,
    };

    const result = evaluateRegistrationState(
      stateInTemporaryAbsent,
      null,
      targetAps,
      targetSsid,
      nowAfter15Min,
      15, // 15 min threshold
      true
    );

    expect(result.newStatus).toBe('ALERT_ABSENT');
    expect(result.newWarningCount).toBe(1);
    expect(result.logEvents.some((e) => e.type === 'ALERT_TRIGGERED')).toBe(true);
  });

  it('returns to PRESENT and preserves warning count when reconnecting after alert', () => {
    const now = new Date('2026-09-09T08:25:00Z');

    const stateInAlert: CurrentRegistrationState = {
      ...baseAttendee,
      status: 'ALERT_ABSENT',
      consecutiveMissCount: 50,
      absentStartedAt: new Date('2026-09-09T08:00:00Z'),
      warningCount: 1,
    };

    const observed: ObservedClient = {
      mac: '70:a7:41:00:11:22',
      apMac: 'ap-11-a',
      ssid: 'HOP_TANG_11',
    };

    const result = evaluateRegistrationState(
      stateInAlert,
      observed,
      targetAps,
      targetSsid,
      now,
      15,
      true
    );

    expect(result.newStatus).toBe('PRESENT');
    expect(result.newWarningCount).toBe(1); // Preserved historical warning!
    expect(result.absentStartedAt).toBeNull(); // Reset absent timer
    expect(result.shouldOpenInterval?.status).toBe('PRESENT');
    expect(result.logEvents.some((e) => e.type === 'RECOVERED')).toBe(true);
  });

  it('transitions to UNKNOWN when Controller is unhealthy without adding to present or absent time', () => {
    const now = new Date('2026-09-09T08:30:00Z');

    const result = evaluateRegistrationState(
      baseAttendee,
      null,
      targetAps,
      targetSsid,
      now,
      15,
      false // Controller offline/unhealthy
    );

    expect(result.newStatus).toBe('UNKNOWN');
    expect(result.deltaPresentSeconds).toBe(0);
    expect(result.deltaAbsentSeconds).toBe(0);
    expect(result.deltaUnknownSeconds).toBe(10);
  });
});
