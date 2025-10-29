import type { FastifyBaseLogger, FastifyInstance, FastifyTypeProviderDefault, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';
import type { AppContext } from './context.js';
export type AppFastifyInstance = FastifyInstance<RawServerDefault, RawRequestDefaultExpression<RawServerDefault>, RawReplyDefaultExpression<RawServerDefault>, FastifyBaseLogger, FastifyTypeProviderDefault>;
export interface AppAssembly {
    app: AppFastifyInstance;
    context: AppContext;
}
//# sourceMappingURL=fastify.d.ts.map