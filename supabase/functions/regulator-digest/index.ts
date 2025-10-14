// Supabase Edge Function: regulator-digest
// Scheduled to run daily at 06:00 UTC with configurable day window payload.
// Placeholder implementation logging the request and returning acknowledgement.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

interface DigestPayload {
  jurisdiction?: string
  channel?: 'email' | 'slack' | 'teams'
  frequency?: 'weekly' | 'monthly'
  recipients?: string[]
  topics?: string[]
  days?: number
  [key: string]: unknown
}

const FUNCTION_NAME = "regulator-digest"
const API_BASE_URL = Deno.env.get('API_BASE_URL') ?? 'http://host.docker.internal:3333'
const ORG_ID = Deno.env.get('REGULATOR_DIGEST_ORG_ID') ?? '00000000-0000-0000-0000-000000000000'
const USER_ID = Deno.env.get('REGULATOR_DIGEST_USER_ID') ?? '00000000-0000-0000-0000-000000000000'
const SERVICE_TOKEN = Deno.env.get('REGULATOR_DIGEST_API_TOKEN') ?? null

function normaliseRecipients(input: DigestPayload['recipients']): string[] {
  if (!Array.isArray(input)) {
    return ['regulator@example.com']
  }
  const emails = input.filter((value) => typeof value === 'string' && value.includes('@'))
  return emails.length > 0 ? emails : ['regulator@example.com']
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 })
  }

  const invokedAt = new Date().toISOString()

  let payload: DigestPayload | null = null
  try {
    const text = await req.text()
    payload = text ? JSON.parse(text) as DigestPayload : null
  } catch (error) {
    console.warn(`[${FUNCTION_NAME}] Failed to parse payload`, error)
  }

  const requestBody = {
    jurisdiction: payload?.jurisdiction ?? 'unspecified',
    channel: payload?.channel === 'slack' || payload?.channel === 'teams' ? payload.channel : 'email',
    frequency: payload?.frequency === 'monthly' ? 'monthly' : 'weekly',
    recipients: normaliseRecipients(payload?.recipients),
    topics: Array.isArray(payload?.topics) ? payload?.topics.filter((value) => typeof value === 'string') : undefined,
  }

  let responseJson: unknown = null
  let status: 'queued' | 'error' = 'queued'

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/launch/digests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': ORG_ID,
        'x-user-id': USER_ID,
        ...(SERVICE_TOKEN ? { Authorization: `Bearer ${SERVICE_TOKEN}` } : {}),
      },
      body: JSON.stringify(requestBody),
    })

    if (!apiResponse.ok) {
      status = 'error'
      responseJson = await apiResponse.text()
      console.error(`[${FUNCTION_NAME}] API request failed`, apiResponse.status, responseJson)
    } else {
      responseJson = await apiResponse.json()
    }
  } catch (error) {
    status = 'error'
    responseJson = { message: 'fetch_failed', error: error instanceof Error ? error.message : String(error) }
    console.error(`[${FUNCTION_NAME}] Failed to dispatch digest`, error)
  }

  const responseBody = {
    status,
    function: FUNCTION_NAME,
    invokedAt,
    payload,
    request: requestBody,
    apiBaseUrl: API_BASE_URL,
    orgId: ORG_ID,
    userId: USER_ID,
    response: responseJson,
  }

  return new Response(JSON.stringify(responseBody), {
    headers: { "Content-Type": "application/json" },
    status: status === 'error' ? 502 : 200,
  })
})
