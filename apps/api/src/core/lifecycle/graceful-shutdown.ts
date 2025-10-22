import type { FastifyInstance } from 'fastify';

export interface GracefulShutdownOptions {
  signals?: NodeJS.Signals[];
}

export function registerGracefulShutdown(app: FastifyInstance, options: GracefulShutdownOptions = {}) {
  const signals = options.signals ?? ['SIGINT', 'SIGTERM'];
  const listeners = new Map<NodeJS.Signals, () => void>();

  const closeApp = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, 'shutdown_signal_received');
    try {
      await app.close();
      app.log.info({ signal }, 'fastify_shutdown_complete');
      process.exit(0);
    } catch (error) {
      app.log.error({ signal, err: error }, 'fastify_shutdown_failed');
      process.exit(1);
    }
  };

  for (const signal of signals) {
    const handler = () => {
      for (const [registered, listener] of listeners.entries()) {
        process.off(registered, listener);
      }
      void closeApp(signal);
    };
    listeners.set(signal, handler);
    process.once(signal, handler);
  }

  app.addHook('onClose', () => {
    for (const [signal, listener] of listeners.entries()) {
      process.off(signal, listener);
    }
  });
}
