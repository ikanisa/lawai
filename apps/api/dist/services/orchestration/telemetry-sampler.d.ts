export interface TelemetrySamplerConfig {
    sampleRate: number;
    random?: () => number;
}
export declare class TelemetrySampler {
    private readonly sampleRate;
    private readonly random;
    constructor(config: TelemetrySamplerConfig);
    shouldSample(): boolean;
}
//# sourceMappingURL=telemetry-sampler.d.ts.map