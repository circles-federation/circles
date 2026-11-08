import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

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
  await fetch(`${process.env.MAILPIT_URL ?? "http://localhost:8025"}/api/v1/messages`, { method: "DELETE" });
}

setup().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
