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
});
