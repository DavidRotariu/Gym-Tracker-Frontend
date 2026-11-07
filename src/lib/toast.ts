/**
 * App-wide error toast, outside React so a failure can surface even after the
 * screen that started the action is gone (save → navigate away → the request
 * fails a few seconds later). Fed by the QueryClient's MutationCache — see
 * providers.tsx — and drawn by <Toaster/>.
 */
type Listener = () => void;

export type ToastTone = "error" | "warning";

let current: { id: number; message: string; tone: ToastTone } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l());

export function showToast(message: string, ms = 6000, tone: ToastTone = "error") {
  current = { id: ++seq, message, tone };
  clearTimeout(timer);
  timer = setTimeout(dismissToast, ms);
  emit();
}

export function dismissToast() {
  clearTimeout(timer);
  current = null;
  emit();
}

export function subscribeToast(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const getToast = () => current;
