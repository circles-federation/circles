#!/usr/bin/env bash
# Runs something against the production database, which is only reachable from
# inside Railway's network. Opens a temporary TCP proxy, runs the command with
# DATABASE_URL pointed through it, and always closes the proxy afterwards.
#
#   scripts/prod-db.sh sql -e "select count(*) from members"   read-only query
#   scripts/prod-db.sh sql path/to/change.sql                  read-only file
#   scripts/prod-db.sh --write sql path/to/change.sql          may change data
#   scripts/prod-db.sh migrate                                 apply migrations
#   scripts/prod-db.sh run -- npm run admin -- add ada@example.com
#
# Needs a Railway login with this repo linked to the project (`railway login`,
# `railway link`). No credentials are stored anywhere: Railway supplies them to
# the command for as long as it runs.
set -euo pipefail

cd "$(dirname "$0")/.."
RAILWAY=(npx --yes @railway/cli)
DB_SERVICE="${PROD_DB_SERVICE:-Postgres}"

write=0
if [ "${1:-}" = "--write" ]; then write=1; shift; fi
mode="${1:-}"
[ -n "$mode" ] || { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }
shift
if [ "$mode" = "run" ] && [ "${1:-}" = "--" ]; then shift; fi
case "$mode" in
  sql | migrate | run) ;;
  *) echo "Unknown mode: $mode" >&2; exit 1 ;;
esac
proxy_id=""
close_proxy() {
  [ -n "$proxy_id" ] || return 0
  echo "Closing proxy..." >&2
  "${RAILWAY[@]}" tcp-proxy delete "$proxy_id" --service "$DB_SERVICE" --yes >&2 \
    || echo "COULD NOT CLOSE THE PROXY. Close it: ${RAILWAY[*]} tcp-proxy list --service $DB_SERVICE" >&2
  proxy_id=""
}
trap close_proxy EXIT INT TERM

echo "Opening proxy to production $DB_SERVICE..." >&2
created=$("${RAILWAY[@]}" tcp-proxy create --port 5432 --service "$DB_SERVICE" --json)
read -r proxy_id host port < <(node -e '
  const p = JSON.parse(require("fs").readFileSync(0, "utf8")).proxy;
  console.log(p.id, p.domain, p.proxyPort);
' <<<"$created")

for _ in $(seq 1 30); do
  "${RAILWAY[@]}" tcp-proxy status "$proxy_id" --service "$DB_SERVICE" 2>&1 | grep -qi active && break
  sleep 5
done

# Runs inside `railway run`, where the database service's PG* variables exist.
export PROD_PROXY_HOST="$host" PROD_PROXY_PORT="$port" PROD_WRITE="$write"
inner='export DATABASE_URL="postgresql://$PGUSER:$PGPASSWORD@$PROD_PROXY_HOST:$PROD_PROXY_PORT/$PGDATABASE"; exec "$@"'

case "$mode" in
  sql)     cmd=(node scripts/prod-sql.mjs "$@") ;;
  migrate) cmd=(node_modules/.bin/drizzle-kit migrate) ;;
  run)     cmd=("$@") ;;
esac

"${RAILWAY[@]}" run --service "$DB_SERVICE" sh -c "$inner" sh "${cmd[@]}"
