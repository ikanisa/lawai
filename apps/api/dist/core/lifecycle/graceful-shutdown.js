export function registerGracefulShutdown(app, options = {}) {
    const signals = options.signals ?? ['SIGINT', 'SIGTERM'];
    const listeners = new Map();
    const closeApp = async (signal) => {
        app.log.info({ signal }, 'shutdown_signal_received');
        try {
            if (typeof options.cleanup === 'function') {
                await options.cleanup();
            }
            await app.close();
            app.log.info({ signal }, 'fastify_shutdown_complete');
            process.exit(0);
        }
        catch (error) {
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
