import { readFileSync } from "node:fs";
import pg from "pg";

/* Runs SQL against DATABASE_URL in one transaction and prints each result. It's
   read-only unless PROD_WRITE=1, which scripts/prod-db.sh sets for --write, so
   a lookup can't change anything by accident.

     node scripts/prod-sql.mjs -e "select 1"
     node scripts/prod-sql.mjs change.sql */
const [flag, arg] = process.argv.slice(2);
const sql = flag === "-e" ? arg : flag ? readFileSync(flag, "utf8") : undefined;
if (!sql) {
  console.error("Usage: prod-sql.mjs -e 'SQL' | file.sql");
  process.exit(1);
}

const writing = process.env.PROD_WRITE === "1";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(writing ? "begin" : "begin read only");
  const results = [].concat(await client.query(sql));
  for (const r of results) {
    if (r.rows.length > 0) console.log(JSON.stringify(r.rows, null, 2));
    console.log(`${r.command} ${r.rowCount ?? 0}`);
  }
  await client.query("commit");
} catch (err) {
  await client.query("rollback").catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
