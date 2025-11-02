'use client';

import { useId, useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallPromptBanner() {
  const { canInstall, isInstalled, promptToInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const descriptionId = useId();

  if (!canInstall || dismissed) {
    return null;
  }

  return (
    <aside className="card install-banner" role="region" aria-labelledby="install-banner-heading" aria-describedby={descriptionId}>
      <div className="badge" id="install-banner-heading">
        Executive access
      </div>
      <p id={descriptionId}>
        Install the admin PWA to pin live compliance telemetry, queue deployments, and review incidents without leaving
        airplane mode.
      </p>
      <div role="group" aria-label="Install options" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            void promptToInstall().then((accepted) => {
              if (accepted || isInstalled) {
                setDismissed(true);
              }
            });
          }}
        >
          Install admin hub
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            color: '#f8fafc',
            border: '1px solid rgba(191, 219, 254, 0.5)',
            padding: '0.6rem 1.75rem',
            borderRadius: '9999px',
          }}
        >
          Remind me later
        </button>
      </div>
    </aside>
  );
}
