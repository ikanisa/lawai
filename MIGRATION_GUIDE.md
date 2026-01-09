# LawAI Modernization Migration Guide

## Overview

This guide helps you migrate from the current LawAI system to the Harvey AI-inspired architecture with Matter-centric design.

## Key Changes

### 1. Database Schema Evolution

The schema has been significantly enhanced with:

- **Organization Model**: Multi-tenant support (required for all users)
- **Matter Model**: Central organizing entity (replaces direct case management)
- **Vault Model**: Bulk document management (10,000+ documents)
- **Workflow Model**: Custom workflow builder
- **Enhanced Document Model**: AI processing, embeddings, review status
- **AIInteraction Model**: Comprehensive AI logging

### 2. Migration Steps

#### Step 1: Create Default Organization

Before running migrations, you need to create a default organization for existing users:

```sql
-- Run this BEFORE Prisma migration
INSERT INTO organizations (id, name, slug, settings, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Default Organization',
  'default',
  '{}',
  NOW(),
  NOW()
);
```

#### Step 2: Update Existing Users

After creating the organization, update all existing users to belong to it:

```sql
-- Get the default organization ID
-- Then update all users
UPDATE users
SET organization_id = (SELECT id FROM organizations WHERE slug = 'default')
WHERE organization_id IS NULL;
```

#### Step 3: Create Matters from Existing Cases

Migrate existing cases to the new Matter-centric structure:

```sql
-- Create a default matter for each user's cases
INSERT INTO matters (id, organization_id, name, description, status, owner_id, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  u.organization_id,
  'Legacy Cases - ' || u.name,
  'Migrated from legacy case system',
  'ACTIVE',
  u.id,
  NOW(),
  NOW()
FROM users u
WHERE u.organization_id IS NOT NULL;

-- Link existing cases to matters
UPDATE cases c
SET matter_id = (
  SELECT m.id 
  FROM matters m 
  WHERE m.owner_id = c.created_by 
  AND m.name LIKE 'Legacy Cases%'
  LIMIT 1
)
WHERE c.matter_id IS NULL;
```

#### Step 4: Run Prisma Migration

```bash
npm run db:migrate
```

This will create all new tables and relationships.

### 3. Code Migration

#### Update AI Agent Usage

**Before:**
```typescript
import { LawAIAgent } from './lib/ai-agent';

const agent = new LawAIAgent(userId);
const response = await agent.chat(messages, sessionId);
```

**After:**
```typescript
import { LawAIOrchestrator } from './lib/ai-orchestrator';

const orchestrator = new LawAIOrchestrator(
  userId,
  organizationId,
  matterId, // optional
  caseId    // optional
);

const result = await orchestrator.processRequest({
  type: 'chat',
  content: message,
  context: { previousMessages: messages }
});
```

#### Update API Routes

All API routes now need `organizationId` from the user's session:

```typescript
// Example: app/api/matters/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true }
  });

  const matters = await prisma.matter.findMany({
    where: { organizationId: user.organizationId }
  });

  return NextResponse.json(matters);
}
```

### 4. Backward Compatibility

The system maintains backward compatibility:

- **Legacy AI Agent**: Still works, but uses orchestrator internally
- **Existing Cases**: Automatically linked to default matters
- **Existing Documents**: Can be migrated to vaults manually

### 5. New Features Available

After migration, you can use:

1. **Matter Management**: Organize all work around matters
2. **Vault System**: Bulk document upload and semantic search
3. **Workflow Builder**: Create custom AI workflows
4. **Multi-Agent System**: Specialized agents for different tasks
5. **Enhanced Analytics**: Comprehensive AI interaction logging

### 6. Rollback Plan

If you need to rollback:

1. Restore database from backup
2. Revert Prisma schema to previous version
3. Restore previous code version from git

### 7. Testing Checklist

After migration, test:

- [ ] User login and authentication
- [ ] Case creation and viewing
- [ ] Document upload
- [ ] AI chat functionality
- [ ] Matter creation
- [ ] Vault document upload
- [ ] Workflow execution

## Support

For issues during migration, check:

1. Database logs for constraint violations
2. Application logs for API errors
3. Prisma migration status: `npx prisma migrate status`

## Next Steps

After successful migration:

1. Create matters for existing projects
2. Organize documents into vaults
3. Set up workflows for common tasks
4. Train team on Matter-centric workflow
