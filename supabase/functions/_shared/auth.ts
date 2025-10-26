import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts"

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface VerifyRequestOptions {
  jwtSecret?: string | null
  serviceSecret?: string | null
  serviceSecretHeader?: string
  now?: () => number
}

export interface VerifySuccess {
  ok: true
  method: "jwt" | "service-secret"
  claims?: Record<string, unknown>
}

export interface VerifyFailure {
  ok: false
  status: 401 | 403
  error: "unauthorized" | "forbidden"
  reason: string
}

export type VerifyResult = VerifySuccess | VerifyFailure

const DEFAULT_SERVICE_SECRET_HEADER = "x-service-secret"
const DEFAULT_NOW = () => Math.floor(Date.now() / 1000)

function normaliseHeaderName(name: string | undefined | null): string {
  if (!name || name.trim().length === 0) {
    return DEFAULT_SERVICE_SECRET_HEADER
  }
  return name.trim().toLowerCase()
}

function toUint8(value: string): Uint8Array {
  return encoder.encode(value)
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const padLength = (4 - (value.length % 4)) % 4
  const normalised = `${value}${"=".repeat(padLength)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/")
  const binary = atob(normalised)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function verifyJwt(token: string, secret: string, now: () => number): Promise<VerifyResult> {
  const parts = token.split(".")
  if (parts.length !== 3) {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_format_invalid" }
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts

  let header: Record<string, unknown>
  try {
    header = JSON.parse(decoder.decode(base64UrlToUint8Array(encodedHeader)))
  } catch {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_header_invalid" }
  }

  if (header.alg !== "HS256") {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_algorithm_unsupported" }
  }

  let payloadJson: string
  try {
    payloadJson = decoder.decode(base64UrlToUint8Array(encodedPayload))
  } catch {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_payload_invalid" }
  }

  let claims: Record<string, unknown>
  try {
    const parsed = JSON.parse(payloadJson)
    claims = typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {}
  } catch {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_payload_invalid_json" }
  }

  const key = await crypto.subtle.importKey(
    "raw",
    toUint8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToUint8Array(encodedSignature),
    toUint8(`${encodedHeader}.${encodedPayload}`),
  )

  if (!isValid) {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_signature_invalid" }
  }

  const currentEpoch = now()
  const exp = typeof claims.exp === "number" ? claims.exp : undefined
  if (exp !== undefined && currentEpoch >= exp) {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_expired" }
  }

  const nbf = typeof claims.nbf === "number" ? claims.nbf : undefined
  if (nbf !== undefined && currentEpoch < nbf) {
    return { ok: false, status: 403, error: "forbidden", reason: "jwt_not_before" }
  }

  return { ok: true, method: "jwt", claims }
}

export async function verifyRequest(req: Request, options: VerifyRequestOptions = {}): Promise<VerifyResult> {
  const headerName = normaliseHeaderName(options.serviceSecretHeader)
  const serviceSecret = options.serviceSecret ?? Deno.env.get("EDGE_SERVICE_SECRET") ?? null
  const jwtSecret = options.jwtSecret ?? Deno.env.get("EDGE_JWT_SECRET") ?? null
  const now = options.now ?? DEFAULT_NOW

  const providedSecret = headerName.length > 0 ? req.headers.get(headerName) : null
  if (providedSecret) {
    if (!serviceSecret) {
      return { ok: false, status: 403, error: "forbidden", reason: "service_secret_unconfigured" }
    }

    const providedBytes = toUint8(providedSecret)
    const expectedBytes = toUint8(serviceSecret)

    if (providedBytes.length !== expectedBytes.length) {
      return { ok: false, status: 403, error: "forbidden", reason: "service_secret_mismatch" }
    }

    if (timingSafeEqual(providedBytes, expectedBytes)) {
      return { ok: true, method: "service-secret" }
    }

    return { ok: false, status: 403, error: "forbidden", reason: "service_secret_mismatch" }
  }

  const authorization = req.headers.get("authorization") ?? req.headers.get("Authorization")
  if (authorization) {
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : authorization.trim()
    if (!token) {
      return { ok: false, status: 403, error: "forbidden", reason: "jwt_token_missing" }
    }
    if (!jwtSecret) {
      return { ok: false, status: 403, error: "forbidden", reason: "jwt_secret_unconfigured" }
    }
    return await verifyJwt(token, jwtSecret, now)
  }

  return { ok: false, status: 401, error: "unauthorized", reason: "credentials_missing" }
}
