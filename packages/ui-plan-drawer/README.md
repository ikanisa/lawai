# UI plan drawer (`@avocat-ai/ui-plan-drawer`)

React component library that renders the phased implementation plan shared across the PWA and operator console.

## Install

```bash
pnpm install
```

## Scripts

```bash
pnpm --filter @avocat-ai/ui-plan-drawer run lint
pnpm --filter @avocat-ai/ui-plan-drawer run typecheck
pnpm --filter @avocat-ai/ui-plan-drawer run test
pnpm --filter @avocat-ai/ui-plan-drawer run build
```

## Usage

```tsx
import { PlanDrawer } from '@avocat-ai/ui-plan-drawer';

<PlanDrawer
  phase="ingestion"
  onSelect={(phase) => console.log('Selected', phase)}
/>
```

Bundle consumers must supply React 18 peer dependencies. Storybook examples live in the design system workspace (see `JB/` snapshots).
