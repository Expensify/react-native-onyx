import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector';

import type {OnyxKey, OnyxValue} from './types';

import cache from './OnyxCache';
import onyxSubscriptionManager from './OnyxSubscriptionManager';
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
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // First-render marker for the loading gate below.
    const connectedKeyRef = useRef<OnyxKey | null>(null);

    const subscribe = useCallback((onStoreChange: () => void) => onyxSubscriptionManager.subscribe(key, onStoreChange), [key]);
    const getSnapshot = useCallback(() => onyxSubscriptionManager.getState(key) as OnyxValue<TKey> | undefined, [key]);

    const select = useCallback((data: OnyxValue<TKey> | undefined): TReturnValue | undefined => (selector ? selector(data) : (data as TReturnValue | undefined)) ?? undefined, [selector]);

    // Deep-equal only with a selector (its output may be freshly allocated); raw values are ref-stable.
    const isEqual = selector ? deepEqual : undefined;

    const value = useSyncExternalStoreWithSelector<OnyxValue<TKey> | undefined, TReturnValue | undefined>(subscribe, getSnapshot, undefined, select, isEqual);

    // Reactive cache presence, so the first value landing re-renders even when the selector output is unchanged.
    const isCached = useSyncExternalStore(subscribe, () => cache.hasCacheForKey(key));

    // Loading while a first value is still on its way: nothing cached and a merge in flight.
    // eslint-disable-next-line react-hooks/refs
    const isLoading = connectedKeyRef.current !== key && !isCached && OnyxUtils.hasPendingMergeForKey(key);
    const loadingStatus: FetchStatus = isLoading ? 'loading' : 'loaded';

    // Only advance the marker once a value exists, so an unrelated re-render can't end loading early.
    useEffect(() => {
        if (!isCached) {
            return;
        }
        connectedKeyRef.current = key;
    }, [isCached, key]);

    // Blank the value while loading: the pending merge isn't in cache yet.
    const result = isLoading ? undefined : (value as NonNullable<TReturnValue> | undefined);

    return useMemo<UseOnyxResult<TReturnValue>>(() => [result, {status: loadingStatus}], [result, loadingStatus]);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};
