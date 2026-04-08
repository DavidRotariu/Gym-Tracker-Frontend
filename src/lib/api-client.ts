type JsonBody = Record<string, unknown>;

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

async function parseError(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  let message = `Request failed with status ${response.status}`;

  try {
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (typeof data?.error === "string") {
        message = data.error;
      }
    } else {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
  } catch {
    // Keep fallback message.
  }

  return new Error(message);
}

export async function backendFetch(path: string, init: RequestInit = {}) {
  return fetch(`/api/backend${normalizePath(path)}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });
}

export async function backendJson<T>(path: string, init: RequestInit = {}) {
  const response = await backendFetch(path, init);

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export async function backendJsonWithBody<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: JsonBody,
) {
  return backendJson<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function loginRequest(email: string, password: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}

export async function signupRequest(name: string, email: string, password: string) {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}

export async function logoutRequest() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json();
}
