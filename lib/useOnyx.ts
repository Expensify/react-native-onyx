import {deepEqual} from 'fast-equals';
import {useCallback, useMemo, useRef, useSyncExternalStore} from 'react';
import OnyxCache from './OnyxCache';
import OnyxKeys from './OnyxKeys';
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
 * Subscribes a React component to an Onyx key.
 *
 * Returns `[value, {status}]`. Status is `'loaded'` when the cache holds an
 * answer for the key (either a value or a confirmed-absent marker), and
 * `'loading'` otherwise. For collection keys, `'loaded'` is always true post-init.
 *
 * If a key isn't in cache (rare with eager-load, but happens for storage writes
 * that bypass Onyx), the hook lazy-loads via `OnyxUtils.get()` and transitions
 * `loading → loaded` once the read settles.
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // The memoized selector is recreated only when the selector function identity changes.
    // Inside, it caches by input reference; that's what keeps useSyncExternalStore from
    // looping when consumers pass inline-allocating selectors.
    const memoizedSelector = useMemo(() => (selector ? createMemoizedSelector(selector) : null), [selector]);

    // Flips to `true` after a callback (real change or lazy-load completion) fires for
    // the current subscription. Combined with `hasCacheForKey` to decide 'loaded' vs 'loading'.
    const hasCallbackFiredRef = useRef(false);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            hasCallbackFiredRef.current = false;
            const unsubscribe = onyxStore.subscribe(key, () => {
                hasCallbackFiredRef.current = true;
                onStoreChange();
            });
            // Lazy-load from storage if cache doesn't have this key. Collection keys are
            // treated as always-resolved post-init (an empty collection IS a valid answer).
            // After the read settles, notify so the hook transitions to 'loaded'.
            if (!OnyxKeys.isCollectionKey(key) && !OnyxCache.hasCacheForKey(key)) {
                OnyxUtils.get(key).then(() => {
                    hasCallbackFiredRef.current = true;
                    onStoreChange();
                });
            }
            return unsubscribe;
        },
        [key],
    );

    // resultRef holds the last tuple returned to React. We return the same tuple
    // reference when value and status haven't changed so React skips the re-render.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([undefined, {status: 'loading'}]);

    const getSnapshot = useCallback((): UseOnyxResult<TReturnValue> => {
        const raw = onyxStore.getState(key);
        const selected = memoizedSelector ? memoizedSelector(raw as OnyxValue<TKey>) : (raw as TReturnValue | undefined);
        const nextValue = (selected ?? undefined) as NonNullable<TReturnValue> | undefined;

        const initDone = OnyxUtils.getDeferredInitTask().isResolved;
        const isCollectionKey = OnyxKeys.isCollectionKey(key);
        const hasCacheForKey = isCollectionKey || OnyxCache.hasCacheForKey(key);
        // 'loaded' when init is done AND (cache has answered for this key OR the
        // subscriber callback has fired since (re)subscribing). The callback path
        // covers lazy storage reads and writes that race with mount.
        const nextStatus: FetchStatus = initDone && (hasCacheForKey || hasCallbackFiredRef.current) ? 'loaded' : 'loading';

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
