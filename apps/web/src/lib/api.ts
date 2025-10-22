import { createRestClient, DEMO_ORG_ID, DEMO_USER_ID } from '@avocat-ai/sdk';
import { clientEnv } from '../env.client';

export const API_BASE = clientEnv.NEXT_PUBLIC_API_BASE_URL;
export { DEMO_ORG_ID, DEMO_USER_ID } from '@avocat-ai/sdk';
export type * from '@avocat-ai/sdk';

const restClient = createRestClient({ baseUrl: API_BASE });

export const {
  submitResearchQuestion,
  requestHitlReview,
  sendTelemetryEvent,
  fetchCitations,
  fetchHitlQueue,
  fetchHitlMetrics,
  fetchHitlDetail,
  submitHitlAction,
  fetchMatters,
  fetchMatterDetail,
  fetchHitlAuditTrail,
  fetchCorpus,
  resummarizeDocument,
  fetchGovernanceMetrics,
  fetchRetrievalMetrics,
  fetchEvaluationMetrics,
  fetchSloMetrics,
  exportSloSnapshots,
  createSloSnapshot,
  fetchSnapshotDiff,
  toggleAllowlistDomain,
  fetchSsoConnections,
  saveSsoConnection,
  removeSsoConnection,
  fetchScimTokens,
  createScimAccessToken,
  deleteScimAccessToken,
  fetchComplianceStatus,
  acknowledgeCompliance,
  fetchAuditEvents,
  fetchDeviceSessions,
  revokeDeviceSession,
  fetchIpAllowlist,
  upsertIpAllowlistEntry,
  deleteIpAllowlistEntry,
  fetchDraftingTemplates,
  fetchWorkspaceOverview,
  getOperationsOverview,
  getGovernancePublications,
  fetchLaunchDigests,
  fetchDispatchReports,
  createTransparencyReport,
} = restClient;
