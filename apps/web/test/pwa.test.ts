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
  const originalEnv = process.env.NEXT_PUBLIC_ENABLE_PWA;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
    registerMock.mockClear();
    messageMock.mockClear();
    addEventListenerMock.mockClear();
    serviceWorkerRegistration.showNotification = vi.fn(() => Promise.resolve());

    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => (storage.has(key) ? storage.get(key)! : null)),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    } as unknown as Storage;

    vi.stubGlobal(
      'window',
      {
        localStorage: localStorageMock,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as Window & typeof globalThis,
    );

    const navigatorMock = {
      serviceWorker: {
        ready: Promise.resolve(serviceWorkerRegistration),
      },
    } as Navigator;

    vi.stubGlobal('navigator', navigatorMock);

    vi.stubGlobal('Notification', {
      requestPermission: vi.fn(async () => 'granted'),
    } as unknown as Notification);

    (window as any).navigator = navigatorMock;
    (window as any).Notification = globalThis.Notification;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = originalEnv;
    vi.unstubAllGlobals();
  });

  it('registers the service worker only once', async () => {
    const { registerPwa } = await import('../src/lib/pwa');
    registerPwa();
    registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('skips registration when disabled via env flag', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    const { registerPwa } = await import('../src/lib/pwa');
    registerPwa();

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('does not register during SSR execution', async () => {
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
    const { registerPwa } = await import('../src/lib/pwa');
    registerPwa();

    expect(registerMock).not.toHaveBeenCalled();
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
