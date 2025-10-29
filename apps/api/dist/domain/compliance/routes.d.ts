import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import type { AppContext } from '../../types/context.js';
type AcknowledgementEvent = {
    type: string;
    version: string;
    created_at: string | null;
};
declare const complianceAckSchema: z.ZodEffects<z.ZodObject<{
    consent: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        type: z.ZodString;
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        version: string;
    }, {
        type: string;
        version: string;
    }>>>;
    councilOfEurope: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: string;
    }, {
        version: string;
    }>>>;
}, "strip", z.ZodTypeAny, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}>, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}, {
    consent?: {
        type: string;
        version: string;
    } | null | undefined;
    councilOfEurope?: {
        version: string;
    } | null | undefined;
}>;
type RequestAccess = Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
declare function summariseAcknowledgements(access: RequestAccess, events: AcknowledgementEvent[]): {
    consent: {
        requiredVersion: string | null;
        acknowledgedVersion: string | null;
        acknowledgedAt: string | null;
        satisfied: boolean;
    };
    councilOfEurope: {
        requiredVersion: string | null;
        acknowledgedVersion: string | null;
        acknowledgedAt: string | null;
        satisfied: boolean;
    };
};
type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown;
interface ComplianceRouteOptions {
    rateLimiters?: {
        acknowledgements?: PreHandler;
        status?: PreHandler;
    };
}
export declare function registerComplianceRoutes(app: FastifyInstance, ctx: AppContext, options?: ComplianceRouteOptions): Promise<void>;
export { complianceAckSchema, summariseAcknowledgements };
//# sourceMappingURL=routes.d.ts.map