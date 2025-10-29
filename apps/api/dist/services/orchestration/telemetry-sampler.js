export class TelemetrySampler {
    sampleRate;
    random;
    constructor(config) {
        this.sampleRate = Math.min(1, Math.max(0, config.sampleRate));
        this.random = config.random ?? Math.random;
    }
    shouldSample() {
        if (this.sampleRate <= 0) {
            return false;
        }
        if (this.sampleRate >= 1) {
            return true;
        }
        return this.random() < this.sampleRate;
    }
}
