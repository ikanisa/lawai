# Edge function authentication & testing

The edge workers now require a shared secret on every request. At least one of the
following environment variables must be populated at deploy time:

- `EDGE_FUNCTION_SECRET`
- `EDGE_SHARED_SECRET`
- `EDGE_SERVICE_SECRET`
- `EDGE_FUNCTION_SECRETS` / `EDGE_SHARED_SECRETS` / `EDGE_SERVICE_SECRETS` (comma separated list)

Requests must include the secret as either an `Authorization: Bearer <secret>` header or an
`X-Edge-Secret` header. When no secret is configured the handlers fall back to their original
behaviour for backwards compatibility, but production should always set a value.

## Running the automated checks

The package now ships a Vitest suite that shims the Deno runtime, loads each handler, and
verifies the authentication contract (401 without credentials, 200 with a valid secret).

```bash
pnpm --filter @apps/edge run test
```

The script first executes the existing Deno typecheck (skipping automatically when Deno is not
installed locally) and then runs the Vitest suite. No additional setup is required—the tests
inject the required secrets via the mocked Deno environment. The suite enables a temporary
`EDGE_FUNCTION_TEST_MODE` flag to bypass the heavy business logic after the authentication check;
leave that variable unset in any real deployment.

## Local manual smoke test

To send a manual request against a running worker, ensure the secret is present in the
environment and include it in the request headers, for example:

```bash
export EDGE_FUNCTION_SECRET="local-dev-secret"

curl -i \
  -H "Authorization: Bearer ${EDGE_FUNCTION_SECRET}" \
  https://<edge-endpoint>/process-learning
```

The response should be `401` if the header is omitted and `200` (or the handler-specific status)
when the credential is supplied.
