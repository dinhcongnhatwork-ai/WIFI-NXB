import { expect, it } from 'vitest';
import * as constants from '@/lib/attendance/constants';
it('converts browser datetime-local to ISO and restores the same local minute', () => {
  const functions = constants as typeof constants & { localDateTimeToIso?: (s: string) => string; isoToLocalDateTime?: (s: string) => string };
  const local = '2026-10-13T09:45';
  expect(functions.localDateTimeToIso?.(local)).toBe(new Date(local).toISOString());
  expect(functions.isoToLocalDateTime?.(new Date(local).toISOString())).toBe(local);
});
