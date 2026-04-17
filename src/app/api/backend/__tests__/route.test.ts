jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

import { DELETE, GET, POST } from "@/app/api/backend/[...path]/route";
import { cookies } from "next/headers";

const mockCookies = cookies as jest.MockedFunction<typeof cookies>;

describe("api backend catch-all route", () => {
  const originalFetch = global.fetch;
  const originalBackendBaseUrl = process.env.BACKEND_BASE_URL;

  beforeEach(() => {
    process.env.BACKEND_BASE_URL = "http://backend.test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.BACKEND_BASE_URL = originalBackendBaseUrl;
    jest.clearAllMocks();
  });

  it("returns 401 when auth cookie is missing", async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined),
    });

    const request = new Request("http://localhost/api/backend/muscles", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["muscles"] }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ detail: "Unauthorized" });
  });

  it("forwards GET requests with bearer auth and query params", async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "token123" }),
    });

    const backendPayload = [{ id: 1, name: "Chest" }];
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(backendPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const request = new Request("http://localhost/api/backend/muscles?page=1", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["muscles"] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [forwardedUrl, forwardedInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(forwardedUrl).toBe("http://backend.test/muscles?page=1");
    expect(forwardedInit.method).toBe("GET");
    expect(forwardedInit.cache).toBe("no-store");
    expect((forwardedInit.headers as Headers).get("Authorization")).toBe("Bearer token123");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(backendPayload);
  });

  it("forwards JSON request body for POST", async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "token123" }),
    });

    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as typeof fetch;

    const requestBody = { name: "PPL" };
    const request = new Request("http://localhost/api/backend/splits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["splits"] }),
    });

    const [, forwardedInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(forwardedInit.method).toBe("POST");
    expect((forwardedInit.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(forwardedInit.body).toBe(JSON.stringify(requestBody));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns no body for 204 backend responses", async () => {
    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue({ value: "token123" }),
    });

    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    global.fetch = fetchMock as typeof fetch;

    const request = new Request("http://localhost/api/backend/splits/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ path: ["splits", "123"] }),
    });

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe("");
  });
});
