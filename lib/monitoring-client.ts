import * as Sentry from "@sentry/browser";
import { scrubReport } from "./monitoring.util";

/* The browser's half of error reporting (see monitoring.ts): unhandled errors
   and rejections only, scrubbed the same way, nothing without a DSN. The DSN
   is public by design (it can only submit reports), so it's built into the code. */
export function initClientMonitoring() {
  const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    release: process.env.NEXT_PUBLIC_APP_VERSION || undefined,
    environment: process.env.NODE_ENV,
    maxBreadcrumbs: 0,
    tracesSampleRate: 0,
    defaultIntegrations: false,
    integrations: [Sentry.globalHandlersIntegration(), Sentry.dedupeIntegration()],
    beforeSend: (event) => scrubReport(event),
  });
}

export function reportClientError(error: unknown) {
  if (!process.env.NEXT_PUBLIC_GLITCHTIP_DSN) return;
  Sentry.captureException(error);
}
