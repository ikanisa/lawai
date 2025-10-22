import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import messagesEn from '../messages/en.json';
import { setMockAppSession } from './utils/mock-session';

const fetchComplianceStatusMock = vi.fn();
const acknowledgeComplianceMock = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return {
    ...actual,
    fetchComplianceStatus: fetchComplianceStatusMock,
    acknowledgeCompliance: acknowledgeComplianceMock,
  };
});

const { ComplianceBanner } = await import('../src/components/compliance-banner');

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ComplianceBanner', () => {
  beforeEach(() => {
    fetchComplianceStatusMock.mockReset();
    acknowledgeComplianceMock.mockReset();
  });

  it('fetches compliance status for the active session', async () => {
    fetchComplianceStatusMock.mockResolvedValue({
      acknowledgements: {
        consent: { requiredVersion: 'v1', acknowledgedVersion: null, acknowledgedAt: null, satisfied: false },
        councilOfEurope: { requiredVersion: null, acknowledgedVersion: null, acknowledgedAt: null, satisfied: true },
      },
      latest: null,
      history: [],
      totals: { total: 0, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 1 },
    });

    renderWithClient(<ComplianceBanner messages={messagesEn.app.compliance} />);

    await waitFor(() => {
      expect(fetchComplianceStatusMock).toHaveBeenCalledWith('org-123', { userId: 'user-456' });
    });

    expect(
      await screen.findByText(messagesEn.app.compliance.consentRequired.replace('{version}', 'v1')),
    ).toBeInTheDocument();
  });

  it('passes the current user id when acknowledging compliance', async () => {
    fetchComplianceStatusMock.mockResolvedValue({
      acknowledgements: {
        consent: { requiredVersion: 'v2', acknowledgedVersion: null, acknowledgedAt: null, satisfied: false },
        councilOfEurope: { requiredVersion: null, acknowledgedVersion: null, acknowledgedAt: null, satisfied: true },
      },
      latest: null,
      history: [],
      totals: { total: 0, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 1 },
    });
    acknowledgeComplianceMock.mockResolvedValue({ ok: true });

    renderWithClient(<ComplianceBanner messages={messagesEn.app.compliance} />);

    const acknowledgeButton = await screen.findByRole('button', {
      name: messagesEn.app.compliance.acknowledge,
    });

    await userEvent.click(acknowledgeButton);

    await waitFor(() => {
      expect(acknowledgeComplianceMock).toHaveBeenCalledWith(
        'org-123',
        expect.objectContaining({ userId: 'user-456' }),
      );
    });
  });

  it('keeps pending acknowledgements isolated per user', async () => {
    fetchComplianceStatusMock.mockResolvedValueOnce({
      acknowledgements: {
        consent: { requiredVersion: 'v3', acknowledgedVersion: 'v3', acknowledgedAt: '2024-01-02', satisfied: true },
        councilOfEurope: { requiredVersion: null, acknowledgedVersion: null, acknowledgedAt: null, satisfied: true },
      },
      latest: null,
      history: [],
      totals: { total: 0, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 1 },
    });

    renderWithClient(<ComplianceBanner messages={messagesEn.app.compliance} />);

    expect(await screen.findByText(messagesEn.app.compliance.clearTitle)).toBeInTheDocument();

    fetchComplianceStatusMock.mockResolvedValueOnce({
      acknowledgements: {
        consent: { requiredVersion: 'v3', acknowledgedVersion: null, acknowledgedAt: null, satisfied: false },
        councilOfEurope: { requiredVersion: null, acknowledgedVersion: null, acknowledgedAt: null, satisfied: true },
      },
      latest: null,
      history: [],
      totals: { total: 0, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 1 },
    });

    setMockAppSession({ userId: 'user-789' });

    renderWithClient(<ComplianceBanner messages={messagesEn.app.compliance} />);

    await waitFor(() => {
      expect(fetchComplianceStatusMock).toHaveBeenLastCalledWith('org-123', { userId: 'user-789' });
    });

    expect(
      await screen.findByText(messagesEn.app.compliance.consentRequired.replace('{version}', 'v3')),
    ).toBeInTheDocument();
  });
});
