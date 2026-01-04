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
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
    cache: method === "GET" ? "no-store" : "no-cache"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  return (await response.json()) as TResponse;
}
