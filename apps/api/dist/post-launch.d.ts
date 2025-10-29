import { type LaunchOfflineOutboxItem, type LaunchOfflineStatus, type LaunchReadinessSnapshot } from '@avocat-ai/shared';
export declare function enqueueOfflineOutboxItem(input: Omit<LaunchOfflineOutboxItem, 'id' | 'queuedAt' | 'status' | 'lastAttemptAt'> & Partial<Pick<LaunchOfflineOutboxItem, 'status' | 'queuedAt' | 'lastAttemptAt'>>): LaunchOfflineOutboxItem;
export declare function updateOfflineOutboxStatus(orgId: string, itemId: string, status: LaunchOfflineStatus, attemptAt?: string): LaunchOfflineOutboxItem | null;
export declare function listOfflineOutboxItems(orgId: string): LaunchOfflineOutboxItem[];
export declare function buildPhaseEReadiness(orgId: string): LaunchReadinessSnapshot;
export declare function __resetPostLaunchStateForTests(): void;
//# sourceMappingURL=post-launch.d.ts.map