import memoizedShallowEqual from '../../lib/memoizedShallowEqual';

describe('memoizedShallowEqual', () => {
    describe('shallowEqual semantics', () => {
        it('returns true for the same reference', () => {
            const obj = {a: 1};
            expect(memoizedShallowEqual(obj, obj)).toBe(true);
        });

        it('returns true for different references with shallowly-equal content', () => {
            const member = {name: 'John'};
            expect(memoizedShallowEqual({a: 1, member}, {a: 1, member})).toBe(true);
        });

        it('returns false when a top-level value differs', () => {
            expect(memoizedShallowEqual({a: 1}, {a: 2})).toBe(false);
        });

        it('returns false when key counts differ', () => {
            expect(memoizedShallowEqual({a: 1}, {a: 1, b: 2})).toBe(false);
        });

        it('returns false for equal deep content with different nested references', () => {
            // Shallow, not deep: nested objects are compared by reference.
            expect(memoizedShallowEqual({member: {name: 'John'}}, {member: {name: 'John'}})).toBe(false);
        });

        it('handles non-object inputs', () => {
            expect(memoizedShallowEqual(undefined, undefined)).toBe(true);
            expect(memoizedShallowEqual(undefined, {})).toBe(false);
            expect(memoizedShallowEqual('a', 'a')).toBe(true);
            expect(memoizedShallowEqual('a', 'b')).toBe(false);
            expect(memoizedShallowEqual(1, 1)).toBe(true);
            expect(memoizedShallowEqual(NaN, NaN)).toBe(true);
        });

        it('handles arrays', () => {
            expect(memoizedShallowEqual([1, 2], [1, 2])).toBe(true);
            expect(memoizedShallowEqual([1, 2], [1, 3])).toBe(false);
        });
    });

    describe('memoization', () => {
        it('returns the cached verdict for the same object pair without re-comparing', () => {
            const a = {name: 'John'};
            const b = {name: 'Jane'};
            expect(memoizedShallowEqual(a, b)).toBe(false);

            // Mutate `b` so the objects are now content-equal. Onyx values are immutable,
            // so the memo is expected to keep returning the verdict computed for this exact
            // (a, b) pair — proving the second call resolved from the cache, not a re-compare.
            b.name = 'John';
            expect(memoizedShallowEqual(a, b)).toBe(false);
        });

        it('caches verdicts per pair, not per object', () => {
            const a = {x: 1};
            const equalToA = {x: 1};
            const differentFromA = {x: 2};

            expect(memoizedShallowEqual(a, equalToA)).toBe(true);
            expect(memoizedShallowEqual(a, differentFromA)).toBe(false);

            // Both verdicts are retained independently for the same `a`.
            expect(memoizedShallowEqual(a, equalToA)).toBe(true);
            expect(memoizedShallowEqual(a, differentFromA)).toBe(false);
        });

        it('does not memoize non-object inputs', () => {
            // Primitives cannot be WeakMap keys; these calls must not throw and must compare directly.
            expect(memoizedShallowEqual(1, {})).toBe(false);
            expect(memoizedShallowEqual({}, 1)).toBe(false);
            expect(memoizedShallowEqual(null, null)).toBe(true);
        });
    });
});
