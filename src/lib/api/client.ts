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
 */
async function refreshAccessToken(): Promise<string | null> {
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

/** No usable session left — clear it and send the person back to sign in. */
function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  if (!["/login", "/signup"].includes(window.location.pathname)) {
    window.location.href = "/login";
  }
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
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: payload,
  });

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
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = (data as ApiError | undefined)?.error?.message ?? "Something went wrong.";
    const code = (data as ApiError | undefined)?.error?.code ?? String(res.status);
    throw new ApiRequestError(res.status, code, message);
  }

  return data as T;
}

/** For endpoints returning raw binary (e.g. the QR PNG) instead of JSON. */
export async function apiRequestBlob(path: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    throw new ApiRequestError(res.status, String(res.status), "Couldn't load image.");
  }
  return res.blob();
}
