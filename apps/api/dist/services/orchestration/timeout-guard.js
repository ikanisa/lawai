export class TimeoutGuard {
    timeoutMs;
    errorFactory;
    constructor(config) {
        this.timeoutMs = Math.max(0, config.timeoutMs);
        this.errorFactory =
            config.errorFactory ?? (() => {
                const error = new Error('timeout_guard');
                error.statusCode = 504;
                return error;
            });
    }
    async run(operation) {
        if (this.timeoutMs === 0) {
            return operation();
        }
        let timer = null;
        try {
            return await Promise.race([
                operation(),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(this.errorFactory()), this.timeoutMs).unref();
                }),
            ]);
        }
        finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
}
