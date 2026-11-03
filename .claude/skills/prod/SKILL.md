---
name: prod
description: Run SQL, migrations or admin scripts against the production database, or deploy to production (Railway). Use whenever a task touches production data or a deploy.
---

# Production: database changes and deploys

## Database

Production Postgres is reachable only from inside Railway, so `DATABASE_URL`, `railway run` and `railway ssh` don't work from a laptop. Use the one script that opens a temporary TCP proxy and always closes it:

```
scripts/prod-db.sh sql -e "select ..."          # read-only (default)
scripts/prod-db.sh sql path/to/file.sql         # read-only
scripts/prod-db.sh --write sql path/to/file.sql # may change data, in one transaction
scripts/prod-db.sh migrate                      # apply drizzle/ migrations
scripts/prod-db.sh run -- npm run admin -- add ada@example.com
```

Prerequisite: `railway login` and `railway link` (production environment) once. No secrets live in the repo; Railway supplies credentials while the command runs.

Rules:
1. Look first. Run a read-only query to find the exact rows (ids, current values) before writing anything.
2. Write with `--write` in a transaction, scoped by id, and show the user the rows it touched. Put the SQL in a file under the session scratchpad, not the repo.
3. Check `git status` afterwards: the working tree should be unchanged.
4. If the script dies, confirm no proxy is left: `npx --yes @railway/cli tcp-proxy list --service Postgres` (delete any with `tcp-proxy delete <id> --service Postgres --yes`).
5. Migrations are generated locally (`npm run db:generate`, committed), and applied to production with `migrate` before the deploy that needs them.
6. Column and table names are in `lib/db/schema.ts`; check them rather than guessing (`events.start`, not `start_time`).
7. Never print or paste connection strings or passwords.

## Deploys

Railway builds from GitHub: a push to `main` deploys. Only push when the user asks.
Watch it with `npx --yes @railway/cli deployment list --service circles --json` (look for SUCCESS). `/api/version` is behind the login gate, so don't curl it unauthenticated.
