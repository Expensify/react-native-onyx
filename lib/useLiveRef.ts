import {useRef} from 'react';

function useLiveRef<T>(value: T) {
    const ref = useRef<T>(value);
    ref.current = value;

    return ref;
}

export default useLiveRef;
