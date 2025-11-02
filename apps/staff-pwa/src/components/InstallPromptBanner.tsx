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
        Ready offline
      </div>
      <p id={descriptionId}>
        Install the field staff PWA for fast access to shift logistics and to receive push alerts even when you are offline.
      </p>
      <div className="install-actions" role="group" aria-label="Install options">
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
          Install now
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent',
            color: '#f8fafc',
            border: '1px solid rgba(148, 163, 184, 0.4)',
            padding: '0.5rem 1.25rem',
            borderRadius: '9999px',
          }}
        >
          Maybe later
        </button>
      </div>
    </aside>
  );
}
