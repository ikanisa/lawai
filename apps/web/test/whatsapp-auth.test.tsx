import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import messagesEn from '../messages/en.json';

import type { Messages } from '@/lib/i18n';
import { WhatsAppAuth } from '@/features/auth/components/whatsapp-auth';

const startWhatsAppOtpMock = vi.fn();
const verifyWhatsAppOtpMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/lib/api', () => ({
  DEMO_ORG_ID: '00000000-0000-0000-0000-000000000000',
  startWhatsAppOtp: startWhatsAppOtpMock,
  verifyWhatsAppOtp: verifyWhatsAppOtpMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

function renderAuth(messages: Messages) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WhatsAppAuth messages={messages} />
    </QueryClientProvider>,
  );
}

describe('WhatsAppAuth', () => {
  const messages = messagesEn as Messages;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid phone numbers before requesting OTP', async () => {
    const user = userEvent.setup();
    renderAuth(messages);

    const phoneInput = screen.getByPlaceholderText('+33612345678');
    await user.type(phoneInput, '123456');
    await user.click(screen.getByRole('button', { name: messages.auth.sendCode }));

    expect(startWhatsAppOtpMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(messages.auth.invalidPhone);
  });

  it('progresses to verification when OTP request succeeds', async () => {
    const user = userEvent.setup();
    startWhatsAppOtpMock.mockResolvedValueOnce({});

    renderAuth(messages);

    const phoneInput = screen.getByPlaceholderText('+33612345678');
    await user.clear(phoneInput);
    await user.type(phoneInput, '+33123456789');
    await user.click(screen.getByRole('button', { name: messages.auth.sendCode }));

    await waitFor(() => {
      expect(startWhatsAppOtpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+33123456789',
          orgId: '00000000-0000-0000-0000-000000000000',
        }),
      );
    });

    await screen.findByText(messages.auth.enterCodeTitle);
    expect(toastSuccessMock).toHaveBeenCalledWith(
      messages.auth.otpSent.replace('{phone}', '+33123456789'),
    );
  });

  it('verifies the OTP code and shows the session token', async () => {
    const user = userEvent.setup();
    startWhatsAppOtpMock.mockResolvedValueOnce({});
    verifyWhatsAppOtpMock.mockResolvedValueOnce({ session_token: 'session-123' });

    renderAuth(messages);

    const phoneInput = screen.getByPlaceholderText('+33612345678');
    await user.clear(phoneInput);
    await user.type(phoneInput, '+33987654321');
    await user.click(screen.getByRole('button', { name: messages.auth.sendCode }));

    await screen.findByText(messages.auth.enterCodeTitle);

    const otpInput = screen.getByPlaceholderText(messages.auth.otpPlaceholder);
    await user.type(otpInput, '123456');
    await user.click(screen.getByRole('button', { name: messages.auth.verifyCode }));

    await waitFor(() => {
      expect(verifyWhatsAppOtpMock).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '+33987654321',
          otp: '123456',
          orgHint: '00000000-0000-0000-0000-000000000000',
        }),
      );
    });

    await screen.findByText(messages.auth.success);
    await screen.findByText('session-123');
    expect(toastSuccessMock.mock.calls.at(-1)?.[0]).toBe(messages.auth.success);
  });

  it('surfaces an error when attempting verification without a code', async () => {
    const user = userEvent.setup();
    startWhatsAppOtpMock.mockResolvedValueOnce({});

    renderAuth(messages);

    const phoneInput = screen.getByPlaceholderText('+33612345678');
    await user.clear(phoneInput);
    await user.type(phoneInput, '+33611112222');
    await user.click(screen.getByRole('button', { name: messages.auth.sendCode }));

    await screen.findByText(messages.auth.enterCodeTitle);
    await user.click(screen.getByRole('button', { name: messages.auth.verifyCode }));

    expect(verifyWhatsAppOtpMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(messages.auth.invalidOtp);
  });
});
