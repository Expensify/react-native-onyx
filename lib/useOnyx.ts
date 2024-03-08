import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import type {IsEqual} from 'type-fest';
import Onyx from './Onyx';
import type {CollectionKeyBase, OnyxCollection, OnyxKey, OnyxValue, Selector} from './types';
import useLiveRef from './useLiveRef';
import usePrevious from './usePrevious';

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
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
    selector?: Selector<TKey, unknown, TReturnValue>;
};

type FetchStatus = 'loading' | 'loaded';

type CachedValue<TKey extends OnyxKey, TValue> = IsEqual<TValue, OnyxValue<TKey>> extends true ? TValue : TKey extends CollectionKeyBase ? NonNullable<OnyxCollection<TValue>> : TValue;

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TKey extends OnyxKey, TValue> = [CachedValue<TKey, TValue>, ResultMetadata];

function getCachedValue<TKey extends OnyxKey, TValue>(key: TKey, selector?: Selector<TKey, unknown, unknown>): CachedValue<TKey, TValue> | undefined {
    return Onyx.tryGetCachedValue(key, {selector}) as CachedValue<TKey, TValue> | undefined;
}

function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TKey, TReturnValue> {
    const connectionIDRef = useRef<number | null>(null);
    const previousKey = usePrevious(key);

    // Used to stabilize the selector reference and avoid unnecessary calls to `getSnapshot()`.
    const selectorRef = useLiveRef(options?.selector);

    // Stores the previous cached value as it's necessary to compare with the new value in `getSnapshot()`.
    // We initialize it to `undefined` to simulate that we don't have any value from cache yet.
    const cachedValueRef = useRef<CachedValue<TKey, TReturnValue> | undefined>(undefined);

    // Stores the previously result returned by the hook, containing the data from cache and the fetch status.
    // We initialize it to `null` and `loading` fetch status to simulate the initial result when the hook is loading from the cache.
    // However, if `initWithStoredValues` is `true` we set the fetch status to `loaded` since we want to signal that data is ready.
    const resultRef = useRef<UseOnyxResult<TKey, TReturnValue>>([
        null as CachedValue<TKey, TReturnValue>,
        {
            status: options?.initWithStoredValues === false ? 'loaded' : 'loading',
        },
    ]);

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
        // We get the value from the cache, supplying a selector too in case it's defined.
        // If `newValue` is `undefined` it means that the cache doesn't have a value for that key yet.
        // If `newValue` is `null` or any other value if means that the cache does have a value for that key.
        // This difference between `undefined` and other values is crucial and it's used to address the following
        // conditions and use cases.
        let newValue = getCachedValue<TKey, TReturnValue>(key, selectorRef.current);

        // Since the fetch status can be different given the use cases below, we define the variable right away.
        let newFetchStatus: FetchStatus | undefined;

        // If we have pending merge operations for the key during the first connection, we set the new value to `undefined`
        // and fetch status to `loading` to simulate that it is still being loaded until we have the most updated data.
        // If `allowStaleData` is `true` this logic will be ignored and cached value will be used, even if it's stale data.
        if (isFirstConnectionRef.current && Onyx.hasPendingMergeForKey(key) && !options?.allowStaleData) {
            newValue = undefined;
            newFetchStatus = 'loading';
        }

        // If data is not present in cache (if it's `undefined`) and `initialValue` is set during the first connection,
        // we set the new value to `initialValue` and fetch status to `loaded` since we already have some data to return to the consumer.
        if (isFirstConnectionRef.current && newValue === undefined && options?.initialValue !== undefined) {
            newValue = options?.initialValue as CachedValue<TKey, TReturnValue>;
            newFetchStatus = 'loaded';
        }

        // If the previously cached value is different from the new value, we update both cached value
        // and the result to be returned by the hook.
        if (!deepEqual(cachedValueRef.current, newValue)) {
            cachedValueRef.current = newValue;

            // If the new value is `undefined` we default it to `null` to ensure the consumer get a consistent result from the hook.
            resultRef.current = [(cachedValueRef.current ?? null) as CachedValue<TKey, TReturnValue>, {status: newFetchStatus ?? 'loaded'}];
        }

        return resultRef.current;
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

    const result = useSyncExternalStore<UseOnyxResult<TKey, TReturnValue>>(subscribe, getSnapshot);

    return result;
}

export default useOnyx;

export type {UseOnyxResult};
