export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // In production/docker, backend runs with APP_SERVER_MODE=backend
    // In single instance mode or when APP_SERVER_MODE is backend, start the background worker
    if (!process.env.APP_SERVER_MODE || process.env.APP_SERVER_MODE === 'backend') {
      const { startAttendanceWorker } = await import('@/lib/attendance/worker');
      startAttendanceWorker(3000);
    }
  }
}
