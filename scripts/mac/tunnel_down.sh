#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_FILE="$ROOT_DIR/.logs/cloudflared.pid"

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill "$PID" >/dev/null 2>&1; then
    echo "🛑 Stopped cloudflared (PID $PID)."
  else
    echo "ℹ️  cloudflared was not running."
  fi
  rm -f "$PID_FILE"
else
  pkill -f "cloudflared .*tunnel run" >/dev/null 2>&1 || true
  echo "ℹ️  Attempted to stop cloudflared (no PID file found)."
fi
