import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../messages/en.json';
import type { Messages } from '../src/lib/i18n';
import { LaunchReadinessCard } from '../src/components/admin/launch-readiness-card';
import type { LaunchOfflineOutboxItem, LaunchReadinessSnapshot } from '@avocat-ai/shared';

const messages = messagesEn as Messages;

describe('LaunchReadinessCard', () => {
  const readiness: LaunchReadinessSnapshot = {
    orgId: 'org-1',
    readinessScore: 82,
    vitals: { total: 5, good: 3, needsImprovement: 1, poor: 1, lastSampleAt: '2024-02-01T00:00:00Z' },
    offlineOutbox: { queued: 2, syncing: 1, lastQueuedAt: '2024-02-01T08:00:00Z', oldestQueuedAt: '2024-01-31T22:00:00Z' },
    digests: { total: 2, weekly: 1, monthly: 1, lastCreatedAt: '2024-02-01T09:00:00Z' },
    collateral: { pilotOnboarding: 2, pricingPacks: 1, transparency: 3 },
    actions: [
      {
        id: 'core-web-vitals',
        label: 'Investigate poor Web Vitals',
        description: 'Review metrics',
        severity: 'warning',
        href: 'https://example.com',
      },
    ],
    notes: ['Pilot onboarding packs available: 2'],
  };

  const offlineItems: LaunchOfflineOutboxItem[] = [
    {
      id: 'offline-1',
      orgId: 'org-1',
      channel: 'message',
      label: 'Offline summary',
      locale: 'fr',
      status: 'queued',
      queuedAt: '2024-02-01T08:00:00Z',
      lastAttemptAt: null,
    },
  ];

  it('renders readiness metrics and actions', async () => {
    const onRefresh = vi.fn();
    const onQueueOffline = vi.fn();

    render(
      <LaunchReadinessCard
        readiness={readiness}
        offlineItems={offlineItems}
        isLoading={false}
        isRefreshing={false}
        onRefresh={onRefresh}
        onQueueOffline={onQueueOffline}
        messages={messages}
      />,
    );

    expect(screen.getByText(messages.admin.launchReadinessTitle)).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText(messages.admin.launchReadinessActionsTitle)).toBeInTheDocument();
    expect(screen.getByText('Investigate poor Web Vitals')).toBeInTheDocument();
    expect(screen.getByText('Offline summary')).toBeInTheDocument();

    const refreshButton = screen.getByRole('button', { name: messages.admin.launchReadinessRefresh });
    const queueButton = screen.getByRole('button', { name: messages.admin.launchReadinessAddOfflineSample });

    await userEvent.click(refreshButton);
    await userEvent.click(queueButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onQueueOffline).toHaveBeenCalledTimes(1);
  });

  it('shows fallback states when no data', () => {
    render(
      <LaunchReadinessCard
        readiness={null}
        offlineItems={[]}
        isLoading={false}
        isRefreshing={false}
        onRefresh={() => undefined}
        onQueueOffline={() => undefined}
        messages={messages}
      />,
    );

    expect(screen.getByText(messages.admin.launchReadinessActionFallback)).toBeInTheDocument();
    expect(screen.getByText(messages.admin.launchReadinessOfflineEmpty)).toBeInTheDocument();
  });
});
