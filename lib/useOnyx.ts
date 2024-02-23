import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import Onyx from './Onyx';
import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxEntry, OnyxKey, Selector} from './types';
import useLiveRef from './useLiveRef';
import usePrevious from './usePrevious';

type OnyxValue<TKey extends OnyxKey> = TKey extends CollectionKeyBase ? OnyxCollection<KeyValueMapping[TKey]> : OnyxEntry<KeyValueMapping[TKey]>;

type UseOnyxOptions<TKey extends OnyxKey, TReturnData> = {
    /**
     * Determines if this key in this subscription is safe to be evicted.
     */
    canEvict?: boolean;

    /**
     * If set to false, then no data will be prefilled into the component.
     */
    initWithStoredValues?: boolean;

    /**
     * If set to true, data will be retrieved from cache during the first render even if there is a pending merge for the key.
     */
    allowStaleData?: boolean;

    /**
     * Sets an initial value to be returned by the hook during the first render.
     */
    initialValue?: OnyxValue<TKey>;

    /**
     * If included, this will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     */
    selector?: Selector<TKey, unknown, TReturnData>;
};

type FetchStatus = 'loading' | 'loaded';

type CachedValue<TKey extends OnyxKey, TValue> = TValue extends OnyxValue<TKey> ? TValue : TKey extends CollectionKeyBase ? NonNullable<OnyxCollection<TValue>> : TValue;

type UseOnyxData<TKey extends OnyxKey, TValue> = {
    value: CachedValue<TKey, TValue>;
    status: FetchStatus;
};

function getCachedValue<TKey extends OnyxKey, TValue>(key: TKey, selector?: Selector<TKey, unknown, unknown>): CachedValue<TKey, TValue> {
    return (Onyx.tryGetCachedValue(key, {selector}) ?? null) as CachedValue<TKey, TValue>;
}

function useOnyx<TKey extends OnyxKey, TReturnData = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnData>): UseOnyxData<TKey, TReturnData> {
    const connectionIDRef = useRef<number | null>(null);
    const previousKey = usePrevious(key);

    /**
     * Used to stabilize the selector reference and avoid unnecessary calls to `getSnapshot()`.
     */
    const selectorRef = useLiveRef(options?.selector);

    /**
     * Used to store collection objects or selected data since they aren't stored in the cache.
     */
    const currentDataRef = useRef<CachedValue<TKey, TReturnData> | null>(null);

    const isFirstRenderRef = useRef(true);
    const fetchStatusRef = useRef<FetchStatus>('loading');

    useEffect(() => {
        /**
         * These conditions will ensure we can only handle dynamic collection member keys from the same collection.
         */
        if (previousKey === key) {
            return;
        }

        const previousCollectionKey = Onyx.splitCollectionMemberKey(previousKey)[0];
        const collectionKey = Onyx.splitCollectionMemberKey(key)[0];

        if (Onyx.isCollectionMemberKey(previousCollectionKey, previousKey) && Onyx.isCollectionMemberKey(collectionKey, key) && previousCollectionKey === collectionKey) {
            return;
        }

        throw new Error(
            `'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`,
        );
    }, [previousKey, key]);

    const getSnapshot = useCallback(() => {
        /**
         * Case 1 - We have a non-collection key without selector
         *
         * We just return the data from the Onyx cache.
         */
        if (!Onyx.isCollectionKey(key) && !selectorRef.current) {
            return getCachedValue(key);
        }

        /**
         * Case 2 - We have a collection key and/or selector
         *
         * Since both collection objects and selected data are not directly stored in the cache, we need to generate them with `getCachedValue`
         * and deep compare with our previous internal data.
         *
         * If they are not equal, we update the internal data and return it.
         *
         * If they are equal, we just return the previous internal data.
         */
        const newData = getCachedValue(key, selectorRef.current);
        if (!deepEqual(currentDataRef.current, newData)) {
            currentDataRef.current = newData as CachedValue<TKey, TReturnData>;
        }

        return currentDataRef.current as CachedValue<TKey, TReturnData>;
    }, [key, selectorRef]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            connectionIDRef.current = Onyx.connect({
                key: key as CollectionKeyBase,
                callback: () => {
                    /**
                     * We don't need to update the Onyx cache again here, when `callback` is called the cache is already
                     * expected to be updated, so we just signal that the store changed and `getSnapshot()` can be called.
                     */
                    fetchStatusRef.current = 'loaded';
                    onStoreChange();
                },
                initWithStoredValues: options?.initWithStoredValues,
                waitForCollectionCallback: Onyx.isCollectionKey(key),
            });

            return () => {
                if (!connectionIDRef.current) {
                    return;
                }

                Onyx.disconnect(connectionIDRef.current);

                /**
                 * Sets the fetch status back to "loading" as we are connecting to a new key.
                 */
                fetchStatusRef.current = 'loading';
            };
        },
        [key, options?.initWithStoredValues],
    );

    /**
     * Mimics withOnyx's checkEvictableKeys() behavior.
     */
    useEffect(() => {
        if (options?.canEvict === undefined || !connectionIDRef.current) {
            return;
        }

        if (!Onyx.isSafeEvictionKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
        }

        if (options.canEvict) {
            Onyx.removeFromEvictionBlockList(key, connectionIDRef.current);
        } else {
            Onyx.addToEvictionBlockList(key, connectionIDRef.current);
        }
    }, [key, options?.canEvict]);

    let storeValue = useSyncExternalStore<CachedValue<TKey, TReturnData>>(subscribe, getSnapshot);
    let resultValue: CachedValue<TKey, TReturnData> | null = isFirstRenderRef.current ? null : storeValue;

    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;

        /**
         * Sets the fetch status to "loaded" and `value` to `initialValue` in the first render if we don't have anything in the cache and `initialValue` is set.
         */
        if (storeValue === null && options?.initialValue !== undefined) {
            fetchStatusRef.current = 'loaded';
            storeValue = options.initialValue as CachedValue<TKey, TReturnData>;
        }

        /**
         * Sets the fetch status to "loaded" in the first render if data is already retrieved from cache.
         */
        if ((storeValue !== null && !Onyx.hasPendingMergeForKey(key)) || options?.allowStaleData) {
            fetchStatusRef.current = 'loaded';
            resultValue = storeValue;
        }
    }

    return {value: resultValue as CachedValue<TKey, TReturnData>, status: fetchStatusRef.current};
}

export default useOnyx;
