export interface TimeoutGuardConfig {
    timeoutMs: number;
    errorFactory?: () => Error;
}
export declare class TimeoutGuard {
    private readonly timeoutMs;
    private readonly errorFactory;
    constructor(config: TimeoutGuardConfig);
    run<T>(operation: () => Promise<T>): Promise<T>;
}
//# sourceMappingURL=timeout-guard.d.ts.map