import {useEffect, useRef} from 'react';

/**
 * Returns the previous value of the provided value.
 */
function usePrevious<T>(value: T): T {
    const ref = useRef<T>(value);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
}

export default usePrevious;
