/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceComplianceWatch } from './WorkspaceComplianceWatch';
import type { WorkspaceDesk } from './WorkspaceDesk';
import type { WorkspaceHitlInbox } from './WorkspaceHitlInbox';
import type { WorkspaceJurisdiction } from './WorkspaceJurisdiction';
import type { WorkspaceMatter } from './WorkspaceMatter';
import type { WorkspaceNavigatorFlow } from './WorkspaceNavigatorFlow';
/**
 * Workspace overview payload
 */
export type WorkspaceOverview = {
    jurisdictions: Array<WorkspaceJurisdiction>;
    matters: Array<WorkspaceMatter>;
    complianceWatch: Array<WorkspaceComplianceWatch>;
    hitlInbox: WorkspaceHitlInbox;
    desk: WorkspaceDesk;
    navigator: Array<WorkspaceNavigatorFlow>;
};

