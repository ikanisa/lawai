/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Navigator flow step
 */
export type WorkspaceNavigatorStep = {
    id: string;
    label: string;
    description: string;
    state: 'complete' | 'in_progress' | 'blocked';
    guardrails: Array<string>;
    outputs: Array<string>;
    escalation?: string | null;
};

