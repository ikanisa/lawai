import { vi } from 'vitest';

const originalEnv = process.env.NEXT_PUBLIC_ENABLE_PWA;

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

vi.mock(
  'workbox-window',
  () => ({
    Workbox: workboxConstructorMock,
  }),
  { virtual: true },
);

describe('pwa utilities', () => {
  let localStorageStore: Record<string, string>;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
    registerMock.mockClear();
    messageMock.mockClear();
    addEventListenerMock.mockClear();
    workboxConstructorMock.mockClear();
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
    if (typeof originalEnv === 'string') {
      process.env.NEXT_PUBLIC_ENABLE_PWA = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ENABLE_PWA;
    }
  });

  it('registers the service worker only once when opt-in enabled', async () => {
    const { registerPwa, setPwaOptInPreference } = await import('../src/lib/pwa');

    setPwaOptInPreference(true);

    await registerPwa();
    await registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('does not register during SSR execution', async () => {
    vi.unstubAllGlobals();
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
    const { registerPwa } = await import('../src/lib/pwa');
    registerPwa();

    expect(registerMock).not.toHaveBeenCalled();
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
    const {
      enableDigestNotifications,
      isDigestEnabled,
      PWA_OPT_IN_STORAGE_KEY,
      setPwaOptInPreference,
    } = await import('../src/lib/pwa');

    setPwaOptInPreference(true);

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

  it('does not register the service worker when the feature flag is disabled', async () => {
    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    const { registerPwa, isPwaFeatureEnabled, grantPwaConsent } = await import('../src/lib/pwa');

    grantPwaConsent();
    await registerPwa();

    expect(isPwaFeatureEnabled()).toBe(false);
    expect(workboxConstructorMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('clears any cached registration promise when the feature flag toggles off', async () => {
    const { registerPwa, grantPwaConsent } = await import('../src/lib/pwa');
    grantPwaConsent();
    await registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);

    process.env.NEXT_PUBLIC_ENABLE_PWA = 'false';
    await registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);

    process.env.NEXT_PUBLIC_ENABLE_PWA = 'true';
    await registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(2);
  });

  it('does not register the service worker when user consent is missing', async () => {
    const { registerPwa } = await import('../src/lib/pwa');

    await registerPwa();

    expect(workboxConstructorMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('registers the service worker when notifications are unavailable but service workers are supported', async () => {
    const {
      registerPwa,
      hasPwaConsent,
      canRegisterPwaWithoutStoredConsent,
    } = await import('../src/lib/pwa');

    expect(hasPwaConsent()).toBe(false);

    Reflect.deleteProperty(globalThis as Record<string, unknown>, 'Notification');
    Reflect.deleteProperty(window as Record<string, unknown>, 'Notification');

    expect(canRegisterPwaWithoutStoredConsent()).toBe(true);

    await registerPwa();

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(hasPwaConsent()).toBe(true);
  });

  it('warns when the browser does not support service workers', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { registerPwa, grantPwaConsent } = await import('../src/lib/pwa');

    grantPwaConsent();
    vi.stubGlobal('navigator', {} as Navigator);

    await registerPwa();

    expect(warnSpy).toHaveBeenCalledWith('pwa_registration_unsupported_browser', {
      reason: 'service_worker_unavailable',
    });
    warnSpy.mockRestore();
  });
});
