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
     * This value will be returned by the hook on the first render while the data is being read from Onyx.
     */
    initialValue?: OnyxValue<TKey>;

    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     */
    selector?: Selector<TKey, unknown, TReturnData>;
};

type FetchStatus = 'loading' | 'loaded';

type CachedValue<TKey extends OnyxKey, TValue> = TValue extends OnyxValue<TKey> ? TValue : TKey extends CollectionKeyBase ? NonNullable<OnyxCollection<TValue>> : TValue;

type UseOnyxData<TKey extends OnyxKey, TValue> = [
    CachedValue<TKey, TValue>,
    {
        status: FetchStatus;
    },
];

function getCachedValue<TKey extends OnyxKey, TValue>(key: TKey, selector?: Selector<TKey, unknown, unknown>): CachedValue<TKey, TValue> | undefined {
    return Onyx.tryGetCachedValue(key, {selector}) as CachedValue<TKey, TValue> | undefined;
}

function useOnyx<TKey extends OnyxKey, TReturnData = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnData>): UseOnyxData<TKey, TReturnData> {
    const connectionIDRef = useRef<number | null>(null);
    const previousKey = usePrevious(key);

    // Used to stabilize the selector reference and avoid unnecessary calls to `getSnapshot()`.
    const selectorRef = useLiveRef(options?.selector);

    // Stores the previous cached data as it's necessary to compare with new data in `getSnapshot()`.
    // We initialize it to `undefined` to simulate that we don't have any value from cache yet.
    const cachedValueRef = useRef<CachedValue<TKey, TReturnData> | undefined>(undefined);

    // Stores the previously data returned by the hook, containing the data from cache and the fetch status.
    // We initialize it to `null` and `loading` fetch status to simulate the return data when the hook is loading from the cache.
    const dataRef = useRef<UseOnyxData<TKey, TReturnData>>([null as CachedValue<TKey, TReturnData>, {status: 'loading'}]);

    // Indicates if it's the first Onyx connection of this hook or not, as we don't want certain use cases
    // in `getSnapshot()` to be satisfied several times.
    const isFirstConnectionRef = useRef(true);

    useEffect(() => {
        // These conditions will ensure we can only handle dynamic collection member keys from the same collection.
        if (previousKey === key) {
            return;
        }

        try {
            const previousCollectionKey = Onyx.splitCollectionMemberKey(previousKey)[0];
            const collectionKey = Onyx.splitCollectionMemberKey(key)[0];

            if (Onyx.isCollectionMemberKey(previousCollectionKey, previousKey) && Onyx.isCollectionMemberKey(collectionKey, key) && previousCollectionKey === collectionKey) {
                return;
            }
        } catch (e) {
            throw new Error(
                `'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`,
            );
        }

        throw new Error(
            `'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`,
        );
    }, [previousKey, key]);

    const getSnapshot = useCallback(() => {
        // We get the data from the cache, supplying a selector too in case it's defined.
        // If `newData` is `undefined` it means that the cache doesn't have a value for that key yet.
        // If `newData` is `null` or any other value if means that the cache does have a value for that key.
        // This difference between `undefined` and other values is crucial and it's used to address the following
        // conditions and use cases.
        let newData = getCachedValue(key, selectorRef.current);

        // Since the fetch status can be different given the use cases below, we define the variable right away.
        let newFetchStatus: FetchStatus | undefined;

        // If we have pending merge operations for the key during the first connection, we set data to `undefined`
        // and fetch status to `loading` to simulate that it is still being loaded until we have the most updated data.
        // If `allowStaleData` is `true` this logic will be ignored and cached data will be used, even if it's stale data.
        if (isFirstConnectionRef.current && Onyx.hasPendingMergeForKey(key) && !options?.allowStaleData) {
            newData = undefined;
            newFetchStatus = 'loading';
        }

        // If data is not present in cache (if it's `undefined`) and `initialValue` is set during the first connection,
        // we set data to `initialValue` and fetch status to `loaded` since we already have some data to return to the consumer.
        if (isFirstConnectionRef.current && newData === undefined && options?.initialValue !== undefined) {
            newData = options?.initialValue as CachedValue<TKey, TReturnData>;
            newFetchStatus = 'loaded';
        }

        // If the previously cached data is different from the new data, we update both cached data
        // and the result data to be returned by the hook.
        // We can't directly compare the value from `dataRef` with `newData` because we default `undefined`
        // to `null` when setting `dataRef` value to ensure we have a consistent return, but we need to be able to differentiate
        // between `undefined` and `null` during the comparison, so `cachedValueRef` is used to store the real value without changing
        // to `null`.
        if (!deepEqual(cachedValueRef.current, newData)) {
            cachedValueRef.current = newData as CachedValue<TKey, TReturnData>;

            // If the new data is `undefined` we default it to `null` to ensure the consumer get a consistent result from the hook.
            dataRef.current = [(cachedValueRef.current ?? null) as CachedValue<TKey, TReturnData>, {status: newFetchStatus ?? 'loaded'}];
        }

        return dataRef.current;
    }, [key, selectorRef, options?.allowStaleData, options?.initialValue]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            connectionIDRef.current = Onyx.connect({
                key: key as CollectionKeyBase,
                callback: () => {
                    // We don't need to update the Onyx cache again here, when `callback` is called the cache is already
                    // expected to be updated, so we just signal that the store changed and `getSnapshot()` can be called again.
                    isFirstConnectionRef.current = false;
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
                isFirstConnectionRef.current = false;
            };
        },
        [key, options?.initWithStoredValues],
    );

    // Mimics withOnyx's checkEvictableKeys() behavior.
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

    const data = useSyncExternalStore<UseOnyxData<TKey, TReturnData>>(subscribe, getSnapshot);

    return data;
}

export default useOnyx;
