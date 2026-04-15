import { useRef } from 'react';

/**
 * Returns a ref whose `.current` is always the latest value of `value`.
 * Replaces the verbose `const xRef = useRef(x); xRef.current = x;` pattern.
 * Assignment is synchronous (render phase), so the ref is never one frame stale.
 */
export function useLatestRef(value) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
