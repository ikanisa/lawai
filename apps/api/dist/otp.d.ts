export declare function generateOtp(length?: number): string;
export declare function hashOtp(otp: string): Promise<string>;
export declare function verifyOtp(otp: string, hash: string): Promise<boolean>;
export declare const OTP_POLICY: {
    length: number;
    ttlMinutes: number;
    maxAttempts: number;
};
//# sourceMappingURL=otp.d.ts.map