#!/bin/bash
set -e

echo "🧹 Starting cleanup of Cloudflare/Vercel specific code..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Removing Vercel configuration files...${NC}"

# Remove vercel.json files
if [ -f "vercel.json" ]; then
    echo -e "${RED}  Removing root vercel.json${NC}"
    rm -f vercel.json
fi

if [ -f "apps/web/vercel.json" ]; then
    echo -e "${RED}  Removing apps/web/vercel.json${NC}"
    rm -f apps/web/vercel.json
fi

if [ -f "apps/pwa/vercel.json" ]; then
    echo -e "${RED}  Removing apps/pwa/vercel.json${NC}"
    rm -f apps/pwa/vercel.json
fi

echo -e "${GREEN}✅ Vercel configuration files removed${NC}"

echo -e "${YELLOW}Step 2: Checking for Vercel/Cloudflare imports...${NC}"

# Search for Vercel-specific imports
echo "  Searching for @vercel/* imports..."
VERCEL_IMPORTS=$(grep -r "@vercel/" apps/web apps/pwa packages --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)

if [ -n "$VERCEL_IMPORTS" ]; then
    echo -e "${YELLOW}  Found Vercel imports:${NC}"
    echo "$VERCEL_IMPORTS"
    echo -e "${YELLOW}  ⚠️  Manual removal required for these imports${NC}"
else
    echo -e "${GREEN}  ✅ No Vercel imports found${NC}"
fi

# Search for Cloudflare-specific imports
echo "  Searching for Cloudflare imports..."
CLOUDFLARE_IMPORTS=$(grep -r "@cloudflare/" apps/web apps/pwa packages --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)

if [ -n "$CLOUDFLARE_IMPORTS" ]; then
    echo -e "${YELLOW}  Found Cloudflare imports:${NC}"
    echo "$CLOUDFLARE_IMPORTS"
    echo -e "${YELLOW}  ⚠️  Manual removal required for these imports${NC}"
else
    echo -e "${GREEN}  ✅ No Cloudflare imports found${NC}"
fi

echo -e "${YELLOW}Step 3: Checking for edge runtime declarations...${NC}"

# Search for edge runtime
EDGE_RUNTIME=$(grep -r "export const runtime = 'edge'" apps/web apps/pwa --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -n "$EDGE_RUNTIME" ]; then
    echo -e "${YELLOW}  Found edge runtime declarations:${NC}"
    echo "$EDGE_RUNTIME"
    echo -e "${YELLOW}  ⚠️  These may need to be removed or changed to nodejs${NC}"
else
    echo -e "${GREEN}  ✅ No edge runtime declarations found${NC}"
fi

echo -e "${YELLOW}Step 4: Checking package.json for provider dependencies...${NC}"

# Check for Vercel/Cloudflare packages
VERCEL_DEPS=$(grep -r "@vercel" apps/web/package.json apps/pwa/package.json 2>/dev/null || true)
CLOUDFLARE_DEPS=$(grep -r "@cloudflare" apps/web/package.json apps/pwa/package.json 2>/dev/null || true)

if [ -n "$VERCEL_DEPS" ] || [ -n "$CLOUDFLARE_DEPS" ]; then
    echo -e "${YELLOW}  Found provider dependencies in package.json:${NC}"
    [ -n "$VERCEL_DEPS" ] && echo "$VERCEL_DEPS"
    [ -n "$CLOUDFLARE_DEPS" ] && echo "$CLOUDFLARE_DEPS"
    echo -e "${YELLOW}  ⚠️  Run 'pnpm remove <package>' to remove these${NC}"
else
    echo -e "${GREEN}  ✅ No provider dependencies found${NC}"
fi

echo -e "${GREEN}✅ Cleanup scan completed!${NC}"
echo ""
echo "Summary:"
echo "  - Vercel configuration files removed"
echo "  - Code scanning completed"
echo "  - Manual intervention may be required for imports and dependencies"
echo ""
echo "Next steps:"
echo "  1. Review any warnings above"
echo "  2. Remove identified imports manually"
echo "  3. Run 'pnpm install' to update lockfile"
echo "  4. Run 'node scripts/scan-provider-code.ts' for detailed analysis"
