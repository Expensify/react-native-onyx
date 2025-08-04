import {deepEqual, shallowEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {DependencyList} from 'react';
import OnyxCache, {TASK} from './OnyxCache';
import type {Connection} from './OnyxConnectionManager';
import connectionManager from './OnyxConnectionManager';
import OnyxUtils from './OnyxUtils';
import * as GlobalSettings from './GlobalSettings';
import type {CollectionKeyBase, OnyxKey, OnyxValue} from './types';
import usePrevious from './usePrevious';
import decorateWithMetrics from './metrics';
import * as Logger from './Logger';
import onyxSnapshotCache from './OnyxSnapshotCache';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
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

    /**
     * If set to `true`, the key can be changed dynamically during the component lifecycle.
     */
    allowDynamicKey?: boolean;

    /**
     * If the component calling this is the one loading the data by calling an action, then you should set this to `true`.
     *
     * If the component calling this does not load the data then you should set it to `false`, which means that if the data
     * is not there, it will log an alert, as it means we are using data that no one loaded and that's most probably a bug.
     */
    canBeMissing?: boolean;

    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     * @see `useOnyx` cannot return `null` and so selector will replace `null` with `undefined` to maintain compatibility.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

type FetchStatus = 'loading' | 'loaded';

type ResultMetadata<TValue> = {
    status: FetchStatus;
    sourceValue?: NonNullable<TValue> | undefined;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata<TValue>];

function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: UseOnyxOptions<TKey, TReturnValue>,
    dependencies: DependencyList = [],
): UseOnyxResult<TReturnValue> {
    const connectionRef = useRef<Connection | null>(null);
    const previousKey = usePrevious(key);

    // Create memoized version of selector for performance
    const memoizedSelector = useMemo(() => {
        if (!options?.selector) return null;

        let lastInput: OnyxValue<TKey> | undefined;
        let lastOutput: TReturnValue;
        let hasComputed = false;

        return (input: OnyxValue<TKey> | undefined): TReturnValue => {
            // Always recompute when input changes
            if (!hasComputed || lastInput !== input) {
                const newOutput = options.selector!(input);

                // Deep equality mode: only update if output actually changed
                if (!hasComputed || !deepEqual(lastOutput, newOutput)) {
                    lastInput = input;
                    lastOutput = newOutput;
                    hasComputed = true;
                }
            }

            return lastOutput;
        };
    }, [options?.selector]);

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

    // Indicates if the hook is connecting to an Onyx key.
    const isConnectingRef = useRef(false);

    // Stores the `onStoreChange()` function, which can be used to trigger a `getSnapshot()` update when desired.
    const onStoreChangeFnRef = useRef<(() => void) | null>(null);

    // Indicates if we should get the newest cached value from Onyx during `getSnapshot()` execution.
    const shouldGetCachedValueRef = useRef(true);

    // Inside useOnyx.ts, we need to track the sourceValue separately
    const sourceValueRef = useRef<NonNullable<TReturnValue> | undefined>(undefined);

    // Cache the selector key to avoid regenerating it every getSnapshot call
    const selectorKeyRef = useRef<string | null>(null);

    // Generate selector key and update when selector changes
    const currentSelectorKey = onyxSnapshotCache.generateSelectorKey(options);
    if (selectorKeyRef.current !== currentSelectorKey) {
        selectorKeyRef.current = currentSelectorKey;
    }

    useEffect(() => {
        // These conditions will ensure we can only handle dynamic collection member keys from the same collection.
        if (options?.allowDynamicKey || previousKey === key) {
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
    }, [previousKey, key, options?.allowDynamicKey]);

    useEffect(() => {
        // This effect will only run if the `dependencies` array changes. If it changes it will force the hook
        // to trigger a `getSnapshot()` update by calling the stored `onStoreChange()` function reference, thus
        // re-running the hook and returning the latest value to the consumer.
        if (connectionRef.current === null || isConnectingRef.current || !onStoreChangeFnRef.current) {
            return;
        }

        // Invalidate cache when dependencies change so selector runs with new closure values
        onyxSnapshotCache.invalidateForKey(key as string);
        shouldGetCachedValueRef.current = true;
        onStoreChangeFnRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...dependencies]);

    // Mimics withOnyx's checkEvictableKeys() behavior.
    const checkEvictableKey = useCallback(() => {
        if (options?.canEvict === undefined || !connectionRef.current) {
            return;
        }

        if (!OnyxCache.isEvictableKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({evictableKeys: []}).`);
        }

        if (options.canEvict) {
            connectionManager.removeFromEvictionBlockList(connectionRef.current);
        } else {
            connectionManager.addToEvictionBlockList(connectionRef.current);
        }
    }, [key, options?.canEvict]);

    const getSnapshot = useCallback(() => {
        const selectorKey = selectorKeyRef.current!;
        const keyStr = key as string;

        // Check if we have any cache for this Onyx key
        // Don't use cache for first connection with initWithStoredValues: false
        // Also don't use cache during active data updates (when shouldGetCachedValueRef is true)
        if (!(isFirstConnectionRef.current && options?.initWithStoredValues === false) && !shouldGetCachedValueRef.current) {
            const cachedResult = onyxSnapshotCache.getCachedResult(keyStr, selectorKey);
            if (cachedResult !== undefined) {
                resultRef.current = cachedResult;
                return cachedResult;
            }
        }

        let isOnyxValueDefined = true;

        // We return the initial result right away during the first connection if `initWithStoredValues` is set to `false`.
        if (isFirstConnectionRef.current && options?.initWithStoredValues === false) {
            const result = resultRef.current;
            // Store result in snapshot cache
            onyxSnapshotCache.setCachedResult(keyStr, selectorKey, result);
            return result;
        }

        // We get the value from cache while the first connection to Onyx is being made,
        // so we can return any cached value right away. After the connection is made, we only
        // update `newValueRef` when `Onyx.connect()` callback is fired.
        if (isFirstConnectionRef.current || shouldGetCachedValueRef.current) {
            // Gets the value from cache and maps it with selector. It changes `null` to `undefined` for `useOnyx` compatibility.
            const value = OnyxUtils.tryGetCachedValue(key) as OnyxValue<TKey>;
            const selectedValue = memoizedSelector ? memoizedSelector(value) : value;
            newValueRef.current = (selectedValue ?? undefined) as TReturnValue | undefined;

            // This flag is `false` when the original Onyx value (without selector) is not defined yet.
            // It will be used later to check if we need to log an alert that the value is missing.
            isOnyxValueDefined = value !== null && value !== undefined;

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

        // Optimized equality checking - eliminated redundant deep equality:
        // - Memoized selectors already handle deep equality internally, so we can use fast reference equality
        // - Non-selector cases use shallow equality for object reference checks
        // - Normalize null to undefined to ensure consistent comparison (both represent "no value")
        let areValuesEqual: boolean;
        if (memoizedSelector) {
            const normalizedPrevious = previousValueRef.current ?? undefined;
            const normalizedNew = newValueRef.current ?? undefined;
            areValuesEqual = normalizedPrevious === normalizedNew;
        } else {
            areValuesEqual = shallowEqual(previousValueRef.current ?? undefined, newValueRef.current);
        }

        // We update the cached value and the result in the following conditions:
        // We will update the cached value and the result in any of the following situations:
        // - The previously cached value is different from the new value.
        // - The previously cached value is `null` (not set from cache yet) and we have cache for this key
        //   OR we have a pending `Onyx.clear()` task (if `Onyx.clear()` is running cache might not be available anymore
        //   so we update the cached value/result right away in order to prevent infinite loading state issues).
        const shouldUpdateResult = !areValuesEqual || (previousValueRef.current === null && (hasCacheForKey || OnyxCache.hasPendingTask(TASK.CLEAR)));
        if (shouldUpdateResult) {
            previousValueRef.current = newValueRef.current;

            // If the new value is `null` we default it to `undefined` to ensure the consumer gets a consistent result from the hook.
            const newStatus = newFetchStatus ?? 'loaded';
            resultRef.current = [
                previousValueRef.current ?? undefined,
                {
                    status: newStatus,
                    sourceValue: sourceValueRef.current,
                },
            ];

            // If `canBeMissing` is set to `false` and the Onyx value of that key is not defined,
            // we log an alert so it can be acknowledged by the consumer. Additionally, we won't log alerts
            // if there's a `Onyx.clear()` task in progress.
            if (options?.canBeMissing === false && newStatus === 'loaded' && !isOnyxValueDefined && !OnyxCache.hasPendingTask(TASK.CLEAR)) {
                Logger.logAlert(`useOnyx returned no data for key with canBeMissing set to false for key ${key}`, {showAlert: true});
            }
        }

        // Cache the result for other useOnyx instances
        onyxSnapshotCache.setCachedResult(keyStr, selectorKey, resultRef.current);

        return resultRef.current;
    }, [options?.initWithStoredValues, options?.allowStaleData, options?.canBeMissing, key, memoizedSelector]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            isConnectingRef.current = true;
            onStoreChangeFnRef.current = onStoreChange;

            connectionRef.current = connectionManager.connect<CollectionKeyBase>({
                key,
                callback: (value, callbackKey, sourceValue) => {
                    isConnectingRef.current = false;
                    onStoreChangeFnRef.current = onStoreChange;

                    // Signals that the first connection was made, so some logics in `getSnapshot()`
                    // won't be executed anymore.
                    isFirstConnectionRef.current = false;

                    // Signals that we want to get the newest cached value again in `getSnapshot()`.
                    shouldGetCachedValueRef.current = true;

                    // sourceValue is unknown type, so we need to cast it to the correct type.
                    sourceValueRef.current = sourceValue as NonNullable<TReturnValue>;

                    // Invalidate snapshot cache for this key when data changes
                    onyxSnapshotCache.invalidateForKey(key as string);

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
                isFirstConnectionRef.current = false;
                isConnectingRef.current = false;
                onStoreChangeFnRef.current = null;
            };
        },
        [key, options?.initWithStoredValues, options?.reuseConnection, checkEvictableKey],
    );

    const getSnapshotDecorated = useMemo(() => {
        if (!GlobalSettings.isPerformanceMetricsEnabled()) {
            return getSnapshot;
        }

        return decorateWithMetrics(getSnapshot, 'useOnyx.getSnapshot');
    }, [getSnapshot]);

    useEffect(() => {
        checkEvictableKey();
    }, [checkEvictableKey]);

    const result = useSyncExternalStore<UseOnyxResult<TReturnValue>>(subscribe, getSnapshotDecorated);

    return result;
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};
