import {deepEqual, shallowEqual} from 'fast-equals';
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import type {DependencyList} from 'react';
import OnyxCache, {TASK} from './OnyxCache';
import type {Connection} from './OnyxConnectionManager';
import connectionManager from './OnyxConnectionManager';
import OnyxUtils from './OnyxUtils';
import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';
import useLiveRef from './useLiveRef';
import usePrevious from './usePrevious';

type BaseUseOnyxOptions = {
    /**
     * Determines if this key in this subscription is safe to be evicted.
     */
    canEvict?: boolean;

    /**
     * If set to `false`, then no data will be prefilled into the component.
     */
    initWithStoredValues?: boolean;

    /**
     * If set to `true`, data will be retrieved from cache during the first render even if there is a pending merge for the key.
     */
    allowStaleData?: boolean;

    /**
     * If set to `false`, the connection won't be reused between other subscribers that are listening to the same Onyx key
     * with the same connect configurations.
     */
    reuseConnection?: boolean;
};

type UseOnyxInitialValueOption<TInitialValue> = {
    /**
     * This value will be returned by the hook on the first render while the data is being read from Onyx.
     */
    initialValue?: TInitialValue;
};

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxSelectorOption<TKey extends OnyxKey, TReturnValue> = {
    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     * @see `useOnyx` cannot return `null` and so selector will replace `null` with `undefined` to maintain compatibility.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = BaseUseOnyxOptions & UseOnyxInitialValueOption<TReturnValue> & UseOnyxSelectorOption<TKey, TReturnValue>;

type FetchStatus = 'loading' | 'loaded';

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata];

/**
 * Gets the cached value from the Onyx cache. If the key is a collection key, it will return all the values in the collection.
 * It is a fork of `tryGetCachedValue` from `OnyxUtils` caused by different selector logic in `useOnyx`. It should be unified in the future, when `withOnyx` is removed.
 */
function tryGetCachedValue<TKey extends OnyxKey>(key: TKey): OnyxValue<OnyxKey> {
    if (!OnyxUtils.isCollectionKey(key)) {
        return OnyxCache.get(key);
    }

    const allCacheKeys = OnyxCache.getAllKeys();

    // It is possible we haven't loaded all keys yet so we do not know if the
    // collection actually exists.
    if (allCacheKeys.size === 0) {
        return;
    }

    const values: OnyxCollection<KeyValueMapping[TKey]> = {};
    allCacheKeys.forEach((cacheKey) => {
        if (!cacheKey.startsWith(key)) {
            return;
        }

        values[cacheKey] = OnyxCache.get(cacheKey);
    });

    return values;
}

/**
 * Gets the value from cache and maps it with selector. It changes `null` to `undefined` for `useOnyx` compatibility.
 */
function getCachedValue<TKey extends OnyxKey, TValue>(key: TKey, selector?: UseOnyxSelector<TKey, TValue>) {
    const value = tryGetCachedValue(key) as OnyxValue<TKey>;

    const selectedValue = selector ? selector(value) : (value as TValue);

    return selectedValue ?? undefined;
}

