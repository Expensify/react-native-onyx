import {useRef} from 'react';

/**
 * Creates a mutable reference to a value, useful when you need to
 * maintain a reference to a value that may change over time without triggering re-renders.
 *
 * This hook intentionally assigns to ref.current during render. The migration effort to
 * remove it safely is not currently planned.
 */
/* eslint-disable react-hooks/refs -- Intentional live-ref pattern for dependency tracking without re-renders */
function useLiveRef<T>(value: T) {
    const ref = useRef<T>(value);
    ref.current = value;

    return ref;
}
/* eslint-enable react-hooks/refs */

export default useLiveRef;
