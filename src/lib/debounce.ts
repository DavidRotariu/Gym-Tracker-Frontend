/** Calls `fn` with the latest value once calls have stopped for as long as
 *  that value's own delay. */
export function debounce<T>(fn: (value: T) => void, delayFor: (value: T) => number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (value: T) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(value), delayFor(value));
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
