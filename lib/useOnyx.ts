import {deepEqual, shallowEqual} from 'fast-equals';
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import type {IsEqual} from 'type-fest';
import Onyx from './Onyx';
import OnyxCache from './OnyxCache';
import OnyxUtils from './OnyxUtils';
import type {CollectionKeyBase, OnyxCollection, OnyxEntry, OnyxKey, OnyxValue, Selector} from './types';
import useLiveRef from './useLiveRef';
import usePrevious from './usePrevious';

type BaseUseOnyxOptions = {
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
};

type UseOnyxInitialValueOption<TInitialValue> = {
    /**
     * This value will be returned by the hook on the first render while the data is being read from Onyx.
     */
    initialValue?: TInitialValue;
};

type UseOnyxSelectorOption<TKey extends OnyxKey, TReturnValue> = {
    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     */
    selector?: Selector<TKey, unknown, TReturnValue>;
};

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = BaseUseOnyxOptions & UseOnyxInitialValueOption<TReturnValue> & UseOnyxSelectorOption<TKey, TReturnValue>;

type FetchStatus = 'loading' | 'loaded';

type SelectedValue<TKey, TValue> = TKey extends CollectionKeyBase ? OnyxCollection<TValue> : OnyxEntry<TValue>;

type CachedValue<TKey extends OnyxKey, TValue> = IsEqual<TValue, OnyxValue<TKey>> extends true ? TValue : SelectedValue<TKey, TValue>;

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TKey extends OnyxKey, TValue> = [CachedValue<TKey, TValue>, ResultMetadata];

function getCachedValue<TKey extends OnyxKey, TValue>(key: TKey, selector?: Selector<TKey, unknown, unknown>): CachedValue<TKey, TValue> | undefined {
    return (OnyxUtils.tryGetCachedValue(key, {selector}) ?? undefined) as CachedValue<TKey, TValue> | undefined;
}

function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: BaseUseOnyxOptions & UseOnyxInitialValueOption<TReturnValue> & Required<UseOnyxSelectorOption<TKey, TReturnValue>>,
): UseOnyxResult<TKey, TReturnValue>;
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: BaseUseOnyxOptions & UseOnyxInitialValueOption<NoInfer<TReturnValue>>,
): UseOnyxResult<TKey, TReturnValue>;
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TKey, TReturnValue> {
    const connectionIDRef = useRef<number | null>(null);
    const previousKey = usePrevious(key);

    // Used to stabilize the selector reference and avoid unnecessary calls to `getSnapshot()`.
    const selectorRef = useLiveRef(options?.selector);

    // Stores the previous cached value as it's necessary to compare with the new value in `getSnapshot()`.
    // We initialize it to `null` to simulate that we don't have any value from cache yet.
    const previousValueRef = useRef<CachedValue<TKey, TReturnValue> | undefined | null>(null);

    // Stores the newest cached value in order to compare with the previous one and optimize `getSnapshot()` execution.
    const newValueRef = useRef<CachedValue<TKey, TReturnValue> | undefined | null>(null);

    // Stores the previously result returned by the hook, containing the data from cache and the fetch status.
    // We initialize it to `undefined` and `loading` fetch status to simulate the initial result when the hook is loading from the cache.
    // However, if `initWithStoredValues` is `true` we set the fetch status to `loaded` since we want to signal that data is ready.
    const resultRef = useRef<UseOnyxResult<TKey, TReturnValue>>([
        undefined as CachedValue<TKey, TReturnValue>,
        {
            status: options?.initWithStoredValues === false ? 'loaded' : 'loading',
        },
    ]);

    // Indicates if it's the first Onyx connection of this hook or not, as we don't want certain use cases
    // in `getSnapshot()` to be satisfied several times.
    const isFirstConnectionRef = useRef(true);

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

            if (OnyxUtils.isCollectionMemberKey(previousCollectionKey, previousKey) && OnyxUtils.isCollectionMemberKey(collectionKey, key) && previousCollectionKey === collectionKey) {
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
        // We get the value from cache while the first connection to Onyx is being made,
        // so we can return any cached value right away. After the connection is made, we only
        // update `newValueRef` when `Onyx.connect()` callback is fired.
        if (isFirstConnectionRef.current || shouldGetCachedValueRef.current) {
            // If `newValueRef.current` is `undefined` it means that the cache doesn't have a value for that key yet.
            // If `newValueRef.current` is `null` or any other value it means that the cache does have a value for that key.
            // This difference between `undefined` and other values is crucial and it's used to address the following
            // conditions and use cases.
            newValueRef.current = getCachedValue<TKey, TReturnValue>(key, selectorRef.current);

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
            newValueRef.current = (options?.initialValue ?? undefined) as CachedValue<TKey, TReturnValue>;
            newFetchStatus = 'loaded';
        }

        // We do a deep equality check if we are subscribed to a collection key OR `selector` is defined,
        // since each `OnyxUtils.tryGetCachedValue()` call will generate a plain new collection object when using a collection key,
        // or a new primitive/object/array that was created using the `selector` function.
        // For the other cases we will only deal with object reference checks, so just a shallow equality check is enough.
        let areValuesEqual: boolean;
        if (OnyxUtils.isCollectionKey(key) || selectorRef.current) {
            areValuesEqual = deepEqual(previousValueRef.current ?? undefined, newValueRef.current);
        } else {
            areValuesEqual = shallowEqual(previousValueRef.current ?? undefined, newValueRef.current);
        }

        // If the previously cached value is different from the new value, we update both cached value
        // and the result to be returned by the hook.
        // If the cache was set for the first time, we also update the cached value and the result.
        const isCacheSetFirstTime = previousValueRef.current === null && hasCacheForKey;
        if (isCacheSetFirstTime || !areValuesEqual) {
            previousValueRef.current = newValueRef.current;

            // If the new value is `null` we default it to `undefined` to ensure the consumer gets a consistent result from the hook.
            resultRef.current = [previousValueRef.current as CachedValue<TKey, TReturnValue>, {status: newFetchStatus ?? 'loaded'}];
        }

        return resultRef.current;
    }, [key, selectorRef, options?.allowStaleData, options?.initialValue]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            connectionIDRef.current = Onyx.connect<CollectionKeyBase>({
                key,
                callback: () => {
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

        if (!OnyxUtils.isSafeEvictionKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
        }

        if (options.canEvict) {
            OnyxUtils.removeFromEvictionBlockList(key, connectionIDRef.current);
        } else {
            OnyxUtils.addToEvictionBlockList(key, connectionIDRef.current);
        }
    }, [key, options?.canEvict]);

    const result = useSyncExternalStore<UseOnyxResult<TKey, TReturnValue>>(subscribe, getSnapshot);

    return result;
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult};
