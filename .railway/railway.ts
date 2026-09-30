import { defineRailway, github, preserve, project, service } from "railway/iac";

/* The app service on Railway, applied with `railway config plan` (a read-only
   preview) then `railway config apply` — not on push; a push only deploys the
   code. The partial means this file manages the app service alone, not the
   Postgres database. Anything the service has that isn't in this file is
   removed by apply, so always read the plan first. Variable values stay in
   Railway (see .env.example for what each one is); a new variable needs
   adding here too.

   One replica, always: the notification poller (instrumentation.ts) and the
   login-code cooldown are in-process state, so a second one would split a
   member's digest across two emails and reset the cooldown per instance (see
   CLAUDE.md's Event notifications section). A persistent process at all, not
   a serverless host, is for that same poller.

   Migrations aren't a preDeploy step on purpose: they're run by hand before a
   deploy that changes lib/db/schema.ts, so two deploys can't race one. */
export const partial = "circles";

export default defineRailway(() => {
  const circles = service("circles", {
    // deploys on every push to main
    source: github("circles-federation/circles", { branch: "main" }),
    // every variable must be named here, or apply deletes it — preserve()
    // keeps the value set in Railway, so no secret is ever in this file
    variables: {
      DATABASE_URL: preserve(),
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
      SMTP_URL: preserve(),
      EMAIL_FROM: preserve(),
      DIGEST_HOUR: preserve(),
      TZ: preserve(),
    },
    build: {
      builder: "RAILPACK",
      buildCommand: "npm run build",
    },
    deploy: {
      startCommand: "npm run start",
      numReplicas: 1,
      healthcheckPath: "/",
      healthcheckTimeout: 30,
      // restarts on failure, Railway's default: naming it only makes every
      // plan show a change, since Railway stores its default as null
      restartPolicyMaxRetries: 3,
    },
  });
  return project("circles", {
    resources: [circles],
  });
});
