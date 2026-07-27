import {shallowEqual} from 'fast-equals';

/**
 * Memoizes shallowEqual verdicts by the identity of the compared objects. Onyx values are
 * treated as immutable (merge/set replace objects, never mutate), so a (prev, next) reference
 * pair always yields the same verdict. In the hot case — N no-selector hooks on the same big
 * key — every hook compares the exact same two cache-owned objects, so the first hook pays for
 * the O(keys) walk and the rest resolve in O(1). WeakMap keys make stale entries impossible to
 * read (lookup requires holding both exact objects) and let GC reclaim them.
 */
const shallowEqualVerdicts = new WeakMap<object, WeakMap<object, boolean>>();

/**
 * Identity-pair-memoized shallowEqual: same (a, b) references → cached verdict, no walk.
 */
function memoizedShallowEqual(a: unknown, b: unknown): boolean {
    // Only object pairs are memoizable (WeakMap keys) — anything else is O(1) to compare anyway.
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return shallowEqual(a, b);
    }

    let verdictsForA = shallowEqualVerdicts.get(a);

    if (!verdictsForA) {
        verdictsForA = new WeakMap();
        shallowEqualVerdicts.set(a, verdictsForA);
    }

    const cachedVerdict = verdictsForA.get(b);

    if (cachedVerdict !== undefined) {
        return cachedVerdict;
    }

    const verdict = shallowEqual(a, b);
    verdictsForA.set(b, verdict);

    return verdict;
}

export default memoizedShallowEqual;
