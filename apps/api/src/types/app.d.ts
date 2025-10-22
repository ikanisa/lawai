import type { FastifyInstance } from 'fastify';
import type { AppContext } from './context';

export interface CreateAppResult {
  app: FastifyInstance;
  context: AppContext;
}
