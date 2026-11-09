/* Runs once when the server starts. Starts the poller that sends queued event
   emails (lib/notify.ts) and the one that adds repeating events' upcoming
   dates (lib/series.ts) — the Node runtime only, since they need the database.
   Also starts error reporting (lib/monitoring.ts) before either, so a poller
   that fails at boot is reported. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  (await import("./lib/monitoring")).initMonitoring();
  const { startNotificationWorker } = await import("./lib/notify");
  const { startSeriesWorker } = await import("./lib/series");
  startNotificationWorker();
  startSeriesWorker();
}

export async function onRequestError(error: unknown, request: { path: string; method: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  (await import("./lib/monitoring")).reportRequestError(error, request);
}
