declare module '@avocat-ai/shared' {
  export { SUPPORTED_JURISDICTIONS } from '../../../../packages/shared/src/constants/jurisdictions';
  export * from '../../../../packages/shared/src/index';
  // Fallback typings for typecheck-only contexts
  export type AgentPlanNotice = import('../../../../packages/shared/src/plan').AgentPlanNotice;
  export type AgentPlanStep = import('../../../../packages/shared/src/plan').AgentPlanStep;
  export type IRACPayload = import('../../../../packages/shared/src/irac').IRACPayload;
  export type WorkspaceDesk = import('../../../../packages/shared/src/workspace').WorkspaceDesk;
}
