/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceDeskPersona } from './WorkspaceDeskPersona';
import type { WorkspaceDeskPlaybook } from './WorkspaceDeskPlaybook';
import type { WorkspaceDeskQuickAction } from './WorkspaceDeskQuickAction';
import type { WorkspaceDeskToolChip } from './WorkspaceDeskToolChip';
/**
 * Workspace desk configuration
 */
export type WorkspaceDesk = {
    playbooks: Array<WorkspaceDeskPlaybook>;
    quickActions: Array<WorkspaceDeskQuickAction>;
    personas: Array<WorkspaceDeskPersona>;
    toolChips: Array<WorkspaceDeskToolChip>;
};