function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: BaseUseOnyxOptions & UseOnyxInitialValueOption<TReturnValue> & Required<UseOnyxSelectorOption<TKey, TReturnValue>>,
    dependencies?: DependencyList,
): UseOnyxResult<TReturnValue>;
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: BaseUseOnyxOptions & UseOnyxInitialValueOption<NoInfer<TReturnValue>>,
    dependencies?: DependencyList,
): UseOnyxResult<TReturnValue>;
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: UseOnyxOptions<TKey, TReturnValue>,
    dependencies: DependencyList = [],
): UseOnyxResult<TReturnValue> {
    const connectionRef = useRef<Connection | null>(null);
    const previousKey = usePrevious(key);

    // Used to stabilize the selector reference and avoid unnecessary calls to `getSnapshot()`.
    const selectorRef = useLiveRef(options?.selector);

    // Stores the previous cached value as it's necessary to compare with the new value in `getSnapshot()`.
    // We initialize it to `null` to simulate that we don't have any value from cache yet.
    const previousValueRef = useRef<TReturnValue | undefined | null>(null);

    // Stores the newest cached value in order to compare with the previous one and optimize `getSnapshot()` execution.
    const newValueRef = useRef<TReturnValue | undefined | null>(null);

    // Stores the previously result returned by the hook, containing the data from cache and the fetch status.
    // We initialize it to `undefined` and `loading` fetch status to simulate the initial result when the hook is loading from the cache.
    // However, if `initWithStoredValues` is `false` we set the fetch status to `loaded` since we want to signal that data is ready.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([
        undefined,
        {
            status: options?.initWithStoredValues === false ? 'loaded' : 'loading',
        },
    ]);

    // Indicates if it's the first Onyx connection of this hook or not, as we don't want certain use cases
    // in `getSnapshot()` to be satisfied several times.
    const isFirstConnectionRef = useRef(true);

    const isConnectingRef = useRef(false);

    const onStoreChangeFnRef = useRef<(() => void) | null>(null);

    // Indicates if we should get the newest cached value from Onyx during `getSnapshot()` execution.
    const shouldGetCachedValueRef = useRef(true);

    useEffect(() => {
        // These conditions will ensure we can only handle dynamic collection member keys from the same collection.
        if (previousKey === key) {
            return;
        }

        try {
            const previousCollectionKey = OnyxUtils.splitCollectionMemberKey(previousKey)[0];
            const collectionKey = OnyxUtils.splitCollectionMemberKey(key)[0];

            if (
                OnyxUtils.isCollectionMemberKey(previousCollectionKey, previousKey, previousCollectionKey.length) &&
                OnyxUtils.isCollectionMemberKey(collectionKey, key, collectionKey.length) &&
                previousCollectionKey === collectionKey
            ) {
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

    // eslint-disable-next-line rulesdir/prefer-early-return
    useEffect(() => {
        if (connectionRef.current !== null && !isConnectingRef.current && onStoreChangeFnRef.current) {
            shouldGetCachedValueRef.current = true;
            onStoreChangeFnRef.current();
        }
    }, [...dependencies]);

    // Mimics withOnyx's checkEvictableKeys() behavior.
    const checkEvictableKey = useCallback(() => {
        if (options?.canEvict === undefined || !connectionRef.current) {
            return;
        }

        if (!OnyxUtils.isSafeEvictionKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
        }

        if (options.canEvict) {
            connectionManager.removeFromEvictionBlockList(connectionRef.current);
        } else {
            connectionManager.addToEvictionBlockList(connectionRef.current);
        }
    }, [key, options?.canEvict]);

    const getSnapshot = useCallback(() => {
        // We return the initial result right away during the first connection if `initWithStoredValues` is set to `false`.
        if (isFirstConnectionRef.current && options?.initWithStoredValues === false) {
            return resultRef.current;
        }

        // We get the value from cache while the first connection to Onyx is being made,
        // so we can return any cached value right away. After the connection is made, we only
        // update `newValueRef` when `Onyx.connect()` callback is fired.
        if (isFirstConnectionRef.current || shouldGetCachedValueRef.current) {
            // If `newValueRef.current` is `undefined` it means that the cache doesn't have a value for that key yet.
            // If `newValueRef.current` is `null` or any other value it means that the cache does have a value for that key.
            // This difference between `undefined` and other values is crucial and it's used to address the following
            // conditions and use cases.
            newValueRef.current = getCachedValue(key, selectorRef.current);

            // We set this flag to `false` again since we don't want to get the newest cached value every time `getSnapshot()` is executed,
            // and only when `Onyx.connect()` callback is fired.
            shouldGetCachedValueRef.current = false;
        }

        const hasCacheForKey = OnyxCache.hasCacheForKey(key);

        // Since the fetch status can be different given the use cases below, we define the variable right away.
        let newFetchStatus: FetchStatus | undefined;

        // If we have pending merge operations for the key during the first connection, we set the new value to `undefined`
        // and fetch status to `loading` to simulate that it is still being loaded until we have the most updated data.
        // If `allowStaleData` is `true` this logic will be ignored and cached value will be used, even if it's stale data.
        if (isFirstConnectionRef.current && OnyxUtils.hasPendingMergeForKey(key) && !options?.allowStaleData) {
            newValueRef.current = undefined;
            newFetchStatus = 'loading';
        }

        // If data is not present in cache and `initialValue` is set during the first connection,
        // we set the new value to `initialValue` and fetch status to `loaded` since we already have some data to return to the consumer.
        if (isFirstConnectionRef.current && !hasCacheForKey && options?.initialValue !== undefined) {
            newValueRef.current = (options?.initialValue ?? undefined) as TReturnValue;
            newFetchStatus = 'loaded';
        }

        // We do a deep equality check if `selector` is defined, since each `tryGetCachedValue()` call will
        // generate a plain new primitive/object/array that was created using the `selector` function.
        // For the other cases we will only deal with object reference checks, so just a shallow equality check is enough.
        let areValuesEqual: boolean;
        if (selectorRef.current) {
            areValuesEqual = deepEqual(previousValueRef.current ?? undefined, newValueRef.current);
        } else {
            areValuesEqual = shallowEqual(previousValueRef.current ?? undefined, newValueRef.current);
        }

        // We updated the cached value and the result in the following conditions:
        // We will update the cached value and the result in any of the following situations:
        // - The previously cached value is different from the new value.
        // - The previously cached value is `null` (not set from cache yet) and we have cache for this key
        //   OR we have a pending `Onyx.clear()` task (if `Onyx.clear()` is running cache might not be available anymore
        //   so we update the cached value/result right away in order to prevent infinite loading state issues).
        const shouldUpdateResult = !areValuesEqual || (previousValueRef.current === null && (hasCacheForKey || OnyxCache.hasPendingTask(TASK.CLEAR)));
        if (shouldUpdateResult) {
            previousValueRef.current = newValueRef.current;

            // If the new value is `null` we default it to `undefined` to ensure the consumer gets a consistent result from the hook.
            resultRef.current = [previousValueRef.current ?? undefined, {status: newFetchStatus ?? 'loaded'}];
        }

        return resultRef.current;
    }, [options?.initWithStoredValues, options?.allowStaleData, options?.initialValue, key, selectorRef]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            isConnectingRef.current = true;
            onStoreChangeFnRef.current = onStoreChange;

            connectionRef.current = connectionManager.connect<CollectionKeyBase>({
                key,
                callback: () => {
                    isConnectingRef.current = false;

                    // Signals that the first connection was made, so some logics in `getSnapshot()`
                    // won't be executed anymore.
                    isFirstConnectionRef.current = false;

                    // Signals that we want to get the newest cached value again in `getSnapshot()`.
                    shouldGetCachedValueRef.current = true;

                    // Finally, we signal that the store changed, making `getSnapshot()` be called again.
                    onStoreChange();
                },
                initWithStoredValues: options?.initWithStoredValues,
                waitForCollectionCallback: OnyxUtils.isCollectionKey(key) as true,
                reuseConnection: options?.reuseConnection,
            });

            checkEvictableKey();

            return () => {
                if (!connectionRef.current) {
                    return;
                }

                connectionManager.disconnect(connectionRef.current);
                onStoreChangeFnRef.current = null;
                isConnectingRef.current = false;
                isFirstConnectionRef.current = false;
            };
        },
        [key, options?.initWithStoredValues, options?.reuseConnection, checkEvictableKey],
    );

    useEffect(() => {
        checkEvictableKey();
    }, [checkEvictableKey]);

    const result = useSyncExternalStore<UseOnyxResult<TReturnValue>>(subscribe, getSnapshot);

    return result;
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult};
