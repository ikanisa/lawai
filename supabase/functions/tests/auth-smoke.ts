import { delay } from "https://deno.land/std@0.224.0/async/delay.ts"
import { fromFileUrl } from "https://deno.land/std@0.224.0/path/from_file_url.ts"

interface SupabaseCommand {
  command: string
  argsPrefix: string[]
}

const FUNCTIONS = ["crawl-authorities", "drive-watcher"] as const
const DEFAULT_SERVICE_SECRET = "edge-test-secret"
const SERVICE_SECRET = Deno.env.get("EDGE_SERVICE_SECRET") ?? DEFAULT_SERVICE_SECRET
const FUNCTIONS_BASE_URL = "http://127.0.0.1:54321/functions/v1"
const supabaseDir = fromFileUrl(new URL("../../", import.meta.url))

const decoder = new TextDecoder()

async function resolveSupabaseCommand(): Promise<SupabaseCommand> {
  const explicit = Deno.env.get("SUPABASE_BIN")
  if (explicit && explicit.length > 0) {
    return { command: explicit, argsPrefix: [] }
  }

  try {
    const check = new Deno.Command("supabase", ["--version"], {
      stdout: "null",
      stderr: "null",
    })
    const { code } = await check.output()
    if (code === 0) {
      return { command: "supabase", argsPrefix: [] }
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn("[edge-smoke] Unable to execute supabase --version:", error)
    }
  }

  return { command: "npx", argsPrefix: ["--yes", "supabase@latest"] }
}

async function waitForReady(url: string): Promise<"ready"> {
  const timeoutAt = Date.now() + 15_000
  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(url, { method: "OPTIONS" })
      if (response.status >= 200 && response.status < 600) {
        return "ready"
      }
    } catch {
      // ignore connection errors until timeout
    }
    await delay(500)
  }
  throw new Error(`Timed out waiting for Supabase function at ${url}`)
}

async function expectStatus(url: string, init: RequestInit, expectedStatus: number, label: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const body = await response.text()
    if (response.status !== expectedStatus) {
      throw new Error(
        `[${label}] Expected status ${expectedStatus} but received ${response.status}: ${body.slice(0, 200)}`,
      )
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`[${label}] Request timed out for ${url}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function withFunctionServer(
  supabaseCommand: SupabaseCommand,
  functionName: (typeof FUNCTIONS)[number],
  run: (url: string) => Promise<void>,
): Promise<void> {
  const env = {
    ...Deno.env.toObject(),
    EDGE_SERVICE_SECRET: SERVICE_SECRET,
  }
  const args = [...supabaseCommand.argsPrefix, "functions", "serve", functionName]
  const command = new Deno.Command(supabaseCommand.command, args, {
    cwd: supabaseDir,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    env,
  })
  const child = command.spawn()
  const output: string[] = []
  const stdoutTask = pumpStream(child.stdout, output)
  const stderrTask = pumpStream(child.stderr, output)
  const statusPromise = child.status

  const baseUrl = `${FUNCTIONS_BASE_URL}/${functionName}`
  const readyOutcome = await Promise.race<"ready" | { status: Deno.CommandStatus }>([
    waitForReady(baseUrl),
    statusPromise.then((status) => ({ status })),
  ])

  if (readyOutcome !== "ready") {
    child.kill("SIGKILL")
    await statusPromise.catch(() => ({ code: null }))
    await Promise.all([stdoutTask, stderrTask])
    throw new Error(
      `[edge-smoke] Supabase CLI exited before ${functionName} became ready (code: ${readyOutcome.status.code}).\n${output.join("")}`,
    )
  }

  try {
    await run(baseUrl)
  } finally {
    child.kill("SIGINT")
    const exitStatus = await Promise.race<Deno.CommandStatus | null>([
      statusPromise,
      delay(5_000).then(() => null),
    ])
    if (exitStatus === null) {
      console.warn(`[edge-smoke] Forcing Supabase CLI shutdown for ${functionName}`)
      child.kill("SIGKILL")
      await statusPromise.catch(() => ({ code: null }))
    } else if (exitStatus.code !== 0 && exitStatus.code !== 130) {
      console.warn(
        `[edge-smoke] Supabase CLI exited with code ${exitStatus.code} for ${functionName}. Logs:\n${output.join("")}`,
      )
    }
    await Promise.all([stdoutTask, stderrTask])
  }
}

async function pumpStream(stream: ReadableStream<Uint8Array> | null, target: string[]): Promise<void> {
  if (!stream) {
    return
  }
  const reader = stream.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done || !value) {
        break
      }
      target.push(decoder.decode(value))
    }
  } finally {
    reader.releaseLock()
  }
}

async function runSmoke(): Promise<void> {
  const supabaseCommand = await resolveSupabaseCommand()
  for (const functionName of FUNCTIONS) {
    console.log(`[edge-smoke] Starting ${functionName} tests…`)
    await withFunctionServer(supabaseCommand, functionName, async (url) => {
      await expectStatus(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
        401,
        `${functionName}-unauthorized`,
      )

      await expectStatus(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-service-secret": "invalid" + SERVICE_SECRET,
          },
          body: "{}",
        },
        403,
        `${functionName}-forbidden`,
      )

      await expectStatus(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-service-secret": SERVICE_SECRET,
          },
          body: "{}",
        },
        200,
        `${functionName}-authorized`,
      )
    })
  }
}

await runSmoke()
