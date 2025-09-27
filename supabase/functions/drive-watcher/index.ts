// Supabase Edge Function: drive-watcher
// Scheduled to run every 15 minutes to monitor external drives or sources.
// Placeholder implementation logging invocation context.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const FUNCTION_NAME = "drive-watcher"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 })
  }

  const invokedAt = new Date().toISOString()

  let payload: unknown = null
  try {
    const text = await req.text()
    payload = text ? JSON.parse(text) : null
  } catch (error) {
    console.warn(`[${FUNCTION_NAME}] Failed to parse payload`, error)
  }

  console.log(`[${FUNCTION_NAME}] Invocation at ${invokedAt}`, payload)

  const responseBody = {
    status: "ok",
    function: FUNCTION_NAME,
    invokedAt,
    payload,
    note: "Replace placeholder logic with external drive synchronisation.",
  }

  return new Response(JSON.stringify(responseBody), {
    headers: { "Content-Type": "application/json" },
  })
})
