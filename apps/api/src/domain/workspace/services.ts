import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPhaseCWorkspaceDesk } from '../../workspace.js';
import {
  collectWorkspaceFetchErrors,
  normalizeWorkspaceOverview,
  queryWorkspaceOverview,
  type WorkspaceFetchErrors,
  type WorkspaceOverview,
} from './overview.js';

export { type WorkspaceFetchErrors, type WorkspaceOverview } from './overview.js';

export async function fetchWorkspaceOverview(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ data: WorkspaceOverview; errors: WorkspaceFetchErrors }> {
  const results = await queryWorkspaceOverview(supabase, orgId);

  const overviewCore = normalizeWorkspaceOverview({
    jurisdictions: results.jurisdictionsResult.data ?? [],
    matters: results.mattersResult.data ?? [],
    compliance: results.complianceResult.data ?? [],
    hitl: results.hitlResult.data ?? [],
  });

  return {
    data: {
      ...overviewCore,
      desk: buildPhaseCWorkspaceDesk(),
    },
    errors: collectWorkspaceFetchErrors(results),
  };
}
