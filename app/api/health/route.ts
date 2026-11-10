import { databaseIsUp } from "@/lib/db/health";

/* For an uptime monitor, which has no session: 200 while the app is running
   and its database answers, 503 when it doesn't. It says nothing else. */
export async function GET() {
  const up = await databaseIsUp();
  return Response.json({ ok: up }, { status: up ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
