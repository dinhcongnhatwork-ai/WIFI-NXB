import { Prisma } from '@prisma/client';

type LockTransaction = Pick<Prisma.TransactionClient, '$executeRaw'>;
// Submit and END acquire this same row lock before reading status or intervals.
export async function lockAttendanceSession(tx: LockTransaction, id: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SELECT "id" FROM "attendance_sessions" WHERE "id" = ${id} FOR UPDATE`);
}
// AP overlap cannot be protected by a per-session row lock during creation.
// Serialize schedule writers on SSID/site; sorted old/new scopes avoid lock-order cycles.
export async function lockAttendanceSchedules(tx: LockTransaction, scopes: Array<{ unifiSite: string; ssid: string }>): Promise<void> {
  const keys = Array.from(new Set(scopes.map(scope => `attendance-schedule:${JSON.stringify([scope.unifiSite, scope.ssid])}`))).sort();
  for (const key of keys) await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
}
