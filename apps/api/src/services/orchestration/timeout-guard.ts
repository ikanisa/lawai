export interface TimeoutGuardConfig {
  timeoutMs: number;
  errorFactory?: () => Error;
}

export class TimeoutGuard {
  private readonly timeoutMs: number;
  private readonly errorFactory: () => Error;

  constructor(config: TimeoutGuardConfig) {
    this.timeoutMs = Math.max(0, config.timeoutMs);
    this.errorFactory =
      config.errorFactory ?? (() => {
        const error = new Error('timeout_guard');
        (error as Error & { statusCode?: number }).statusCode = 504;
        return error;
      });
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.timeoutMs === 0) {
      return operation();
    }

    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        operation(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(this.errorFactory()), this.timeoutMs).unref();
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
