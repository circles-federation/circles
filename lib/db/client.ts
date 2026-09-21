import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/* The one file that opens a real Postgres connection — only lib/db/*.ts and
   lib/better-auth.ts may import this or lib/db/schema.ts directly. Every
   other file in the app reaches data through lib/db/members.ts/circles.ts/
   events.ts's plain async functions, same as before this was a real DB. */
export const db = drizzle(process.env.DATABASE_URL!, { schema });

// the handle a db.transaction callback receives — for helpers that run inside one
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
