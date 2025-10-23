#!/usr/bin/env bash
set -euo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "❌ Homebrew not found. Install from https://brew.sh/ then re-run."
  exit 1
fi

echo "➡️  Installing cloudflared via Homebrew…"
brew install cloudflared

echo "✅ cloudflared installed."
echo
echo "Next steps:"
echo "  1) cloudflared login"
echo "  2) Choose your Cloudflare account & domain"
echo "  3) Note the credentials file path printed (~/.cloudflared/<UUID>.json)"
echo "  4) cp infra/cloudflared/config.yml.example infra/cloudflared/config.yml"
echo "  5) Edit infra/cloudflared/config.yml:"
echo "       - credentials-file: /Users/<you>/.cloudflared/<UUID>.json"
echo "       - hostname: admin.sacco-plus.com (or your subdomain)"
echo
echo "When ready, run:  make tunnel-up"
