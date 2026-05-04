import { getCookieMaxAgeFromJwt } from "@/lib/auth-server";

function toBase64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function makeJwt(payload: Record<string, unknown>) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("getCookieMaxAgeFromJwt", () => {
  it("returns time left in seconds for a valid future exp", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = makeJwt({ exp: nowSeconds + 3600 });

    const maxAge = getCookieMaxAgeFromJwt(token, 10);

    expect(maxAge).toBeGreaterThan(3500);
    expect(maxAge).toBeLessThanOrEqual(3600);
  });

  it("returns fallback for expired token", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const token = makeJwt({ exp: nowSeconds - 10 });

    expect(getCookieMaxAgeFromJwt(token, 123)).toBe(123);
  });

  it("returns fallback for malformed token", () => {
    expect(getCookieMaxAgeFromJwt("invalid.token", 456)).toBe(456);
  });
});
