import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and hydration, true afterwards — for portals and other client-only output. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
