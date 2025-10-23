import { fetchChatkitSession, type ChatkitSessionRecord } from './api';

export type ChatkitTransport = 'sse' | 'webrtc';

export interface ChatkitConnectionHandlers {
  onEvent?: (event: MessageEvent<string>) => void;
  onError?: (event: Event) => void;
}

export interface ChatkitConnectionOptions extends ChatkitConnectionHandlers {
  session: ChatkitSessionRecord;
  transport?: ChatkitTransport;
  requireSecret?: boolean;
}

export interface ChatkitConnection {
  transport: ChatkitTransport;
  close: () => void;
}

interface SecretCacheEntry {
  secret: string;
  expiresAt?: string | null;
}

const secretCache = new Map<string, SecretCacheEntry>();

function assertBrowserContext() {
  if (typeof window === 'undefined') {
    throw new Error('ChatKit client is only available in the browser environment');
  }
}

function createMessageEvent(data: string, origin: string | null): MessageEvent<string> {
  return {
    data,
    origin: origin ?? '',
    lastEventId: '',
    type: 'message',
    ports: [],
    source: null,
    bubbles: false,
    cancelBubble: false,
    cancelable: false,
    composed: false,
    currentTarget: null,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: true,
    returnValue: true,
    srcElement: null,
    target: null,
    timeStamp: Date.now(),
    initEvent: () => {},
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
    stopPropagation: () => {},
  } as MessageEvent<string>;
}

export class ChatkitClient {
  private cacheSecret(session: ChatkitSessionRecord) {
    const secret = session.chatkit?.clientSecret;
    if (secret) {
      secretCache.set(session.id, {
        secret,
        expiresAt: session.chatkit?.clientSecretExpiresAt ?? null,
      });
    }
  }

  private readCachedSecret(sessionId: string): string | null {
    const entry = secretCache.get(sessionId);
    if (!entry) {
      return null;
    }
    if (!entry.expiresAt) {
      return entry.secret;
    }
    const expiry = new Date(entry.expiresAt).getTime();
    if (Number.isNaN(expiry) || expiry > Date.now()) {
      return entry.secret;
    }
    secretCache.delete(sessionId);
    return null;
  }

  private async ensureSecret(
    session: ChatkitSessionRecord,
    includeSecret: boolean,
  ): Promise<string | null> {
    if (session.chatkit?.clientSecret) {
      this.cacheSecret(session);
      return session.chatkit.clientSecret;
    }

    const cached = this.readCachedSecret(session.id);
    if (cached) {
      return cached;
    }

    if (!includeSecret) {
      return null;
    }

    const refreshed = await fetchChatkitSession(session.id, { includeSecret: true });
    if (refreshed.chatkit?.clientSecret) {
      this.cacheSecret(refreshed);
      return refreshed.chatkit.clientSecret;
    }

    return null;
  }

  private createSseConnection(
    session: ChatkitSessionRecord,
    secret: string | null,
    handlers: ChatkitConnectionHandlers,
  ): ChatkitConnection {
    assertBrowserContext();
    if (!('EventSource' in window)) {
      throw new Error('EventSource is not available in this browser');
    }

    const streamUrl = session.chatkit?.url;
    if (!streamUrl) {
      throw new Error('ChatKit session is missing a streaming URL');
    }

    const target = new URL(streamUrl);
    if (secret) {
      target.searchParams.set('client_secret', secret);
    }

    const source = new EventSource(target.toString());

    if (handlers.onEvent) {
      source.onmessage = (event) => {
        handlers.onEvent?.(event as MessageEvent<string>);
      };
    }

    if (handlers.onError) {
      source.onerror = (event) => {
        handlers.onError?.(event);
      };
    }

    return {
      transport: 'sse',
      close: () => {
        source.close();
      },
    };
  }

  private async createWebRtcConnection(
    session: ChatkitSessionRecord,
    secret: string | null,
    handlers: ChatkitConnectionHandlers,
  ): Promise<ChatkitConnection> {
    assertBrowserContext();
    if (!('RTCPeerConnection' in window)) {
      throw new Error('WebRTC is not supported in this browser');
    }

    if (!session.chatkit?.url) {
      throw new Error('ChatKit session is missing a WebRTC signalling endpoint');
    }

    if (!secret) {
      throw new Error('A client secret is required for WebRTC transport');
    }

    const peer = new RTCPeerConnection();
    const channel = peer.createDataChannel('chatkit');

    if (handlers.onEvent) {
      channel.addEventListener('message', (event) => {
        const synthetic = createMessageEvent(String(event.data ?? ''), session.chatkit?.url ?? null);
        handlers.onEvent?.(synthetic);
      });
    }

    if (handlers.onError) {
      peer.addEventListener('iceconnectionstatechange', () => {
        if (peer.iceConnectionState === 'failed') {
          handlers.onError?.(new Event('error'));
        }
      });
      channel.addEventListener('error', (event) => {
        handlers.onError?.(event);
      });
    }

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    const response = await fetch(session.chatkit.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ sdp: offer.sdp, type: offer.type }),
    });

    if (!response.ok) {
      throw new Error('Unable to negotiate ChatKit WebRTC session');
    }

    const answer = (await response.json()) as RTCSessionDescriptionInit;
    if (!answer?.sdp) {
      throw new Error('ChatKit signalling server returned an invalid answer');
    }

    await peer.setRemoteDescription(answer);

    return {
      transport: 'webrtc',
      close: () => {
        try {
          channel.close();
        } catch (error) {
          console.warn('chatkit_webrtc_channel_close_failed', error);
        }
        peer.close();
      },
    };
  }

  async connect(options: ChatkitConnectionOptions): Promise<ChatkitConnection> {
    const transport = options.transport ?? 'sse';
    const requireSecret = options.requireSecret ?? transport === 'webrtc';
    const secret = await this.ensureSecret(options.session, requireSecret);

    if (transport === 'webrtc') {
      return this.createWebRtcConnection(options.session, secret, options);
    }

    return this.createSseConnection(options.session, secret, options);
  }
}
