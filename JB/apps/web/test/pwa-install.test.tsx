import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, useEffect } from 'react';
import { PwaInstallProvider, usePwaInstall } from '../src/hooks/use-pwa-install';

function InstallConsumer() {
  const { shouldPrompt, registerSuccess, promptInstall } = usePwaInstall();

  useEffect(() => {
    // reset prompt state when rendered to avoid stale storage between tests
    return () => {
      window.localStorage.removeItem('avocat-ai.install.count');
      window.localStorage.removeItem('avocat-ai.install.snoozeUntil');
    };
  }, []);

  return (
    <div>
      <span data-testid="status">{shouldPrompt ? 'prompt' : 'idle'}</span>
      <button onClick={registerSuccess}>register</button>
      <button
        onClick={() => {
          void promptInstall();
        }}
      >
        install
      </button>
    </div>
  );
}

describe('PwaInstallProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('surfaces prompt after threshold successes and resolves install flow', async () => {
    const user = userEvent.setup();
    render(
      <PwaInstallProvider>
        <InstallConsumer />
      </PwaInstallProvider>,
    );

    const status = screen.getByTestId('status');
    expect(status.textContent).toBe('idle');

    const beforeInstallPrompt = new Event('beforeinstallprompt') as any;
    beforeInstallPrompt.preventDefault = vi.fn();
    beforeInstallPrompt.prompt = vi.fn().mockResolvedValue(undefined);
    beforeInstallPrompt.userChoice = Promise.resolve({ outcome: 'accepted' });

    await act(async () => {
      window.dispatchEvent(beforeInstallPrompt);
    });

    const registerButton = screen.getByText('register');
    await act(async () => {
      await user.click(registerButton);
      await user.click(registerButton);
    });

    expect(await screen.findByText('prompt')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByText('install'));
    });

    expect(beforeInstallPrompt.prompt).toHaveBeenCalled();
    expect(await screen.findByText('idle')).toBeInTheDocument();
  });
});
