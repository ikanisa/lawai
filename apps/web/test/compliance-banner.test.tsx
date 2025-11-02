import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import messagesEn from '../messages/en.json';

import type { Messages } from '@/lib/i18n';
import { ComplianceBanner } from '@/features/shell/components/compliance-banner';

const fetchComplianceStatusMock = vi.fn();
const acknowledgeComplianceMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/lib/api', () => ({
  DEMO_ORG_ID: '00000000-0000-0000-0000-000000000000',
  fetchComplianceStatus: fetchComplianceStatusMock,
  acknowledgeCompliance: acknowledgeComplianceMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

const complianceMessages = (messagesEn as Messages).app.compliance;

function renderBanner() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ComplianceBanner messages={complianceMessages} />
    </QueryClientProvider>,
  );
}

function buildStatus(overrides?: {
  consent?: Partial<Record<string, unknown>>;
  councilOfEurope?: Partial<Record<string, unknown>>;
}) {
  const consent = {
    requiredVersion: '2024.09',
    acknowledgedVersion: null,
    acknowledgedAt: null,
    satisfied: false,
    ...overrides?.consent,
  };

  const councilOfEurope = {
    requiredVersion: '2024.09',
    acknowledgedVersion: null,
    acknowledgedAt: null,
    satisfied: false,
    ...overrides?.councilOfEurope,
  };

  return {
    orgId: 'demo-org',
    userId: 'demo-user',
    acknowledgements: { consent, councilOfEurope },
    latest: null,
    history: [],
    totals: { total: 0, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 0 },
  };
}

const originalOnline = navigator.onLine;

afterAll(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: originalOnline });
});

describe('ComplianceBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  it('renders a loading state while compliance status resolves', async () => {
    fetchComplianceStatusMock.mockReturnValueOnce(new Promise(() => {}));

    renderBanner();

    expect(await screen.findByText(complianceMessages.loading)).toBeInTheDocument();
  });

  it('surfaced offline messaging when the status request fails offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    fetchComplianceStatusMock.mockRejectedValueOnce(new Error('network'));

    renderBanner();

    await screen.findByText(complianceMessages.errorTitle);
    expect(screen.getByText(complianceMessages.offline)).toBeInTheDocument();
  });

  it('confirms when all acknowledgements are already satisfied', async () => {
    fetchComplianceStatusMock.mockResolvedValueOnce(
      buildStatus({
        consent: { satisfied: true },
        councilOfEurope: { satisfied: true },
      }),
    );

    renderBanner();

    await screen.findByText(complianceMessages.clearTitle);
    expect(screen.getByText(complianceMessages.clearDescription)).toBeInTheDocument();
  });

  it('records pending acknowledgements and refreshes the status', async () => {
    fetchComplianceStatusMock
      .mockResolvedValueOnce(
        buildStatus({
          consent: { requiredVersion: '2024.10', satisfied: false },
          councilOfEurope: { requiredVersion: '2024.10', satisfied: false },
        }),
      )
      .mockResolvedValueOnce(
        buildStatus({
          consent: { requiredVersion: '2024.10', satisfied: true, acknowledgedVersion: '2024.10' },
          councilOfEurope: { requiredVersion: '2024.10', satisfied: true, acknowledgedVersion: '2024.10' },
        }),
      );
    acknowledgeComplianceMock.mockResolvedValueOnce({});

    const user = userEvent.setup();
    renderBanner();

    await screen.findByText(complianceMessages.title);
    await user.click(screen.getByRole('button', { name: complianceMessages.acknowledge }));

    await waitFor(() => {
      expect(acknowledgeComplianceMock).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000000',
        {
          consent: { type: 'ai_assist', version: '2024.10' },
          councilOfEurope: { version: '2024.10' },
        },
      );
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(complianceMessages.acknowledged);
    });

    await waitFor(() => {
      expect(fetchComplianceStatusMock).toHaveBeenCalledTimes(2);
    });
  });
});
