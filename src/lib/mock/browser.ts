import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

/**
 * `worker.start()` throws if called on an already-enabled network — and
 * React's dev-mode effect double-invoke (StrictMode) means the mount effect
 * in providers.tsx fires twice. Memoize the start promise so the second
 * call just reuses it instead of re-starting.
 */
let startPromise: ReturnType<typeof worker.start> | null = null;

export function startWorker() {
  startPromise ??= worker.start({ onUnhandledRequest: "bypass", quiet: true });
  return startPromise;
}
