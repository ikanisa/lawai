type EdgeHandler = Parameters<typeof Deno.serve>[0];
type EdgeServeOptions = Parameters<typeof Deno.serve>[1];

const SINGLE_SECRET_KEYS = [
  'EDGE_FUNCTION_SECRET',
  'EDGE_SERVICE_SECRET',
  'EDGE_SHARED_SECRET',
] as const;

const MULTI_SECRET_KEYS = [
  'EDGE_FUNCTION_SECRETS',
  'EDGE_SERVICE_SECRETS',
  'EDGE_SHARED_SECRETS',
] as const;

function normalize(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSecrets(): string[] {
  const secrets = new Set<string>();

  for (const key of SINGLE_SECRET_KEYS) {
    const value = normalize(Deno.env.get(key));
    if (value) secrets.add(value);
  }

  for (const key of MULTI_SECRET_KEYS) {
    const value = normalize(Deno.env.get(key));
    if (!value) continue;
    for (const secret of value.split(',').map((entry) => entry.trim())) {
      if (secret.length > 0) secrets.add(secret);
    }
  }

  return Array.from(secrets);
}

function extractCredential(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const [scheme, token] = authHeader.split(/\s+/);
    if (scheme?.toLowerCase() === 'bearer' && token && token.trim().length > 0) {
      return token.trim();
    }
  }

  const headerSecret = normalize(request.headers.get('x-edge-secret'));
  if (headerSecret) {
    return headerSecret;
  }

  return null;
}

function isTestBypass(request: Request): boolean {
  const mode = normalize(Deno.env.get('EDGE_FUNCTION_TEST_MODE'));
  if (!mode) return false;
  if (!['1', 'true', 'yes'].includes(mode.toLowerCase())) {
    return false;
  }
  const flag = normalize(request.headers.get('x-edge-test-auth-only'));
  return Boolean(flag && flag.toLowerCase() !== 'false' && flag !== '0');
}

export function withEdgeAuth(handler: EdgeHandler): EdgeHandler {
  return async (request, info) => {
    const secrets = parseSecrets();
    if (secrets.length > 0) {
      const credential = extractCredential(request);
      if (!credential || !secrets.includes(credential)) {
        return new Response('missing_or_invalid_edge_secret', { status: 401 });
      }
    }

    if (isTestBypass(request)) {
      return new Response('edge_auth_ok', { status: 200 });
    }

    return handler(request, info);
  };
}

export function serveEdgeFunction(handler: EdgeHandler, options?: EdgeServeOptions) {
  return Deno.serve(withEdgeAuth(handler), options as EdgeServeOptions);
}
