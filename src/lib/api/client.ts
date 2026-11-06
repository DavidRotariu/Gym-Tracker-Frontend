import type { ApiError } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

const TOKEN_KEY = "overload_token";
const REFRESH_KEY = "overload_refresh_token";
const USER_KEY = "overload_user";

export class ApiRequestError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * The access token is short-lived. If a refresh token is on file, trade it
 * in for a new access token instead of forcing a re-login every time the
 * old one expires — this is what actually keeps someone signed in across
 * closing and reopening the browser.
 *
 * Single-flight: every caller (each concurrent 401, the scheduled refresh in
 * use-auth) shares one in-flight request. Refresh tokens rotate, so a second
 * parallel refresh would present an already-spent token and log the user out.
 */
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function doRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token: string; refresh_token: string };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

/** Fired when the session can't be renewed — use-auth listens and signs out. */
export const SESSION_EXPIRED_EVENT = "overload:session-expired";

/**
 * No usable session left — clear it and let the app route to sign-in
 * client-side (see use-auth). This used to hard-reload to /login, which
 * threw away everything in memory mid-workout: the write queue, the open
 * keypad draft, the page itself.
 */
function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

// Long enough for a slow gym connection, short enough that a stalled one
// ends in a retryable error instead of a spinner that never stops.
const TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * fetch with a timeout, and with network failures turned into readable
 * errors — Safari's raw "Load failed" / "The operation timed out" used to
 * reach the UI verbatim.
 */
async function send(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ApiRequestError(0, "timeout", "The connection timed out. Try again.");
    }
    throw new ApiRequestError(0, "network", "No connection. Check your signal and try again.");
  }
}

function statusMessage(status: number): string {
  if (status >= 500) return "The server had a problem. Try again.";
  if (status === 404) return "Not found.";
  return "Something went wrong.";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  /** Internal: set on the retried request so a second 401 doesn't loop. */
  _retried?: boolean;
}

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, auth = true, _retried = false }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();
    // Signed out: don't send a request that can only 401 (e.g. a query
    // refetching while the screen unmounts after logout).
    if (!token) throw new ApiRequestError(401, "unauthenticated", "You're signed out.");
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await send(`${BASE_URL}${path}`, {
    method,
    headers,
    body: payload,
  }, body instanceof FormData ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);

  if (res.status === 204) {
    return undefined as T;
  }

  if (res.status === 401 && auth && !_retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, { method, body, auth, _retried: true });
    }
    clearSession();
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    // A gateway/timeout page (HTML) instead of the API's JSON — used to
    // surface as "Unexpected token '<'…" in the UI.
    throw new ApiRequestError(res.status, String(res.status), statusMessage(res.status));
  }

  if (!res.ok) {
    const message = (data as ApiError | undefined)?.error?.message ?? statusMessage(res.status);
    const code = (data as ApiError | undefined)?.error?.code ?? String(res.status);
    throw new ApiRequestError(res.status, code, message);
  }

  return data as T;
}

/** For endpoints returning raw binary (e.g. the QR PNG) instead of JSON. */
export async function apiRequestBlob(path: string, _retried = false): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await send(`${BASE_URL}${path}`, { headers }, TIMEOUT_MS);
  // Same renew-and-retry as apiRequest — without it an expired token made
  // the QR/avatar silently "missing".
  if (res.status === 401 && !_retried && (await refreshAccessToken())) {
    return apiRequestBlob(path, true);
  }
  if (!res.ok) {
    throw new ApiRequestError(res.status, String(res.status), "Couldn't load image.");
  }
  return res.blob();
}
