/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Quick action available from the workspace desk
 */
export type WorkspaceDeskQuickAction = {
    id: string;
    label: string;
    description: string;
    mode: 'ask' | 'do' | 'review' | 'generate';
    action: 'navigate' | 'plan' | 'trust' | 'hitl';
    href?: string;
};

