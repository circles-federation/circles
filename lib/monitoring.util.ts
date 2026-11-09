/* What an error report may carry out of the app, for lib/monitoring.ts. A
   report is only for finding bugs, so it keeps the error, where it happened
   and which build it was, and drops anything about a person: Postgres errors
   quote the query's parameters, which are whatever a member typed, and a
   thrown message may hold an address. Pure, so it's tested without an SDK. */

export const REPORT_MESSAGE_MAX = 300;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Drizzle's "Failed query: … params: a,b,c" and node-postgres's detail lines
const QUERY_PARAMS = /\s*params:[\s\S]*$/i;

export function scrubMessage(message: string): string {
  const scrubbed = message.replace(QUERY_PARAMS, "").replace(EMAIL, "[email]");
  return scrubbed.length > REPORT_MESSAGE_MAX ? `${scrubbed.slice(0, REPORT_MESSAGE_MAX)}…` : scrubbed;
}

interface ReportShape {
  message?: string;
  exception?: { values?: { value?: string }[] };
  request?: { url?: string };
  user?: unknown;
  extra?: unknown;
  breadcrumbs?: unknown;
  contexts?: Record<string, unknown>;
}

// a URL as just its path: a query string can hold a token (a guest's link, a code)
function pathOnly(url: string): string {
  try {
    return new URL(url, "http://x").pathname;
  } catch {
    return "";
  }
}

// the paths that are themselves a secret: /e/<token>, /e/stop/<id>, /invitations/<id>
const SECRET_PATH = /^\/e\/(?:stop\/)?[^/]+/;

// a request's path alone, with a shared link's secret left out
export function scrubPath(url: string): string {
  return pathOnly(url).replace(SECRET_PATH, (m) => m.replace(/[^/]+$/, "[redacted]"));
}

export function scrubReport<T extends object>(report: T): T {
  const out: ReportShape = { ...report };
  if (out.message) out.message = scrubMessage(out.message);
  if (out.exception?.values) out.exception = { ...out.exception, values: out.exception.values.map((v) => (v.value ? { ...v, value: scrubMessage(v.value) } : v)) };
  if (out.request?.url) {
    out.request = { url: scrubPath(out.request.url) };
  } else delete out.request;
  delete out.user;
  delete out.extra;
  delete out.breadcrumbs;
  return out as T;
}
