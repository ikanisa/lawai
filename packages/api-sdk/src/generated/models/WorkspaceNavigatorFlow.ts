/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceNavigatorStep } from './WorkspaceNavigatorStep';
import type { WorkspaceNavigatorTelemetry } from './WorkspaceNavigatorTelemetry';
/**
 * Navigator flow definition
 */
export type WorkspaceNavigatorFlow = {
    id: string;
    title: string;
    jurisdiction: string;
    persona: string;
    mode: 'ask' | 'do' | 'review' | 'generate';
    summary: string;
    estimatedMinutes: number;
    lastRunAt: string | null;
    alerts: Array<string>;
    telemetry: WorkspaceNavigatorTelemetry;
    steps: Array<WorkspaceNavigatorStep>;
};

