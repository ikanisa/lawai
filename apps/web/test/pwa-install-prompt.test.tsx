import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Messages } from '@/lib/i18n';
import { PwaInstallPrompt } from '@/features/shell';

const promptInstallMock = vi.fn(async () => 'accepted' as const);
const dismissPromptMock = vi.fn();
const enableDigestMock = vi.fn(async () => true);
const setPreferenceMock = vi.fn();

vi.mock('../src/env.client', () => ({
  clientEnv: {
    NEXT_PUBLIC_ENABLE_PWA: true,
  },
}));

vi.mock('../src/features/platform/hooks/use-pwa-install', () => ({
  usePwaInstall: () => ({
    shouldPrompt: true,
    isAvailable: true,
    promptInstall: promptInstallMock,
    dismissPrompt: dismissPromptMock,
  }),
}));

vi.mock('../src/features/platform/hooks/use-pwa-preference', () => ({
  usePwaPreference: () => ({
    enabled: true,
    ready: true,
    setEnabled: setPreferenceMock,
  }),
}));

vi.mock('../src/features/platform/hooks/use-digest', () => ({
  useDigest: () => ({
    enabled: false,
    loading: false,
    enable: enableDigestMock,
  }),
}));

vi.mock('../src/features/platform/hooks/use-outbox', () => ({
  useOutbox: () => ({
    pendingCount: 2,
    hasItems: true,
    stalenessMs: 120_000,
  }),
}));

const telemetryMock = vi.fn();

vi.mock('../src/lib/api', () => ({
  sendTelemetryEvent: (...args: unknown[]) => telemetryMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PwaInstallPrompt', () => {
  beforeEach(() => {
    setPreferenceMock.mockReset();
  });

  it('renders release notes and handles actions', async () => {
    const user = userEvent.setup();
    const messages: Messages['app']['install'] = {
      title: 'Install Avocat-AI',
      body: 'Add the app to your home screen.',
      cta: 'Install app',
      dismiss: 'Later',
      success: 'Ready',
      snoozed: 'Soon',
      unavailable: 'Unavailable',
      optInToggle: 'Enable offline mode',
      optInDescription: 'Cache resources to stay ready offline.',
      optInEnabled: 'Offline ready',
      releaseNotes: {
        title: "What's new",
        items: ['Note A', 'Note B'],
        digestTitle: 'Alerts',
        digestDescription: 'Enable alerts bound to your profile.',
        digestCta: 'Enable alerts',
        digestEnabled: 'Alerts enabled',
        digestUnavailable: 'Alerts unavailable',
        releaseToggle: 'View notes',
        releaseToggleHide: 'Hide notes',
        outboxLabel: 'Offline queue',
        outboxEmpty: 'Empty',
      },
    };

    render(<PwaInstallPrompt messages={messages} locale="en" />);

    expect(screen.getByText('Install Avocat-AI')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /View notes/i });
    await user.click(toggle);
    expect(screen.getByText('Note A')).toBeInTheDocument();

    await user.click(screen.getByText('Install app'));
    expect(promptInstallMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Enable alerts'));
    expect(enableDigestMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Later'));
    expect(dismissPromptMock).toHaveBeenCalledTimes(1);

    expect(telemetryMock).toHaveBeenCalled();
  });
});
