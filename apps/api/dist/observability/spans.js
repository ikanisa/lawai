export async function withRequestSpan(request, options, handler) {
    const start = process.hrtime.bigint();
    const spanAttributes = { ...(options.attributes ?? {}) };
    const spanLogger = request.log.child({ span: options.name, ...spanAttributes });
    const setAttribute = (key, value) => {
        spanAttributes[key] = value;
    };
    spanLogger.debug({ event: 'span.start', ...spanAttributes }, 'span started');
    try {
        const result = await handler({ logger: spanLogger, setAttribute });
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        spanLogger.info({ event: 'span.success', durationMs, ...spanAttributes }, 'span completed');
        return result;
    }
    catch (error) {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        spanLogger.error({ event: 'span.error', durationMs, err: error, ...spanAttributes }, 'span failed');
        throw error;
    }
}
