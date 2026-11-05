import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

export default async function setup() {
  const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;
  const url = new URL(TEST_DATABASE_URL);
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
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
  } finally {
    await pool.end();
  }
}
