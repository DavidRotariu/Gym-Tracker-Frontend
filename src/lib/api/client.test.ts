import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

// Minimal browser stand-ins — client.ts only needs these.
const store = new Map<string, string>();
const events: string[] = [];
const g = globalThis as unknown as Record<string, unknown>;
g.window = { dispatchEvent: (e: { type: string }) => events.push(e.type) };
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
g.sessionStorage = g.localStorage;
g.Event = class {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};

type Handler = (url: string, init: RequestInit) => Response | Promise<Response> | never;
let handler: Handler;
const calls: string[] = [];
g.fetch = (url: string, init: RequestInit) => {
  calls.push(`${init.method ?? "GET"} ${url}`);
  return Promise.resolve(handler(url, init));
};

const { apiRequest, refreshAccessToken } = await import("./client.ts");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  store.clear();
  events.length = 0;
  calls.length = 0;
  store.set("overload_token", "old");
  store.set("overload_refresh_token", "r1");
});

test("several requests hitting 401 at once share one refresh, then each retries once", async () => {
  let refreshes = 0;
  handler = async (url, init) => {
    if (url.endsWith("/auth/refresh")) {
      refreshes++;
      await new Promise((r) => setTimeout(r, 20));
      return json(200, { access_token: "new", refresh_token: "r2" });
    }
    const auth = (init.headers as Record<string, string>).Authorization;
    return auth === "Bearer new" ? json(200, { ok: true }) : json(401, { error: { message: "expired" } });
  };
  const results = await Promise.all([apiRequest("/a"), apiRequest("/b"), apiRequest("/c")]);
  assert.equal(refreshes, 1);
  assert.deepEqual(results, [{ ok: true }, { ok: true }, { ok: true }]);
  assert.equal(store.get("overload_refresh_token"), "r2");
});

test("a refresh the server rejects ends the session", async () => {
  handler = (url) =>
    url.endsWith("/auth/refresh") ? json(401, {}) : json(401, { error: { message: "expired" } });
  await assert.rejects(apiRequest("/a"));
  assert.equal(store.get("overload_token"), undefined);
  assert.ok(events.includes("overload:session-expired"));
});

test("failing to reach the refresh endpoint does NOT sign the user out", async () => {
  handler = (url) => {
    if (url.endsWith("/auth/refresh")) throw new TypeError("Failed to fetch");
    return json(401, { error: { message: "expired" } });
  };
  await assert.rejects(apiRequest("/a"), /No connection/);
  assert.equal(store.get("overload_token"), "old");
  assert.equal(events.length, 0);
});

test("a refresh that completes after sign-out must not restore the session", async () => {
  handler = async () => {
    store.delete("overload_token");
    store.delete("overload_refresh_token"); // user logs out while the refresh is in flight
    return json(200, { access_token: "new", refresh_token: "r2" });
  };
  assert.equal(await refreshAccessToken(), null);
  assert.equal(store.get("overload_token"), undefined);
});

test("a second 401 after the retry is not retried again", async () => {
  let n = 0;
  handler = (url) => {
    if (url.endsWith("/auth/refresh")) return json(200, { access_token: "new", refresh_token: "r2" });
    n++;
    return json(401, { error: { message: "nope" } });
  };
  await assert.rejects(apiRequest("/a"));
  assert.equal(n, 2); // original + exactly one retry
});
