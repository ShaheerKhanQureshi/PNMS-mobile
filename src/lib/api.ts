import type { Envelope, Filters } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}
let csrfToken = "";
let tokenRequest: Promise<string> | undefined;
let tokenRequestGeneration: number | undefined;
let generation = 0;
const pending = new Set<AbortController>();
// Single shared API base. Production: VITE_API_URL=https://pnms-backend.onrender.com/api (includes /api).
// Empty/unset (local dev) -> same-origin "/api", which the Vite dev proxy forwards to the local backend.
// Tolerant of both "https://host" and "https://host/api" (and the legacy VITE_API_BASE_URL name): an absolute base always
// ends in exactly one "/api". A wrong value used to produce https://host/auth/me -> NOT_FOUND from the API.
const rawBase = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const API_BASE_URL = !rawBase
  ? "/api"
  : /^https?:\/\//i.test(rawBase) && !/\/api$/i.test(rawBase)
    ? rawBase + "/api"
    : rawBase;
const API_ORIGIN = /^https?:\/\//i.test(API_BASE_URL) ? new URL(API_BASE_URL).origin : "";
/** Call sites pass paths like "/api/auth/me" or "/health/live"; this maps them onto the base without a duplicate /api. */
export function apiUrl(path: string): string {
  if (path === "/api" || path.startsWith("/api/")) return API_BASE_URL + path.slice(4);
  if (path.startsWith("/health")) return API_ORIGIN + path; // health endpoints live beside /api, not under it
  return API_BASE_URL + path;
}
export function clearApiSession() {
  generation++;
  csrfToken = "";
  tokenRequest = undefined;
  tokenRequestGeneration = undefined;
  pending.forEach((c) => c.abort());
  pending.clear();
}
export function queryString(filters: Filters = {}) {
  const q = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== "") q.set(key, value);
  });
  return q.size ? `?${q}` : "";
}
async function ensureToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const requestGeneration = generation;
  if (!tokenRequest || tokenRequestGeneration !== requestGeneration) {
    const request = api<{ csrfToken: string }>("/api/auth/csrf-token").then(
      (r) => r.data.csrfToken,
    );
    tokenRequestGeneration = requestGeneration;
    tokenRequest = request.finally(() => {
      if (tokenRequestGeneration === requestGeneration) {
        tokenRequest = undefined;
        tokenRequestGeneration = undefined;
      }
    });
  }
  return tokenRequest;
}
async function request(
  path: string,
  init: RequestInit = {},
  retryCsrf = true,
): Promise<Response> {
  const current = generation;
  const mutating = !!init.method && !["GET", "HEAD"].includes(init.method);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (mutating) {
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRF-Token", await ensureToken());
  }
  if (current !== generation)
    throw new DOMException("Session changed", "AbortError");
  const controller = new AbortController();
  pending.add(controller);
  const timeout = setTimeout(
    () => controller.abort(),
    path.startsWith("/api/exports/") ? 120000 : 20000,
  );
  const cancel = () => controller.abort();
  init.signal?.addEventListener("abort", cancel, { once: true });
  if (init.signal?.aborted) controller.abort();
  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (current !== generation)
      throw new DOMException("Session changed", "AbortError");
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const code = body?.error?.code || "SERVICE_UNAVAILABLE";
      if (code === "CSRF_INVALID" && retryCsrf && mutating) {
        csrfToken = "";
        await ensureToken();
        return request(path, init, false);
      }
      if (response.status === 401 && path !== "/api/auth/login")
        window.dispatchEvent(new Event("session-expired"));
      if (code === "PASSWORD_CHANGE_REQUIRED")
        window.dispatchEvent(new Event("password-required"));
      const message =
        code === "CSRF_INVALID"
          ? "Your session could not be verified. Refresh the page and try again. If this continues, contact your administrator."
          : response.status >= 500
          ? "The service is temporarily unavailable. Please try again."
          : response.status === 429
            ? "Too many requests. Please wait before trying again."
            : body?.error?.message || "The request could not be completed.";
      throw new ApiError(
        response.status,
        code,
        message,
        response.status < 500 ? body?.error?.details || [] : [],
      );
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (current !== generation || init.signal?.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Unable to reach the service. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
    pending.delete(controller);
    init.signal?.removeEventListener("abort", cancel);
  }
}
export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<Envelope<T>> {
  const response = await request(path, init);
  const body = await response.json().catch(() => null);
  if (!body?.success)
    throw new ApiError(
      503,
      "INVALID_RESPONSE",
      "The service returned an unexpected response. Please contact your administrator.",
    );
  if (body.data?.csrfToken) csrfToken = body.data.csrfToken;
  return body;
}
export function mutateApi<T>(
  path: string,
  method: "POST" | "PATCH",
  body: unknown = {},
  headers?: HeadersInit,
) {
  return api<T>(path, { method, body: JSON.stringify(body), headers });
}
export async function download(format: "pdf" | "xlsx", filters: Filters) {
  const safe = { ...filters };
  delete safe.page;
  delete safe.limit;
  const response = await request(
    `/api/exports/reports.${format}${queryString(safe)}`,
  );
  const type = response.headers.get("Content-Type") || "";
  if (
    !(format === "pdf"
      ? type.includes("application/pdf")
      : type.includes("spreadsheetml"))
  )
    throw new ApiError(
      500,
      "INVALID_EXPORT",
      "The export could not be downloaded safely.",
    );
  const blob = await response.blob();
  if (!blob.size)
    throw new ApiError(500, "EMPTY_EXPORT", "The exported file is empty.");
  const disposition = response.headers.get("Content-Disposition") || "";
  let name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  try {
    if (name) name = decodeURIComponent(name);
  } catch {
    name = undefined;
  }
  name ||=
    disposition.match(/filename="?([^";]+)"?/i)?.[1] || `reports.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = Array.from(name, (character) =>
    character.charCodeAt(0) < 32 || character === "/" || character === "\\"
      ? "_"
      : character,
  ).join("");
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
