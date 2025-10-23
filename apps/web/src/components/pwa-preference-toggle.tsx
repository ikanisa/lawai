'use client';

import { Switch } from './ui/switch';
import { usePwaPreference } from '../hooks/use-pwa-preference';
import type { Messages } from '../lib/i18n';

interface PwaPreferenceToggleProps {
  messages?: NonNullable<Messages['app']['install']>['preference'];
  className?: string;
}

export function PwaPreferenceToggle({ messages, className }: PwaPreferenceToggleProps) {
  const { enabled, canToggle, setEnabled } = usePwaPreference();

  if (!messages) {
    return null;
  }

  const label = enabled ? messages.enabled ?? messages.label : messages.disabled ?? messages.label;
  const title = !canToggle ? messages.disabledHint ?? messages.label : messages.label;

  const handleClick = () => {
    if (!canToggle) {
      return;
    }
    setEnabled(!enabled);
  };

  return (
    <Switch
      checked={enabled}
      onClick={handleClick}
      aria-label={messages.label}
      title={title}
      disabled={!canToggle}
      label={label}
      className={className}
    />
  );
}

