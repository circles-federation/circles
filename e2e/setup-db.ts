import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/* A meeting that's under way whenever the tests run, for meetings.spec.ts: one
   can't be created with a start time that's passed. It began at midnight
   yesterday and ends at midnight today, so it's in its run window (until a day
   after its end) whichever zone the runner is in. Mira's Finance Council. */
async function addLiveMeeting(databaseUrl: string) {
  const day = (offset: number) => {
    const d = new Date(Date.now() + offset * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `insert into events (id, title, kind, circle_id, approved_at, organizer_id, date, start, "end", location, description)
       values ('e2e-live-meeting', 'E2E live meeting', 'meeting', 'finance-council', now(), 15, $1, '00:00', '00:00', 'Online', '')`,
      [day(-1)],
    );
    await client.query(
      `insert into event_agenda_items (event_id, position, category, title) values
       ('e2e-live-meeting', 0, 'report', 'Treasurer''s report'), ('e2e-live-meeting', 1, 'decide', 'Approve the winter budget')`,
    );
  } finally {
    await client.end();
  }
}

async function setup() {
  fs.rmSync(path.resolve(import.meta.dirname, ".auth"), { recursive: true, force: true });
  const databaseUrl = process.env.E2E_DATABASE_URL!;
  const url = new URL(databaseUrl);
  const name = url.pathname.slice(1);
  url.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(import.meta.dirname, "../drizzle") });
  } finally {
    await pool.end();
  }
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: databaseUrl, BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else" } });
  await addLiveMeeting(databaseUrl);
  await fetch(`${process.env.MAILPIT_URL ?? "http://localhost:8025"}/api/v1/messages`, { method: "DELETE" });
}

setup().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
