import {
  backendFetch,
  backendJson,
  backendJsonWithBody,
  loginRequest,
  logoutRequest,
  signupRequest,
} from "@/lib/api-client";

describe("api-client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("backendFetch normalizes path and includes credentials/no-store", async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await backendFetch("muscles", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledWith("/api/backend/muscles", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });
  });

  it("backendJson parses successful JSON responses", async () => {
    const payload = [{ id: 1, name: "Chest" }];
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }));
    global.fetch = fetchMock as typeof fetch;

    const result = await backendJson<Array<{ id: number; name: string }>>("/muscles");

    expect(result).toEqual(payload);
  });

  it("backendJson throws detail message from JSON error", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    await expect(backendJson("/muscles")).rejects.toThrow("Unauthorized");
  });

  it("backendJsonWithBody sends JSON payload", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    global.fetch = fetchMock as typeof fetch;

    await backendJsonWithBody("/splits", "POST", { name: "PPL" });

    expect(fetchMock).toHaveBeenCalledWith("/api/backend/splits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "PPL" }),
      cache: "no-store",
      credentials: "include",
    });
  });

  it("loginRequest calls login route", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    global.fetch = fetchMock as typeof fetch;

    await loginRequest("user@example.com", "password");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "password" }),
    });
  });

  it("signupRequest calls signup route", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    global.fetch = fetchMock as typeof fetch;

    await signupRequest("User", "user@example.com", "password");

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "User", email: "user@example.com", password: "password" }),
    });
  });

  it("logoutRequest calls logout route", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    global.fetch = fetchMock as typeof fetch;

    await logoutRequest();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });
});
