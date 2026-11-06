import { getResponse, http, HttpResponse, passthrough, type RequestHandler } from "msw";
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * Mock API routes share the app's origin, and a few collide with page routes
 * (GET /splits, GET /splits/:id ↔ the /splits and /splits/new pages). A
 * client-side navigation fetches the page's RSC payload from that same URL,
 * so the mock answered it with JSON and Next fell back to a full reload.
 * Page/RSC requests must never reach the mock API.
 */
const pageRequestGuard = http.all("*", ({ request }) => {
  const url = new URL(request.url);
  if (request.headers.get("RSC") || url.searchParams.has("_rsc") || request.mode === "navigate") {
    return passthrough();
  }
});

/** Every path prefix the mock API serves — the dev knobs below touch nothing else. */
const API_PREFIXES = [
  "/auth/", "/muscles", "/exercises", "/favorites", "/splits", "/workouts",
  "/workout-exercises/", "/sets/", "/users/",
];

/**
 * Dev-only network simulation for the demo build, set from the console:
 *   localStorage.overload_mock_latency = "1500"            // ms per API call
 *   localStorage.overload_mock_fail = "PATCH /sets/"       // regex on "METHOD /path" → 500
 *   localStorage.overload_mock_offline = "1"               // every call fails like no connection
 *   localStorage.overload_mock_expired = "1"               // every call gets a 401 (expired token)
 *   localStorage.overload_mock_valid_epoch = "1"           // expires every access token; /auth/refresh issues fresh ones
 *   localStorage.overload_mock_refresh_invalid = "1"       // ...and makes the refresh token fail too
 * Lets slow-gym-signal races and error recovery be reproduced on purpose.
 * Falls through to the real handlers when neither applies.
 */
const devNetworkKnobs = http.all("*", async ({ request }) => {
  const url = new URL(request.url);
  if (!API_PREFIXES.some((p) => url.pathname.startsWith(p))) return;
  const latency = Number(localStorage.getItem("overload_mock_latency") ?? 0);
  if (latency > 0) await new Promise((r) => setTimeout(r, latency));
  // overload_mock_offline = "1": every API call fails like a dead connection.
  if (localStorage.getItem("overload_mock_offline")) return HttpResponse.error();
  // overload_mock_expired = "1": the access token is treated as expired, so
  // every authenticated call (and refresh) gets a 401.
  if (localStorage.getItem("overload_mock_expired") && !url.pathname.startsWith("/auth/login") && !url.pathname.startsWith("/auth/signup")) {
    return HttpResponse.json(
      { error: { code: "401", message: "Sign in to continue." } },
      { status: 401 },
    );
  }
  const fail = localStorage.getItem("overload_mock_fail");
  if (fail && new RegExp(fail).test(`${request.method} ${url.pathname}`)) {
    return HttpResponse.json(
      { error: { code: "500", message: "Simulated server error." } },
      { status: 500 },
    );
  }
});

const allHandlers: RequestHandler[] = [pageRequestGuard, devNetworkKnobs, ...handlers];

export const worker = setupWorker(...allHandlers);

/**
 * Same handlers, served by wrapping window.fetch instead of a service
 * worker. Used when the worker can't register (private browsing, service
 * workers disabled, embedded webviews) — that used to leave the demo build
 * on a permanent black screen, since the app waits for the mock API before
 * rendering anything.
 */
function installFetchFallback() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const response = await getResponse(allHandlers, request);
    // passthrough() resolves to a marker response, not undefined.
    if (!response || response.headers.get("x-msw-intention") === "passthrough") {
      return realFetch(input, init);
    }
    // A dropped connection must reject like a real fetch does, not resolve to
    // an opaque status-0 response (which the client would read as an HTTP error).
    if (response.type === "error") throw new TypeError("Failed to fetch");
    return response;
  };
}

/**
 * `worker.start()` throws if called on an already-enabled network — and
 * React's dev-mode effect double-invoke (StrictMode) means the mount effect
 * in providers.tsx fires twice. Memoize the start promise so the second
 * call just reuses it instead of re-starting.
 */
let startPromise: Promise<unknown> | null = null;

export function startWorker() {
  startPromise ??= worker
    .start({ onUnhandledRequest: "bypass", quiet: true })
    .catch(() => installFetchFallback());
  return startPromise;
}
