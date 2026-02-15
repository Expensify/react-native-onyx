import {useRef} from 'react';

/**
 * Creates a mutable reference to a value, useful when you need to
 * maintain a reference to a value that may change over time without triggering re-renders.
 *
 * @deprecated This hook breaks the Rules of React, and should not be used.
 * The migration effort to remove it safely is not currently planned.
 */
function useLiveRef<T>(value: T) {
    const ref = useRef<T>(value);
    ref.current = value;

    return ref;
}

export default useLiveRef;
