// Supabase Edge Function: regulator-digest
// Scheduled to run daily at 06:00 UTC with configurable day window payload.
// Placeholder implementation logging the request and returning acknowledgement.

interface DigestPayload {
  days?: number
  [key: string]: unknown
}

const FUNCTION_NAME = "regulator-digest"

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

  const days = payload?.days ?? 0
  console.log(`[${FUNCTION_NAME}] Invocation (days=${days}) at ${invokedAt}`, payload)

  const responseBody = {
    status: "ok",
    function: FUNCTION_NAME,
    invokedAt,
    days,
    payload,
    note: "Replace placeholder logic with regulator digest generation.",
  }

  return new Response(JSON.stringify(responseBody), {
    headers: { "Content-Type": "application/json" },
  })
})
