#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CFG="$ROOT_DIR/infra/cloudflared/config.yml"
LOG_DIR="$ROOT_DIR/.logs"
mkdir -p "$LOG_DIR"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared not installed. Run scripts/mac/install_cloudflared.sh first."
  exit 1
fi

if [[ ! -f "$CFG" ]]; then
  echo "❌ Missing $CFG. Copy the .example and fill placeholders."
  exit 1
fi

echo "▶️  Starting Cloudflare Tunnel in background…"
nohup cloudflared --config "$CFG" tunnel run > "$LOG_DIR/cloudflared.out" 2>&1 & echo $! > "$LOG_DIR/cloudflared.pid"
echo "✅ cloudflared PID: $(cat "$LOG_DIR/cloudflared.pid")"
echo "Logs: $LOG_DIR/cloudflared.out"
