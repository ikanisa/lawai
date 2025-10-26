export interface TelemetrySamplerConfig {
  sampleRate: number;
  random?: () => number;
}

export class TelemetrySampler {
  private readonly sampleRate: number;
  private readonly random: () => number;

  constructor(config: TelemetrySamplerConfig) {
    this.sampleRate = Math.min(1, Math.max(0, config.sampleRate));
    this.random = config.random ?? Math.random;
  }

  shouldSample(): boolean {
    if (this.sampleRate <= 0) {
      return false;
    }
    if (this.sampleRate >= 1) {
      return true;
    }
    return this.random() < this.sampleRate;
  }
}
