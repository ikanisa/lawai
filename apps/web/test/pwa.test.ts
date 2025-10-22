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
  let localStorageStore: Record<string, string>;

  beforeEach(() => {
    vi.resetModules();
    registerMock.mockClear();
    messageMock.mockClear();
    addEventListenerMock.mockClear();
    serviceWorkerRegistration.showNotification = vi.fn(() => Promise.resolve());

    localStorageStore = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => (key in localStorageStore ? localStorageStore[key] : null)),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
      key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
      get length() {
        return Object.keys(localStorageStore).length;
      },
    } satisfies Storage;

    const navigatorStub = {
      serviceWorker: {
        ready: Promise.resolve(serviceWorkerRegistration),
      },
    } as unknown as Navigator;

    const notificationStub = {
      requestPermission: vi.fn(async () => 'granted'),
    } as unknown as Notification;

    vi.stubGlobal(
      'window',
      {
        localStorage: localStorageMock,
        navigator: navigatorStub,
        Notification: notificationStub,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as Window & typeof globalThis,
    );

    vi.stubGlobal('navigator', navigatorStub);

    vi.stubGlobal('Notification', notificationStub);

    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_ENABLE_PWA;
  });

  it('registers the service worker only once when opt-in enabled', async () => {
    const { registerPwa, setPwaPreference } = await import('../src/lib/pwa');

    setPwaPreference(true);
    registerPwa();
    registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('skips registration when the environment flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    const { registerPwa, setPwaPreference } = await import('../src/lib/pwa');

    setPwaPreference(true);
    registerPwa();

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('skips registration when the user opts out', async () => {
    const { registerPwa, setPwaPreference } = await import('../src/lib/pwa');

    setPwaPreference(false);
    registerPwa();

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('does not register during SSR', async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';

    const { registerPwa } = await import('../src/lib/pwa');
    registerPwa();

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('enables digest notifications when permission granted', async () => {
    const { enableDigestNotifications, isDigestEnabled, PWA_OPT_IN_STORAGE_KEY } = await import('../src/lib/pwa');

    const enabled = await enableDigestNotifications();

    expect(enabled).toBe(true);
    expect(serviceWorkerRegistration.showNotification).toHaveBeenCalledWith(
      'Avocat-AI Francophone',
      expect.any(Object),
    );
    expect(isDigestEnabled()).toBe(true);
    expect(localStorageStore[PWA_OPT_IN_STORAGE_KEY]).toBe('true');
  });

  it('returns false when notifications denied', async () => {
    const permissionMock = Notification.requestPermission as unknown as ReturnType<typeof vi.fn>;
    permissionMock.mockResolvedValueOnce('denied');
    const { enableDigestNotifications } = await import('../src/lib/pwa');
    const enabled = await enableDigestNotifications();
    expect(enabled).toBe(false);
  });
});
