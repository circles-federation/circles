import { APP_VERSION } from "@/lib/app-version";

// the build the server is running, for lib/app-version.ts's isOutdatedVersion
export function GET() {
  return Response.json({ version: APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
