/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Tool chip rendered on the workspace desk
 */
export type WorkspaceDeskToolChip = {
    id: string;
    label: string;
    mode: 'ask' | 'do' | 'review' | 'generate';
    status: 'ready' | 'monitoring' | 'requires_hitl';
    description: string;
    action: 'navigate' | 'plan' | 'trust' | 'hitl';
    href?: string;
    ctaLabel: string;
};

