#!/usr/bin/env bash
# The local playground: Supabase (supabase/config.toml, ports 553xx) plus self-hosted
# PowerSync (powersync/local/config.yaml, port 55380), seeded with a copy of the live
# "Roznamcha Test" business. Try migrations, Edge Functions and sync rules here before
# they touch the live project.
#
#   ./scripts/local-db.sh up      start everything and point the dev app at it
#   ./scripts/local-db.sh live    point the dev app back at the live project (stack keeps running)
#   ./scripts/local-db.sh local   point the dev app at the local stack again
#   ./scripts/local-db.sh reset   rebuild the database: every migration, then seed.sql
#   ./scripts/local-db.sh seed    refresh supabase/seed.sql from the live "Roznamcha Test"
#   ./scripts/local-db.sh down    stop everything and point the dev app back at live
#
# Only .env.development.local is written: Expo reads it in development and never in a
# production export, so an `eas update` can't pick up a local address. .env.local (live)
# is never touched. Dev builds clear their synced copy when the backend changes, so let
# the sync badge go green before switching.
set -euo pipefail
cd "$(dirname "$0")/.."

POWERSYNC_IMAGE=journeyapps/powersync-service:1.27.0
CONTAINER=roznamcha_powersync
NETWORK=supabase_network_roznamcha
DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
API_PORT=55321
POWERSYNC_PORT=55380
ENV_FILE=.env.development.local

psql_local() { PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -qAt "$@"; }

powersync_up() {
  # Fresh bucket storage each time, so it never holds state from an older database.
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  psql_local -c 'drop database if exists powersync_storage' -c 'create database powersync_storage'
  docker run -d --name "$CONTAINER" --network "$NETWORK" -p "$POWERSYNC_PORT:8080" \
    -v "$PWD/powersync/local/config.yaml:/config/config.yaml:ro" \
    -v "$PWD/powersync/sync-config.yaml:/config/sync-config.yaml:ro" \
    -e POWERSYNC_CONFIG_PATH=/config/config.yaml "$POWERSYNC_IMAGE" >/dev/null
  for _ in $(seq 30); do
    curl -sf "http://127.0.0.1:$POWERSYNC_PORT/probes/liveness" >/dev/null && return 0
    sleep 1
  done
  echo "PowerSync didn't come up; see: docker logs $CONTAINER" >&2
  return 1
}

use_local() {
  local anon
  anon=$(supabase status -o json 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['ANON_KEY'])")
  # The emulator (or a USB phone) reaches the laptop's ports as its own 127.0.0.1.
  adb reverse "tcp:$API_PORT" "tcp:$API_PORT" >/dev/null 2>&1 || echo "(no device for adb reverse yet; rerun 'local' once one is connected)"
  adb reverse "tcp:$POWERSYNC_PORT" "tcp:$POWERSYNC_PORT" >/dev/null 2>&1 || true
  cat > "$ENV_FILE" <<EOF
# Written by scripts/local-db.sh: the dev app talks to the laptop. Development only —
# a production export (eas update) never reads this file. Remove it with 'local-db.sh live'.
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:$API_PORT
EXPO_PUBLIC_SUPABASE_ANON_KEY=$anon
EXPO_PUBLIC_POWERSYNC_URL=http://127.0.0.1:$POWERSYNC_PORT
EOF
  echo "Dev app → LOCAL. Reload the app; sign in with admin@yopmail.com / roznamcha-local"
  echo "(or munshi@yopmail.com). Studio: http://127.0.0.1:55323"
}

use_live() {
  rm -f "$ENV_FILE"
  echo "Dev app → LIVE (.env.local). Reload the app."
}

case "${1:-}" in
  up)
    supabase start >/dev/null
    powersync_up
    use_local
    ;;
  local) use_local ;;
  live) use_live ;;
  reset)
    supabase db reset >/dev/null
    powersync_up
    echo "Database rebuilt from supabase/migrations + supabase/seed.sql."
    ;;
  seed)
    python3 scripts/local-seed.py "Roznamcha Test" supabase/seed.sql
    echo "Now run: ./scripts/local-db.sh reset"
    ;;
  down)
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    supabase stop >/dev/null
    use_live
    ;;
  *)
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
