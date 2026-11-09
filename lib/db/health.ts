import { sql } from "drizzle-orm";
import { db } from "./client";

// whether the database answers, for /api/health
export async function databaseIsUp(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
