import { useCallback, useEffect, useRef } from 'react';

/**
 * Creates a debounced version of the provided callback function.
 *
 * Debouncing limits the number of times a function can be called over time by delaying its execution
 *
 * @param callback - The function to debounce.
 * @param delay - The debounce delay in milliseconds.
 * @returns A debounced version of the callback function.
 */
export function useDebounce<T>(
  callback: (value: T) => void,
  delay: number
): (value: T) => void {
  const timeoutRef = useRef<number | undefined>(undefined);

  const debouncedCallback = useCallback(
    (value: T) => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        callback(value);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}
