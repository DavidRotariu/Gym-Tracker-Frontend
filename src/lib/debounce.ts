/** Calls `fn` with the latest value once calls have stopped for `ms`. */
export function debounce<T>(fn: (value: T) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (value: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(value), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
