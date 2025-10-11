declare module '@avocat-ai/shared' {
  export { SUPPORTED_JURISDICTIONS } from '../../../../packages/shared/src/constants/jurisdictions';
  export * from '../../../../packages/shared/src/index';
  // Fallback typings for typecheck-only contexts
  export type AgentPlanNotice = any;
  export type AgentPlanStep = any;
  export type IRACPayload = any;
  export type WorkspaceDesk = any;
}
