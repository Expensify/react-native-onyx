import {useCallback, useMemo, useRef, useSyncExternalStore} from 'react';
import createMemoizedSelector from './createMemoizedSelector';
import onyxStore from './OnyxStore';
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

/**
 * Always `'loaded'` in the store-based design. The type is preserved so existing
 * destructures like `const [val, {status}] = useOnyx(KEY)` keep compiling. Will be
 * removed in a future cleanup once consumers stop reading it.
 */
type FetchStatus = 'loaded';

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata];

const LOADED_METADATA: ResultMetadata = {status: 'loaded'};

/**
 * Subscribes a React component to an Onyx key. The component re-renders when the value
 * at `key` changes (for collection keys, when any member changes — the returned value is
 * the frozen collection snapshot).
 *
 * Returns `[value, {status: 'loaded'}]`. With eager-load + the structural-sharing cache,
 * there's no loading phase — the cache always has an answer (a value or "absent"). The
 * `status` field is retained for API compatibility and is always `'loaded'`.
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // The memoized selector is recreated only when the selector function identity changes.
    // Inside, it caches by input reference; that's what keeps useSyncExternalStore from
    // looping when consumers pass inline-allocating selectors.
    const memoizedSelector = useMemo(() => (selector ? createMemoizedSelector(selector) : null), [selector]);

    const subscribe = useCallback((onStoreChange: () => void) => onyxStore.subscribe(key, onStoreChange), [key]);

    // resultRef holds the last tuple returned to React. We return the same tuple reference
    // when value hasn't changed so React skips the re-render.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([undefined, LOADED_METADATA]);

    const getSnapshot = useCallback((): UseOnyxResult<TReturnValue> => {
        const raw = onyxStore.getState(key);
        const selected = memoizedSelector ? memoizedSelector(raw as OnyxValue<TKey>) : (raw as TReturnValue | undefined);
        const nextValue = (selected ?? undefined) as NonNullable<TReturnValue> | undefined;

        if (resultRef.current[0] === nextValue) {
            return resultRef.current;
        }
        resultRef.current = [nextValue, LOADED_METADATA];
        return resultRef.current;
    }, [key, memoizedSelector]);

    return useSyncExternalStore(subscribe, getSnapshot);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};
