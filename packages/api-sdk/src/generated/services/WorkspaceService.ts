/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceResponse } from '../models/WorkspaceResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WorkspaceService {
    /**
     * Fetch the workspace overview for an organisation
     * @param orgId Workspace organisation identifier
     * @param xUserId Identifier of the authenticated user
     * @returns WorkspaceResponse Workspace overview response
     * @throws ApiError
     */
    public static getWorkspace(
        orgId: string,
        xUserId: string,
    ): CancelablePromise<WorkspaceResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/workspace',
            headers: {
                'x-user-id': xUserId,
            },
            query: {
                'orgId': orgId,
            },
            errors: {
                400: `Invalid request parameters`,
                403: `Insufficient permissions to view the workspace`,
                429: `Rate limit exceeded`,
                500: `Unexpected server error`,
            },
        });
    }
}
