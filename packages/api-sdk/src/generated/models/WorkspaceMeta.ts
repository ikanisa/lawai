/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Metadata about the workspace response completeness
 */
export type WorkspaceMeta = {
    status: 'ok' | 'partial';
    warnings: Array<string>;
    errors?: Record<string, any>;
};

