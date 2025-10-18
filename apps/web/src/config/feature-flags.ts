export const ADMIN_PANEL_FLAG = 'FEAT_ADMIN_PANEL';

type AdminPanelMode = 'enabled' | 'disabled';

function readFeatureFlag(): AdminPanelMode {
  const raw = process.env[ADMIN_PANEL_FLAG];
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? 'disabled' : 'enabled';
  }
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return 'enabled';
  }
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return 'disabled';
  }
  return process.env.NODE_ENV === 'production' ? 'disabled' : 'enabled';
}

export function isAdminPanelEnabled(): boolean {
  return readFeatureFlag() === 'enabled';
}

export function getAdminPanelMode(): AdminPanelMode {
  return readFeatureFlag();
}

export function getAdminEnvironmentLabel(): 'development' | 'staging' | 'production' {
  const env = process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  if (!env) return 'development';
  const normalized = env.toLowerCase();
  if (['production', 'prod'].includes(normalized)) return 'production';
  if (['preview', 'staging', 'stage', 'test'].includes(normalized)) return 'staging';
  return 'development';
}
