import { vi } from 'vitest';

const {
  serviceWorkerRegistration,
  registerMock,
  messageMock,
  addEventListenerMock,
  workboxConstructorMock,
} = vi.hoisted(() => {
  const registration = {
    showNotification: vi.fn(() => Promise.resolve()),
  } as unknown as ServiceWorkerRegistration;

  const registerMock = vi.fn(() => Promise.resolve(registration));
  const messageMock = vi.fn(() => Promise.resolve());
  const addEventListenerMock = vi.fn();
  const workboxConstructorMock = vi.fn(() => ({
    addEventListener: addEventListenerMock,
    register: registerMock,
    messageSW: messageMock,
  }));

  return {
    serviceWorkerRegistration: registration,
    registerMock,
    messageMock,
    addEventListenerMock,
    workboxConstructorMock,
  };
});

vi.mock('workbox-window', () => ({
  Workbox: workboxConstructorMock,
}));

describe('pwa utilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    registerMock.mockClear();
    messageMock.mockClear();
    addEventListenerMock.mockClear();
    workboxConstructorMock.mockClear();
    serviceWorkerRegistration.showNotification = vi.fn(() => Promise.resolve());

    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve(serviceWorkerRegistration),
      },
    });

    vi.stubGlobal('Notification', {
      requestPermission: vi.fn(async () => 'granted'),
    } as unknown as Notification);

    process.env = { ...originalEnv, NEXT_PUBLIC_ENABLE_PWA: 'true' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it('registers the service worker only once', async () => {
    const { registerPwa } = await import('../src/lib/pwa');
    registerPwa();
    registerPwa();

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

  it('does not register the service worker when the feature flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    const { registerPwa, isPwaFeatureEnabled } = await import('../src/lib/pwa');

    registerPwa();

    expect(isPwaFeatureEnabled()).toBe(false);
    expect(workboxConstructorMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('clears any cached registration promise when the feature flag toggles off', async () => {
    const { registerPwa } = await import('../src/lib/pwa');
    registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);

    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);

    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
    registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(2);
  });
});
