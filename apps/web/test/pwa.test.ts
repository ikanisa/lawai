import { vi } from 'vitest';

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
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
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

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers the service worker only once', async () => {
    const { registerPwa, setPwaOptInPreference } = await import('../src/lib/pwa');
    setPwaOptInPreference(true);
    await registerPwa();
    await registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('enables digest notifications when permission granted', async () => {
    const { enableDigestNotifications, isDigestEnabled, setPwaOptInPreference } = await import('../src/lib/pwa');

    setPwaOptInPreference(true);

    const enabled = await enableDigestNotifications();

    expect(enabled).toBe(true);
    expect(serviceWorkerRegistration.showNotification).toHaveBeenCalledWith('Avocat-AI Francophone', expect.any(Object));
    expect(isDigestEnabled()).toBe(true);
  });

  it('returns false when notifications denied', async () => {
    const permissionMock = Notification.requestPermission as unknown as ReturnType<typeof vi.fn>;
    permissionMock.mockResolvedValueOnce('denied');
    const { enableDigestNotifications, setPwaOptInPreference } = await import('../src/lib/pwa');
    setPwaOptInPreference(true);
    const enabled = await enableDigestNotifications();
    expect(enabled).toBe(false);
  });

  it('skips registration when the environment flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    const { registerPwa, setPwaOptInPreference } = await import('../src/lib/pwa');
    setPwaOptInPreference(true);
    const result = registerPwa();
    expect(result).toBeNull();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('does not register during server-side rendering', async () => {
    const { registerPwa, setPwaOptInPreference } = await import('../src/lib/pwa');
    setPwaOptInPreference(true);
    vi.stubGlobal('window', undefined);
    const result = registerPwa();
    expect(result).toBeNull();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('requires pwa opt-in for digest notifications', async () => {
    const { enableDigestNotifications } = await import('../src/lib/pwa');
    const enabled = await enableDigestNotifications();
    expect(enabled).toBe(false);
  });
});
