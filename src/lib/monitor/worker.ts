let isCollectorRunning = false;
let isExecuting = false;

/**
 * Background worker that continuously collects telemetry from full MikroTik and UniFi devices.
 * Ensures metrics and heartbeats are perpetually updated in Redis and DB.
 */
export function startMonitorCollectorWorker(intervalMs = 30000) {
  if (isCollectorRunning) return;
  isCollectorRunning = true;

  console.log(`[monitor-collector] Background telemetry worker started (interval: ${intervalMs}ms)`);

  const runLoop = async () => {
    if (!isCollectorRunning) return;

    if (!isExecuting) {
      isExecuting = true;
      try {
        const { collectOnce } = await import('./collector');
        await collectOnce();
      } catch (err: any) {
        console.warn('[monitor-collector] Telemetry cycle notice:', err?.message || err);
      } finally {
        isExecuting = false;
      }
    }

    if (isCollectorRunning) {
      setTimeout(runLoop, intervalMs);
    }
  };

  // Run initial collection after 3 seconds on startup
  setTimeout(runLoop, 3000);
}

export function stopMonitorCollectorWorker() {
  isCollectorRunning = false;
}
