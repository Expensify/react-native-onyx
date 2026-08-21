import {useCallback, useEffect, useMemo, useRef} from 'react';
import {deepEqual} from 'fast-equals';
import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector';
import onyxStore from './OnyxStore';
import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
    /**
     * Subscribe to a subset of an Onyx key's data. The component re-renders only when the
     * selector's output *changes by deep equality* — a selector that allocates a fresh object
     * (e.g. `(e) => ({id: e?.id})`) or one whose identity churns every render (an inline
     * selector closing over a fresh array) is collapsed to a stable reference internally, so it
     * never causes `useSyncExternalStore` to loop and never forces a redundant re-render.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

/**
 * Always `'loaded'` in the store-based design. The type is preserved so existing
 * destructures like `const [val, {status}] = useOnyx(KEY)` keep compiling. Will be
 * removed in a future cleanup once consumers stop reading it.
 */
type FetchStatus = 'loading' | 'loaded';

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata];

/**
 * Subscribes a React component to an Onyx key. The component re-renders when the value
 * at `key` changes (for collection keys, when any member changes — the returned value is
 * the frozen collection snapshot).
 *
 * Returns `[value, {status: 'loaded'}]`. With eager-load + the structural-sharing cache,
 * there's no loading phase — the cache always has an answer (a value or "absent"). The
 * `status` field is retained for API compatibility and is always `'loaded'`.
 *
 * Selector stability is delegated to React's `useSyncExternalStoreWithSelector`: the selection
 * is deduped against the last value committed to React (by deep equality when a selector is
 * present), and that dedup survives the selector function's *identity* changing every render.
 * So consumers can pass inline selectors that close over freshly allocated arrays/objects
 * without stabilizing the inputs themselves. Subscriptions without a selector read the raw,
 * already reference-stable cache value and rely on the default `Object.is` comparison (no
 * deep-equal cost).
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // Tracks the key this hook has already connected to, so we can tell a key's first render apart from
    // later ones (see the loading-status gate below). Starts null so the initial mount counts as first.
    const connectedKeyRef = useRef<OnyxKey | null>(null);

    const subscribe = useCallback((onStoreChange: () => void) => onyxStore.subscribe(key, onStoreChange), [key]);
    const getSnapshot = useCallback(() => onyxStore.getState(key) as OnyxValue<TKey> | undefined, [key]);

    // Normalizes `null` -> `undefined` and applies the consumer's selector (or passes the raw value
    // through). Re-created only when the selector's identity changes; the committed-value dedup inside
    // `useSyncExternalStoreWithSelector` is what makes a churning identity harmless.
    const select = useCallback((data: OnyxValue<TKey> | undefined): TReturnValue | undefined => (selector ? selector(data) : (data as TReturnValue | undefined)) ?? undefined, [selector]);

    // With a selector, dedupe the (possibly freshly allocated) output by deep equality. Without one,
    // the raw cache value is already reference-stable, so the default `Object.is` is enough.
    const isEqual = selector ? deepEqual : undefined;

    const value = useSyncExternalStoreWithSelector<OnyxValue<TKey> | undefined, TReturnValue | undefined>(subscribe, getSnapshot, undefined, select, isEqual);

    // `loading` only on a key's first render (mount or key change) when a merge is still in flight for it.
    // `connectedKeyRef` differs from `key` only on that first render; the effect below catches it up, so a
    // later merge on an already-connected key never surfaces loading.
    // Reading the ref during render is safe: it's written only in the effect below and re-renders are driven
    // by `useSyncExternalStore` and the `key` prop, so it can't cause a missed update — it gates a one-shot signal.
    // eslint-disable-next-line react-hooks/refs
    const isLoading = connectedKeyRef.current !== key && OnyxUtils.hasPendingMergeForKey(key);
    const loadingStatus: FetchStatus = isLoading ? 'loading' : 'loaded';

    useEffect(() => {
        connectedKeyRef.current = key;
    }, [key]);

    // While loading, the pending merge's result isn't in cache yet, so surface `undefined` until it applies.
    const result = isLoading ? undefined : (value as NonNullable<TReturnValue> | undefined);

    // Stable result tuple: re-built only when the (already deduped) `result` reference or the primitive
    // `loadingStatus` changes, so render-to-render the same cached tuple (and metadata object) is returned.
    return useMemo<UseOnyxResult<TReturnValue>>(() => [result, {status: loadingStatus}], [result, loadingStatus]);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};
