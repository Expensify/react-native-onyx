import createMemoizedSelector from '../../lib/createMemoizedSelector';

describe('createMemoizedSelector', () => {
    it('computes the output on the first call', () => {
        const selector = jest.fn((input: number) => input * 2);
        const memoized = createMemoizedSelector(selector);

        expect(memoized(21)).toBe(42);
        expect(selector).toHaveBeenCalledTimes(1);
    });

    it('short-circuits without recomputing when called with the same input reference', () => {
        const input = {value: 1};
        const selector = jest.fn((data: {value: number}) => ({doubled: data.value * 2}));
        const memoized = createMemoizedSelector(selector);

        const first = memoized(input);
        const second = memoized(input);

        // Same input reference → selector not called again, same output reference returned.
        expect(selector).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    it('recomputes when the input reference changes', () => {
        const selector = jest.fn((data: {value: number}) => data.value * 10);
        const memoized = createMemoizedSelector(selector);

        expect(memoized({value: 1})).toBe(10);
        expect(memoized({value: 2})).toBe(20);
        expect(selector).toHaveBeenCalledTimes(2);
    });

    it('returns the previous output reference when a new input produces a deep-equal output', () => {
        // New object input every call, but the selector output is structurally identical.
        const selector = (data: {id: number; name: string}) => ({id: data.id});
        const memoized = createMemoizedSelector(selector);

        const first = memoized({id: 1, name: 'a'});
        const second = memoized({id: 1, name: 'b'}); // different input, deep-equal output {id: 1}

        // Output is deep-equal, so the *previous* reference is preserved for `===` consumers.
        expect(second).toBe(first);
        expect(second).toEqual({id: 1});
    });

    it('returns a new output reference when a new input produces a deep-unequal output', () => {
        const selector = (data: {id: number}) => ({id: data.id});
        const memoized = createMemoizedSelector(selector);

        const first = memoized({id: 1});
        const second = memoized({id: 2});

        expect(second).not.toBe(first);
        expect(second).toEqual({id: 2});
    });

    it('preserves the output reference across an A → B(deep-equal A) → A sequence', () => {
        const selector = (data: {id: number; extra: string}) => ({id: data.id});
        const memoized = createMemoizedSelector(selector);

        const a = memoized({id: 1, extra: 'x'});
        const b = memoized({id: 1, extra: 'y'}); // deep-equal output, keeps `a`
        const c = memoized({id: 1, extra: 'z'}); // deep-equal output, keeps `a`

        expect(b).toBe(a);
        expect(c).toBe(a);
    });

    it('handles primitive outputs', () => {
        const selector = jest.fn((data: {n: number}) => data.n > 0);
        const memoized = createMemoizedSelector(selector);

        expect(memoized({n: 1})).toBe(true);
        // Different input, same boolean output — deepEqual(true, true) is true, value preserved.
        expect(memoized({n: 5})).toBe(true);
        expect(memoized({n: -1})).toBe(false);
        expect(selector).toHaveBeenCalledTimes(3);
    });

    it('handles undefined input and undefined output', () => {
        const selector = jest.fn((data: {x: number} | undefined) => data?.x);
        const memoized = createMemoizedSelector(selector);

        expect(memoized(undefined)).toBeUndefined();
        // Same undefined input reference → short-circuits.
        expect(memoized(undefined)).toBeUndefined();
        expect(selector).toHaveBeenCalledTimes(1);
    });

    it('treats the first call as a real computation even when the output is undefined', () => {
        const selector = jest.fn(() => undefined);
        const memoized = createMemoizedSelector(selector);

        const input1 = {a: 1};
        const input2 = {a: 2};

        expect(memoized(input1)).toBeUndefined();
        expect(memoized(input2)).toBeUndefined();
        // Both inputs differ by reference, but both outputs are undefined (deep-equal) — recomputed
        // on the second call, then collapsed to the preserved reference (both undefined anyway).
        expect(selector).toHaveBeenCalledTimes(2);
    });

    it('keeps independent caches per wrapper instance', () => {
        const selectorA = jest.fn((n: number) => n + 1);
        const selectorB = jest.fn((n: number) => n + 100);
        const memoizedA = createMemoizedSelector(selectorA);
        const memoizedB = createMemoizedSelector(selectorB);

        expect(memoizedA(1)).toBe(2);
        expect(memoizedB(1)).toBe(101);
        expect(selectorA).toHaveBeenCalledTimes(1);
        expect(selectorB).toHaveBeenCalledTimes(1);
    });

    it('preserves nested object reference identity on deep-equal recompute', () => {
        const selector = (data: {id: number}) => ({meta: {id: data.id}, items: [data.id]});
        const memoized = createMemoizedSelector(selector);

        const first = memoized({id: 7});
        const second = memoized({id: 7}); // new input ref, deep-equal output

        // Whole output reference preserved, so nested members are reference-stable too.
        expect(second).toBe(first);
        expect(second.meta).toBe(first.meta);
        expect(second.items).toBe(first.items);
    });
});
