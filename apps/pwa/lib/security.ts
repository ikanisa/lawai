const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
const CSRF_COOKIE_NAME = '__Host-avocat-csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

let cachedToken: string | null = null;
let inFlight: Promise<string> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!entry) {
    return null;
  }
  return decodeURIComponent(entry.slice(name.length + 1));
}

async function requestToken(): Promise<string> {
  const response = await fetch('/api/security/csrf', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('csrf_token_unavailable');
  }
  const data = (await response.json()) as { token?: string };
  if (typeof data.token !== 'string' || data.token.length === 0) {
    throw new Error('csrf_token_invalid');
  }
  return data.token;
}

export async function ensureCsrfToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }
  const cookieToken = readCookie(CSRF_COOKIE_NAME);
  if (cookieToken) {
    cachedToken = cookieToken;
    return cookieToken;
  }
  if (!inFlight) {
    inFlight = requestToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export async function withCsrf(init: RequestInit = {}): Promise<RequestInit> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (SAFE_METHODS.has(method) || typeof window === 'undefined') {
    return init;
  }
  try {
    const token = await ensureCsrfToken();
    const headers = new Headers(init.headers ?? {});
    if (!headers.has(CSRF_HEADER_NAME) && token) {
      headers.set(CSRF_HEADER_NAME, token);
      if (!headers.has('x-requested-with')) {
        headers.set('x-requested-with', 'XMLHttpRequest');
      }
    }
    return { ...init, headers };
  } catch {
    return init;
  }
}
