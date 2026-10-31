import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { runAttendanceMonitorTick } from './monitor';

let isRunning = false;
let workerTimeout: NodeJS.Timeout | null = null;
let isCycleExecuting = false;

/**
 * Background worker that continuously monitors WiFi attendance on UniFi controller.
 * When an active meeting session exists, it queries UniFi every `intervalMs` (default 3000ms).
 */
export function startAttendanceWorker(intervalMs = 3000) {
  if (isRunning) {
    return;
  }
  isRunning = true;
  console.log(`[attendance-worker] Background worker started (interval: ${intervalMs}ms)`);

  const runLoop = async () => {
    if (!isRunning) return;

    if (!isCycleExecuting) {
      isCycleExecuting = true;
      try {
        await redis.set('monitor:attendance:heartbeat', JSON.stringify({at:Date.now()}), 'EX', 30).catch(() => {});
        const activeCount = await prisma.attendanceSession.count({
          where: { status: 'ACTIVE' },
        });

        if (activeCount > 0) {
          await runAttendanceMonitorTick();
        }
      } catch (err: any) {
        console.error('[attendance-worker] Cycle execution error:', err.message);
      } finally {
        isCycleExecuting = false;
      }
    }

    if (isRunning) {
      workerTimeout = setTimeout(runLoop, intervalMs);
    }
  };

  workerTimeout = setTimeout(runLoop, 1000);
}

export function stopAttendanceWorker() {
  isRunning = false;
  if (workerTimeout) {
    clearTimeout(workerTimeout);
    workerTimeout = null;
  }
  isCycleExecuting = false;
  console.log('[attendance-worker] Background worker stopped');
}

export function isAttendanceWorkerRunning(): boolean {
  return isRunning;
}
