import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://circles:circles@localhost:5432/circles_e2e";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

if (!new URL(E2E_DATABASE_URL).pathname.endsWith("_e2e")) throw new Error("E2E_DATABASE_URL's database name must end in _e2e: its setup drops and rebuilds it");
process.env.E2E_DATABASE_URL = E2E_DATABASE_URL;

/* Rebuilds and seeds its own database (the demo fixtures), then runs a
   production build against it, with Mailpit catching the login codes. The
   database is rebuilt in the server's command because Playwright starts the
   server before any global setup. */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx tsx e2e/setup-db.ts && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      SMTP_URL: process.env.SMTP_URL ?? "smtp://localhost:1025",
      EMAIL_FROM: "Circles <login@circles.local>",
      TZ: "America/New_York",
    },
  },
});
