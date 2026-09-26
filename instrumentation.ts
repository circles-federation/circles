/* Runs once when the server starts. Starts the poller that sends queued event
   emails (lib/notify.ts) and the one that adds repeating events' upcoming
   dates (lib/series.ts) — the Node runtime only, since they need the database. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startNotificationWorker } = await import("./lib/notify");
  const { startSeriesWorker } = await import("./lib/series");
  startNotificationWorker();
  startSeriesWorker();
}
