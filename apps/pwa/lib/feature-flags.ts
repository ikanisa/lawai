const rawFlags = {
  FEAT_AGENT_SHELL: process.env.NEXT_PUBLIC_FEAT_AGENT_SHELL,
  FEAT_VOICE_REALTIME: process.env.NEXT_PUBLIC_FEAT_VOICE_REALTIME,
  DRIVE_INGESTION_ENABLED: process.env.NEXT_PUBLIC_DRIVE_INGESTION_ENABLED,
} as const;

type FlagKey = keyof typeof rawFlags;

type FlagMap = Record<FlagKey, boolean>;

function parseFlag(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return ["1", "true", "enabled", "on"].includes(value.toLowerCase());
}

const defaults: Record<FlagKey, boolean> = {
  FEAT_AGENT_SHELL: true,
  FEAT_VOICE_REALTIME: false,
  DRIVE_INGESTION_ENABLED: false,
};

const resolvedFlags: FlagMap = {
  FEAT_AGENT_SHELL: parseFlag(rawFlags.FEAT_AGENT_SHELL, defaults.FEAT_AGENT_SHELL),
  FEAT_VOICE_REALTIME: parseFlag(rawFlags.FEAT_VOICE_REALTIME, defaults.FEAT_VOICE_REALTIME),
  DRIVE_INGESTION_ENABLED: parseFlag(
    rawFlags.DRIVE_INGESTION_ENABLED,
    defaults.DRIVE_INGESTION_ENABLED,
  ),
};

export type FeatureFlag = FlagKey;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return resolvedFlags[flag];
}

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return isFeatureEnabled(flag);
}

export const featureFlags = resolvedFlags;
