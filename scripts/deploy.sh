#!/usr/bin/env bash
# Veröffentlicht das Image und aktualisiert den Container auf dem Raspberry Pi.
# Usage: PI_HOST=pi@raspberrypi.local npm run deploy
set -euo pipefail

: "${PI_HOST:?PI_HOST fehlt, z.B. PI_HOST=pi@raspberrypi.local npm run deploy}"
PI_DIR="${PI_DIR:-druckwunsch}"

if ! ssh "$PI_HOST" "test -f $PI_DIR/.env"; then
  ssh "$PI_HOST" "mkdir -p $PI_DIR"
  echo "Auf dem Pi fehlt $PI_DIR/.env. Einmalig anlegen:"
  echo "  scp .env.example $PI_HOST:$PI_DIR/.env && ssh -t $PI_HOST nano $PI_DIR/.env"
  exit 1
fi

"$(dirname "$0")/docker-push.sh"

echo "→ Aktualisiere Container auf $PI_HOST"
scp compose.yaml "$PI_HOST:$PI_DIR/compose.yaml"
ssh "$PI_HOST" "cd $PI_DIR && docker compose pull && docker compose up -d && docker image prune -f >/dev/null"

echo "✓ Fertig. Logs: ssh $PI_HOST docker logs -f druckwunsch"
