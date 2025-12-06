import {useRef} from 'react';

/**
 * Creates a mutable reference to a value, useful when you need to
 * maintain a reference to a value that may change over time without triggering re-renders.
 */
function useLiveRef<T>(value: T) {
    const ref = useRef<T>(value);
    ref.current = value;

    return ref;
}

export default useLiveRef;
