import {deepEqual} from 'fast-equals';
import {useCallback, useMemo, useRef, useSyncExternalStore} from 'react';
import onyxStore from './OnyxStore';
import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
    /**
     * If set to `false`, the underlying subscription is not pooled with other consumers
     * of the same key. Largely a no-op in the store-based design (subscriptions are cheap)
     * but kept for API compatibility.
     */
    reuseConnection?: boolean;

    /**
     * Subscribe to a subset of an Onyx key's data. The component re-renders only when
     * the selector's output reference changes; selectors that allocate fresh objects
     * (e.g. `(e) => ({id: e?.id})`) are handled by an internal input-cache + deepEqual
     * fallback so they don't cause `useSyncExternalStore` to loop.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

type FetchStatus = 'loading' | 'loaded';

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata];

/**
 * Wraps a user-provided selector so that:
 * - Calling the wrapper with the same input reference twice short-circuits to the cached output.
 * - Calling with a different input that produces a deep-equal output returns the *previous*
 *   output reference, so React reconciliation can detect equality with `===`.
 *
 * This is the minimum needed for `useSyncExternalStore` to not loop when consumers pass
 * inline selectors that allocate fresh objects on every call.
 */
function createMemoizedSelector<TKey extends OnyxKey, TReturnValue>(selector: UseOnyxSelector<TKey, TReturnValue>): UseOnyxSelector<TKey, TReturnValue> {
    let lastInput: OnyxValue<TKey> | undefined;
    let lastOutput: TReturnValue;
    let hasComputed = false;

    return (input) => {
        if (hasComputed && lastInput === input) {
            return lastOutput;
        }
        const next = selector(input);
        lastInput = input;
        if (!hasComputed || !deepEqual(lastOutput, next)) {
            lastOutput = next;
            hasComputed = true;
        }
        return lastOutput;
    };
}

/**
 * Subscribes a React component to an Onyx key. The component re-renders when the
 * value at `key` changes (for collection keys, when any member changes — the
 * returned value is the frozen collection snapshot).
 *
 * Returns `[value, {status}]`. `status` is `'loaded'` once init completes and the
 * key has either a value or a confirmed-absent state in cache; `'loading'` before
 * that.
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // The memoized selector is recreated only when the selector function identity changes.
    // Inside, it caches by input reference; that's what keeps useSyncExternalStore from
    // looping when consumers pass inline-allocating selectors.
    const memoizedSelector = useMemo(() => (selector ? createMemoizedSelector(selector) : null), [selector]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => onyxStore.subscribe(key, onStoreChange),
        [key],
    );

    // resultRef holds the last tuple returned to React. We return the same tuple
    // reference when value and status haven't changed so React skips the re-render.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([undefined, {status: 'loading'}]);

    const getSnapshot = useCallback((): UseOnyxResult<TReturnValue> => {
        const raw = onyxStore.getState(key);
        const selected = memoizedSelector ? memoizedSelector(raw as OnyxValue<TKey>) : (raw as TReturnValue | undefined);
        const nextValue = (selected ?? undefined) as NonNullable<TReturnValue> | undefined;

        // Loading until init completes. After init the value is whatever the cache says
        // (absent keys are simply `undefined`); there's no "still fetching" phase because
        // eager-load guarantees the cache is populated.
        const initDone = OnyxUtils.getDeferredInitTask().isResolved;
        const nextStatus: FetchStatus = initDone ? 'loaded' : 'loading';

        const [prevValue, prevMeta] = resultRef.current;
        if (prevValue === nextValue && prevMeta.status === nextStatus) {
            return resultRef.current;
        }
        resultRef.current = [nextValue, {status: nextStatus}];
        return resultRef.current;
    }, [key, memoizedSelector]);

    return useSyncExternalStore(subscribe, getSnapshot);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};
