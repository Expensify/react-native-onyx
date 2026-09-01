import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector';

import type {OnyxKey, OnyxValue} from './types';

import cache from './OnyxCache';
import onyxStore from './OnyxStore';
import OnyxUtils from './OnyxUtils';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
    /**
     * Select a subset of the key's data. Re-renders only when the selector's output changes by deep
     * equality, so an inline selector that allocates fresh objects/arrays each render is safe.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

/**
 * `loading` only on a key's first connection while a merge is in flight and nothing is cached yet
 * (the merge will produce the first value); `loaded` otherwise.
 */
type FetchStatus = 'loading' | 'loaded';

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata];

/**
 * Subscribes a component to an Onyx key, re-rendering when the value changes (for a collection key,
 * when any member changes; the value is the frozen collection object). Returns `[value, {status}]`,
 * `status` `loading` only on the first connection while a merge is in flight and nothing is cached yet.
 *
 * Selection is delegated to `useSyncExternalStoreWithSelector`, whose dedup survives the selector's
 * identity changing every render, so consumers can pass inline selectors without stabilizing them.
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // First-render marker for the loading gate below.
    const connectedKeyRef = useRef<OnyxKey | null>(null);

    const subscribe = useCallback((onStoreChange: () => void) => onyxStore.subscribe(key, onStoreChange), [key]);
    const getSnapshot = useCallback(() => onyxStore.getState(key) as OnyxValue<TKey> | undefined, [key]);

    const select = useCallback((data: OnyxValue<TKey> | undefined): TReturnValue | undefined => (selector ? selector(data) : (data as TReturnValue | undefined)) ?? undefined, [selector]);

    // Deep-equal only with a selector (its output may be freshly allocated); raw values are ref-stable.
    const isEqual = selector ? deepEqual : undefined;

    const value = useSyncExternalStoreWithSelector<OnyxValue<TKey> | undefined, TReturnValue | undefined>(subscribe, getSnapshot, undefined, select, isEqual);

    // Loading only on a key's first render when a merge is in flight and nothing is cached yet.
    // A cached key stays loaded, so an optimistic merge never blanks shown data and a no-op merge can't leave it stuck.
    // connectedKeyRef limits this to the first render.
    // eslint-disable-next-line react-hooks/refs
    const isLoading = connectedKeyRef.current !== key && !cache.hasCacheForKey(key) && OnyxUtils.hasPendingMergeForKey(key);
    const loadingStatus: FetchStatus = isLoading ? 'loading' : 'loaded';

    useEffect(() => {
        connectedKeyRef.current = key;
    }, [key]);

    // Blank the value while loading: the pending merge isn't in cache yet.
    const result = isLoading ? undefined : (value as NonNullable<TReturnValue> | undefined);

    return useMemo<UseOnyxResult<TReturnValue>>(() => [result, {status: loadingStatus}], [result, loadingStatus]);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};
