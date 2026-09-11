import type { ApiEnvelope } from "@/types";

/**
 * api-client — typed wrapper around the uniform MN.KP API envelope.
 *
 * Every public endpoint responds with `{ok:true,data}` or
 * `{ok:false,error:{code,message}}` (BUILD CONTRACT §4). `apiFetch` unwraps
 * the envelope: it resolves with `data` on success and throws an
 * `ApiClientError` (carrying the envelope code + HTTP status) on failure,
 * so TanStack Query's error state gets a human-readable message for free.
 *
 * All paths are RELATIVE ("/api/...") so requests stay on the same origin
 * behind the gateway. Cookies ride along via credentials:"include".
 */

export class ApiClientError extends Error {
  /** Envelope error code (VALIDATION / UNAUTHENTICATED / ...) or null. */
  readonly code: string | null;
  /** HTTP status code or null when the request never completed. */
  readonly status: number | null;

  constructor(message: string, code: string | null, status: number | null) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(path, { ...init, credentials: "include", headers });
  } catch {
    throw new ApiClientError(
      "Network request failed. Check your connection and try again.",
      null,
      null
    );
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await res.json()) as ApiEnvelope<T>;
  } catch {
    json = null;
  }

  if (!json || typeof json !== "object" || typeof json.ok !== "boolean") {
    throw new ApiClientError("Unexpected response from the server.", null, res.status);
  }

  if (!json.ok) {
    throw new ApiClientError(
      json.error?.message ?? "The request failed. Please try again.",
      json.error?.code ?? null,
      res.status
    );
  }

  return json.data;
}
