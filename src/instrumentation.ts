export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.MONITOR_PROCESS_ENABLED !== 'false') {
      const { startProcessSampler, startAppLogCapture } = await import('@/lib/monitor/process');
      startProcessSampler();
      startAppLogCapture();
    }
    // In production/docker, backend runs with APP_SERVER_MODE=backend
    // In single instance mode or when APP_SERVER_MODE is backend, start the background worker
    if (!process.env.APP_SERVER_MODE || process.env.APP_SERVER_MODE === 'backend') {
      const { startAttendanceWorker } = await import('@/lib/attendance/worker');
      startAttendanceWorker(3000);
      const { startMonitorCollectorWorker } = await import('@/lib/monitor/worker');
      startMonitorCollectorWorker(30000);
      const { startCampaignHotspotWorker } = await import('@/lib/network/campaign-hotspot-worker');
      startCampaignHotspotWorker(15000);
      const { startCampaignSessionWorker } = await import('@/lib/network/campaign-session-worker');
      startCampaignSessionWorker(5000);
      const {startUnifiExemptWorker}=await import('@/lib/network/unifi-exempt-worker');
      startUnifiExemptWorker(3000);
    }
  }
}
