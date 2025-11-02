/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Step within a workspace playbook
 */
export type WorkspaceDeskPlaybookStep = {
    id: string;
    name: string;
    description: string;
    status: 'success' | 'skipped' | 'failed';
    attempts: number;
    detail?: any | null;
};

