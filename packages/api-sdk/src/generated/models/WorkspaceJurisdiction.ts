/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Jurisdiction summary with matter counts
 */
export type WorkspaceJurisdiction = {
    /**
     * Jurisdiction code
     */
    code: string;
    /**
     * Jurisdiction name
     */
    name: string;
    /**
     * Whether the jurisdiction is part of the EU
     */
    eu: boolean;
    /**
     * Whether the jurisdiction is part of OHADA
     */
    ohada: boolean;
    /**
     * Number of matters associated with the jurisdiction
     */
    matterCount: number;
};

