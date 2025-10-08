// Supabase Edge Function: process-learning
// Scheduled hourly and nightly with different payload args (see supabase/config.toml).
// Placeholder implementation that logs mode and returns acknowledgement.

type SchedulePayload = {
  mode?: string
  [key: string]: unknown
}

const FUNCTION_NAME = "process-learning"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 })
  }

  const invokedAt = new Date().toISOString()

  let payload: SchedulePayload | null = null
  try {
    const text = await req.text()
    payload = text ? JSON.parse(text) as SchedulePayload : null
  } catch (error) {
    console.warn(`[${FUNCTION_NAME}] Failed to parse payload`, error)
  }

  const mode = payload?.mode ?? "unspecified"
  console.log(`[${FUNCTION_NAME}] Invocation (${mode}) at ${invokedAt}`, payload)

  const responseBody = {
    status: "ok",
    function: FUNCTION_NAME,
    invokedAt,
    mode,
    payload,
    note: "Replace placeholder logic with learning pipeline orchestration.",
  }

  return new Response(JSON.stringify(responseBody), {
    headers: { "Content-Type": "application/json" },
  })
})
