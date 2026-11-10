import * as Sentry from "@sentry/node";
import { scrubPath, scrubReport } from "./monitoring.util";

/* Error reporting to GlitchTip (Sentry-compatible), on the server. This and
   monitoring-client.ts are the only files that import the SDK, the same
   wrapping rule as lib/email/. Nothing is sent without GLITCHTIP_DSN, so
   development and CI are silent. Reports are scrubbed to the error and where
   it happened (lib/monitoring.util.ts); no tracing, breadcrumbs or user. */
export function initMonitoring() {
  const dsn = process.env.GLITCHTIP_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    release: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
    environment: process.env.NODE_ENV,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    enableRuntimeChannelInjection: false,
    // the pollers and senders log their failures with console.error
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    beforeSend: (event) => scrubReport(event),
  });
}

// Next's onRequestError hook: a render, route handler or Server Action that threw
export function reportRequestError(error: unknown, request: { path: string; method: string }) {
  if (!process.env.GLITCHTIP_DSN) return;
  // a redirect or notFound() is control flow, not a failure
  const digest = (error as { digest?: string } | null)?.digest ?? "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND") return;
  Sentry.captureException(error, { tags: { route: scrubPath(request.path), method: request.method } });
}
