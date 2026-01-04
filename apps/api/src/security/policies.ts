import { randomBytes } from 'node:crypto';
// import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
export const CSRF_COOKIE_NAME = '__Host-avocat-csrf';
const CSRF_HEADER_CANDIDATES = ['x-csrf-token', 'x-xsrf-token', 'csrf-token'];

function isSecureCookie(): boolean {
  return process.env.NODE_ENV !== 'development';
}

function extractHeaderToken(request: FastifyRequest): string | null {
  for (const key of CSRF_HEADER_CANDIDATES) {
    const value = request.headers[key];
    if (!value) continue;
    if (Array.isArray(value)) {
      const token = value.find((entry) => typeof entry === 'string' && entry.length > 0);
      if (token) {
        return token;
      }
      continue;
    }
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  const query = request.query as Record<string, unknown> | undefined;
  if (query && typeof query === 'object') {
    for (const key of ['csrf-token', 'csrf', 'token']) {
      const value = query[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}

function hasSupabaseSession(request: FastifyRequest): boolean {
  const cookies = (request as any).cookies ?? {};
  for (const name of Object.keys(cookies)) {
    const normalized = name.toLowerCase();
    if (normalized.includes('supabase') || normalized.startsWith('sb-')) {
      return true;
    }
  }
  const header = request.headers.cookie;
  if (typeof header === 'string') {
    const lower = header.toLowerCase();
    return lower.includes('supabase') || lower.includes('sb-');
  }
  return false;
}

function shouldEnforceCsrf(request: FastifyRequest): boolean {
  if (SAFE_METHODS.has(request.method)) {
    return false;
  }
  if (request.headers.authorization || request.headers['x-service-secret']) {
    return false;
  }
  if (request.headers['x-api-key']) {
    return false;
  }
  return hasSupabaseSession(request);
}

function buildConnectSources(): string[] {
  const sources = new Set<string>();
  sources.add("'self'");
  sources.add('https://*.supabase.co');
  sources.add('https://*.supabase.in');
  if (env.SUPABASE_URL) {
    try {
      const supabaseOrigin = new URL(env.SUPABASE_URL).origin;
      sources.add(supabaseOrigin);
    } catch {
      // ignore malformed values
    }
  }
  if (env.OPENAI_CHATKIT_BASE_URL) {
    try {
      const chatkitOrigin = new URL(env.OPENAI_CHATKIT_BASE_URL).origin;
      sources.add(chatkitOrigin);
    } catch {
      sources.add(env.OPENAI_CHATKIT_BASE_URL);
    }
  }
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    try {
      const otlpOrigin = new URL(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).origin;
      sources.add(otlpOrigin);
    } catch {
      sources.add(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
    }
  }
  sources.add('https:');
  sources.add('wss:');
  return Array.from(sources).filter(Boolean);
}

function buildContentSecurityPolicy(): Record<string, string[]> {
  const scriptSrc = ["'self'"];
  if (process.env.NODE_ENV !== 'production') {
    scriptSrc.push("'unsafe-eval'");
  }
  scriptSrc.push("'unsafe-inline'");

  return {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    'font-src': ["'self'", 'data:'],
    'connect-src': buildConnectSources(),
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };
}

export function ensureCsrfCookie(request: FastifyRequest, reply: FastifyReply): string {
  const current = (request as any).cookies?.[CSRF_COOKIE_NAME];
  if (typeof current === 'string' && current.length > 0) {
    reply.header('x-csrf-token', current);
    return current;
  }
  const token = randomBytes(32).toString('base64url');
  /* reply.setCookie(CSRF_COOKIE_NAME, token, {
    path: '/',
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true,
  }); */
  reply.header('x-csrf-token', token);
  return token;
}

export async function registerSecurityPolicies(app: FastifyInstance): Promise<void> {
  await app.register(fastifyCookie, {
    parseOptions: {
      sameSite: 'strict',
      path: '/',
      secure: isSecureCookie(),
    },
  });

  const directives = buildContentSecurityPolicy();

  await app.register(helmet, {
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: { useDefaults: false, directives },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  app.addHook('onRequest', (request, reply, done) => {
    if (!shouldEnforceCsrf(request)) {
      done();
      return;
    }
    const cookieToken = (request as any).cookies?.[CSRF_COOKIE_NAME];
    const headerToken = extractHeaderToken(request);
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      reply.code(403).send({ error: 'csrf_token_invalid' });
      return;
    }
    done();
  });

  app.addHook('onSend', (request, reply, payload, done) => {
    if (SAFE_METHODS.has(request.method)) {
      ensureCsrfCookie(request, reply);
    }
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    done(null, payload);
  });
}
