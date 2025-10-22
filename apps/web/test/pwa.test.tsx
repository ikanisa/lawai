import React, { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const {
  serviceWorkerRegistration,
  registerMock,
  messageMock,
  addEventListenerMock,
} = vi.hoisted(() => {
  const registration = {
    showNotification: vi.fn(() => Promise.resolve()),
  } as unknown as ServiceWorkerRegistration;

  return {
    serviceWorkerRegistration: registration,
    registerMock: vi.fn(() => Promise.resolve(registration)),
    messageMock: vi.fn(() => Promise.resolve()),
    addEventListenerMock: vi.fn(),
  };
});

vi.mock('workbox-window', () => ({
  Workbox: vi.fn(() => ({
    addEventListener: addEventListenerMock,
    register: registerMock,
    messageSW: messageMock,
  })),
}));

describe('pwa utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    registerMock.mockClear();
    messageMock.mockClear();
    addEventListenerMock.mockClear();
    serviceWorkerRegistration.showNotification = vi.fn(() => Promise.resolve());

    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(serviceWorkerRegistration),
      },
    });

    vi.stubGlobal('Notification', {
      requestPermission: vi.fn(async () => 'granted'),
    } as unknown as Notification);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the service worker only once', async () => {
    const { registerPwa } = await import('../src/lib/pwa');
    await registerPwa();
    await registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('enables digest notifications when permission granted', async () => {
    const { enableDigestNotifications, isDigestEnabled } = await import('../src/lib/pwa');

    const enabled = await enableDigestNotifications();

    expect(enabled).toBe(true);
    expect(serviceWorkerRegistration.showNotification).toHaveBeenCalledWith('Avocat-AI Francophone', expect.any(Object));
    expect(isDigestEnabled()).toBe(true);
  });

  it('returns false when notifications denied', async () => {
    const permissionMock = Notification.requestPermission as unknown as ReturnType<typeof vi.fn>;
    permissionMock.mockResolvedValueOnce('denied');
    const { enableDigestNotifications } = await import('../src/lib/pwa');
    const enabled = await enableDigestNotifications();
    expect(enabled).toBe(false);
  });
});

describe('AppProviders PWA flag', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.doUnmock('../src/lib/pwa');
    vi.doUnmock('@tanstack/react-query');
    vi.doUnmock('next-themes');
    vi.doUnmock('sonner');
    delete process.env.NEXT_PUBLIC_ENABLE_PWA;
  });

  it('registers PWA after opt-in when enabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
    const registerSpy = vi.fn();

    vi.doMock('../src/lib/pwa', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/pwa')>('../src/lib/pwa');
      return {
        ...actual,
        registerPwa: registerSpy,
      };
    });

    vi.doMock('@tanstack/react-query', () => ({
      QueryClient: class QueryClient {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_: unknown) {}
      },
      QueryClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    }));

    vi.doMock('next-themes', () => ({
      ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    }));

    vi.doMock('sonner', () => ({
      Toaster: () => null,
    }));

    const { AppProviders } = await import('../src/components/providers');
    const { PWA_REGISTRATION_EVENT } = await import('../src/lib/pwa');

    render(
      <AppProviders>
        <div>child</div>
      </AppProviders>,
    );

    window.dispatchEvent(new Event(PWA_REGISTRATION_EVENT));

    expect(registerSpy).toHaveBeenCalledTimes(1);
  });

  it('skips registration when the PWA flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    const registerSpy = vi.fn();

    vi.doMock('../src/lib/pwa', async () => {
      const actual = await vi.importActual<typeof import('../src/lib/pwa')>('../src/lib/pwa');
      return {
        ...actual,
        registerPwa: registerSpy,
      };
    });

    vi.doMock('@tanstack/react-query', () => ({
      QueryClient: class QueryClient {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        constructor(_: unknown) {}
      },
      QueryClientProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    }));

    vi.doMock('next-themes', () => ({
      ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    }));

    vi.doMock('sonner', () => ({
      Toaster: () => null,
    }));

    const { AppProviders } = await import('../src/components/providers');
    const { PWA_REGISTRATION_EVENT } = await import('../src/lib/pwa');

    render(
      <AppProviders>
        <div>child</div>
      </AppProviders>,
    );

    window.dispatchEvent(new Event(PWA_REGISTRATION_EVENT));

    expect(registerSpy).not.toHaveBeenCalled();
  });
});
