// Supabase Edge Function: crawl-authorities
// Scheduled to run every 6 hours (see supabase/config.toml).
// Currently implements a placeholder job that simply logs the invocation payload.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const FUNCTION_NAME = "crawl-authorities"

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
    note: "Replace placeholder logic with authority crawling implementation.",
  }

  return new Response(JSON.stringify(responseBody), {
    headers: { "Content-Type": "application/json" },
  })
})
