#!/bin/bash
set -e

echo "🚀 Starting Netlify build process..."

# Enable pnpm via corepack
echo "📦 Enabling pnpm via corepack..."
corepack enable
corepack prepare pnpm@8.15.4 --activate

# Verify pnpm is available
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not available after corepack enable"
    exit 1
fi

echo "✅ pnpm version: $(pnpm --version)"

# Install dependencies
echo "📥 Installing dependencies..."
pnpm install --no-frozen-lockfile

# Determine which app to build based on context
if [ -n "$NETLIFY_BUILD_BASE" ]; then
    echo "📍 Build base: $NETLIFY_BUILD_BASE"
    
    if [[ "$NETLIFY_BUILD_BASE" == *"apps/web"* ]]; then
        echo "🏗️  Building Admin Panel (apps/web)..."
        pnpm --filter @avocat-ai/web build
    elif [[ "$NETLIFY_BUILD_BASE" == *"apps/pwa"* ]]; then
        echo "🏗️  Building Client PWA (apps/pwa)..."
        pnpm --filter @avocat-ai/pwa build
    else
        echo "⚠️  Unknown build base, building all Next.js apps..."
        pnpm --filter @avocat-ai/web build
        pnpm --filter @avocat-ai/pwa build
    fi
else
    echo "⚠️  No build base specified, building all Next.js apps..."
    pnpm --filter @avocat-ai/web build
    pnpm --filter @avocat-ai/pwa build
fi

echo "✅ Netlify build completed successfully!"
