// It's just a test file to test typescript
import type {Dispatch, SetStateAction} from 'react';
import {useState} from 'react';

function useOnyx<T>(key: string, defaultValue: T): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(defaultValue);

    return [value, setValue];
}

export default useOnyx;
