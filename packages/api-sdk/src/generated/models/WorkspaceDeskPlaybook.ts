/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceDeskPlaybookStep } from './WorkspaceDeskPlaybookStep';
/**
 * Workspace playbook configuration
 */
export type WorkspaceDeskPlaybook = {
    id: string;
    title: string;
    persona: string;
    jurisdiction: string;
    mode: 'ask' | 'do' | 'review' | 'generate';
    summary: string;
    regulatoryFocus: Array<string>;
    steps: Array<WorkspaceDeskPlaybookStep>;
    cta: {
        label: string;
        question?: string;
        mode: 'ask' | 'do' | 'review' | 'generate';
    };
};

