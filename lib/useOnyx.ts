import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useRef, useSyncExternalStore} from 'react';
import Onyx from './Onyx';
import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxEntry, OnyxKey, Selector} from './types';
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
     * TODO: Check if we still need this flag and associated logic.
     */
    // allowStaleData?: boolean;

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

type UseOnyxData<TValue> = {
    value: TValue;
    status: FetchStatus;
};

function isCollectionMemberKey<TKey extends OnyxKey>(key: TKey): boolean {
    return key.includes('_') && !key.endsWith('_');
}

function getCachedValue<TKey extends OnyxKey>(key: TKey, selector?: Selector<TKey, unknown, unknown>): OnyxValue<TKey> {
    return (Onyx.tryGetCachedValue(key, {selector}) ?? null) as OnyxValue<TKey>;
}

function useOnyx<TKey extends OnyxKey, TReturnData = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnData>): UseOnyxData<TReturnData> {
    const connectionIDRef = useRef<number | null>(null);
    const previousKey = usePrevious(key);

    /**
     * Used to store collection objects or selected data since they aren't stored in the cache.
     */
    const currentDataRef = useRef<TReturnData | null>(null);

    const isFirstRenderRef = useRef(true);
    const fetchStatusRef = useRef<FetchStatus>('loading');

    useEffect(() => {
        /**
         * This condition will ensure we can only handle dynamic collection member keys.
         */
        if (previousKey === key || (isCollectionMemberKey(previousKey) && isCollectionMemberKey(key))) {
            return;
        }

        throw new Error(
            `'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys e.g. from 'collection_id1' to 'collection_id2'.`,
        );
    }, [previousKey, key]);

    /**
     * According to React docs, `getSnapshot` is a function that returns a snapshot of the data in the store that’s needed by the component.
     * **While the store has not changed, repeated calls to getSnapshot must return the same value.**
     * If the store changes and the returned value is different (as compared by Object.is), React re-renders the component.
     */
    const getSnapshot = useCallback(() => {
        /**
         * Case 1 - We have a non-collection key without selector
         *
         * We just return the data from the Onyx cache.
         */
        if (!Onyx.isCollectionKey(key) && !options?.selector) {
            return getCachedValue(key) as TReturnData;
        }

        /**
         * Case 2 - We have a non-collection key with selector
         *
         * Since selected data is not directly stored in the cache, we need to generate it with `getCachedValue`
         * and deep compare with our previous internal data.
         *
         * If they are not equal, we update the internal data and return it.
         *
         * If they are equal, we just return the previous internal data.
         */
        if (!Onyx.isCollectionKey(key) && options?.selector) {
            const newData = getCachedValue(key, options.selector);
            if (!deepEqual(currentDataRef.current, newData)) {
                currentDataRef.current = newData as TReturnData;
            }

            return currentDataRef.current as TReturnData;
        }

        /**
         * Case 3 - We have a collection key with/without selector
         *
         * Since both collection objects and selected data are not directly stored in the cache, we need to generate them with `getCachedValue`
         * and deep compare with our previous internal data.
         *
         * If they are not equal, we update the internal data and return it.
         *
         * If they are equal, we just return the previous internal data.
         */
        const newData = getCachedValue(key, options?.selector);
        if (!deepEqual(currentDataRef.current, newData)) {
            currentDataRef.current = newData as TReturnData;
        }

        return currentDataRef.current as TReturnData;
    }, [key, options?.selector]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            connectionIDRef.current = Onyx.connect({
                key: key as CollectionKeyBase,
                callback: () => {
                    /**
                     * We don't need to update the Onyx cache again here, when `callback` is called the cache is already
                     * expected to be updated, so we just signal that the store changed and `getSnapshot()` can be called.
                     */
                    onStoreChange();
                    fetchStatusRef.current = 'loaded';
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

    let value = useSyncExternalStore<TReturnData>(subscribe, getSnapshot);

    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;

        /**
         * Sets the fetch status to "loaded" in the first render if data is already retrieved from cache.
         */
        if (value !== null) {
            fetchStatusRef.current = 'loaded';
        }

        /**
         * Sets the fetch status to "loaded" and `value` to `initialValue` in the first render if we don't have anything in the cache and `initialValue` is set.
         */
        if (value === null && options?.initialValue !== undefined) {
            fetchStatusRef.current = 'loaded';
            value = options.initialValue as TReturnData;
        }
    }

    return {value, status: fetchStatusRef.current};
}

export default useOnyx;
