import { API_BASE, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
let inFlightToken: Promise<string> | null = null;
let cachedToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const value = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  if (!value) {
    return null;
  }
  return decodeURIComponent(value.slice(name.length + 1));
}

async function requestCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/security/csrf`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('csrf_token_unavailable');
  }
  const body = (await response.json()) as { token?: string };
  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new Error('csrf_token_invalid');
  }
  return body.token;
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
  if (!inFlightToken) {
    inFlightToken = requestCsrfToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        inFlightToken = null;
      });
  }
  return inFlightToken;
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
