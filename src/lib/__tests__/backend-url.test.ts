describe("getBackendBaseUrl", () => {
  const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL;
  const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    process.env.BACKEND_BASE_URL = BACKEND_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = NEXT_PUBLIC_BASE_URL;
    jest.resetModules();
  });

  it("uses BACKEND_BASE_URL when present and trims trailing slashes", async () => {
    process.env.BACKEND_BASE_URL = "http://127.0.0.1:8000///";
    process.env.NEXT_PUBLIC_BASE_URL = "http://fallback:9000";

    const { getBackendBaseUrl } = await import("@/lib/backend-url");

    expect(getBackendBaseUrl()).toBe("http://127.0.0.1:8000");
  });

  it("falls back to NEXT_PUBLIC_BASE_URL", async () => {
    delete process.env.BACKEND_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = "https://api.example.com/";

    const { getBackendBaseUrl } = await import("@/lib/backend-url");

    expect(getBackendBaseUrl()).toBe("https://api.example.com");
  });

  it("throws if neither backend env var is set", async () => {
    delete process.env.BACKEND_BASE_URL;
    delete process.env.NEXT_PUBLIC_BASE_URL;

    const { getBackendBaseUrl } = await import("@/lib/backend-url");

    expect(() => getBackendBaseUrl()).toThrow(
      "Missing backend base URL. Set BACKEND_BASE_URL or NEXT_PUBLIC_BASE_URL.",
    );
  });
});
