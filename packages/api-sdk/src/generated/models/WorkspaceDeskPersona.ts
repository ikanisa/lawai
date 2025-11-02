/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Persona represented on the workspace desk
 */
export type WorkspaceDeskPersona = {
    id: string;
    label: string;
    description: string;
    mode: 'ask' | 'do' | 'review' | 'generate';
    focusAreas: Array<string>;
    guardrails: Array<string>;
    href: string;
    agentCode: string;
};

