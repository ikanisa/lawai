import { withCsrf } from "@/lib/security";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface ApiRequest<TBody = unknown> {
  path: string;
  method?: HttpMethod;
  body?: TBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export async function apiFetch<TResponse, TBody = unknown>({
  path,
  method = "GET",
  body,
  headers,
  signal
}: ApiRequest<TBody>): Promise<TResponse> {
  const baseInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
    cache: method === "GET" ? "no-store" : "no-cache",
    credentials: "include"
  };
  const prepared = await withCsrf(baseInit);
  const response = await fetch(path, prepared);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return (await response.json()) as TResponse;
}
