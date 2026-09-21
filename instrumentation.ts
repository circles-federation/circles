/* Runs once when the server starts. Starts the poller that sends queued event
   emails (lib/notify.ts) — the Node runtime only, since it needs the database. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startNotificationWorker } = await import("./lib/notify");
  startNotificationWorker();
}
