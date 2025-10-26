import { serverEnv } from '../env.server';

export const ADMIN_PANEL_FLAG = 'FEAT_ADMIN_PANEL';

type AdminPanelMode = 'enabled' | 'disabled';

function readFeatureFlag(): AdminPanelMode {
  const raw = serverEnv.FEAT_ADMIN_PANEL;
  if (!raw) {
    return serverEnv.NODE_ENV === 'production' ? 'disabled' : 'enabled';
  }
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return 'enabled';
  }
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return 'disabled';
  }
  return serverEnv.NODE_ENV === 'production' ? 'disabled' : 'enabled';
}

export function isAdminPanelEnabled(): boolean {
  return readFeatureFlag() === 'enabled';
}

export function getAdminPanelMode(): AdminPanelMode {
  return readFeatureFlag();
}

export function getAdminEnvironmentLabel(): 'development' | 'staging' | 'production' {
  const env = serverEnv.APP_ENV ?? serverEnv.DEPLOY_ENV ?? serverEnv.NODE_ENV;
  if (!env) return 'development';
  const normalized = env.toLowerCase();
  if (['local', 'development', 'dev'].includes(normalized)) return 'development';
  if (['production', 'prod'].includes(normalized)) return 'production';
  if (['preview', 'staging', 'stage', 'test'].includes(normalized)) return 'staging';
  return 'development';
}
