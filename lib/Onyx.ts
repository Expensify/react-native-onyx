import * as Logger from './Logger';
import cache, {TASK} from './OnyxCache';
import Storage from './storage';
import utils from './utils';
import DevTools, {initDevTools} from './DevTools';
import type {
    CollectionKeyBase,
    ConnectOptions,
    InitOptions,
    KeyValueMapping,
    OnyxInputKeyValueMapping,
    MixedOperationsQueue,
    OnyxKey,
    OnyxMergeCollectionInput,
    OnyxSetCollectionInput,
    OnyxMergeInput,
    OnyxMultiSetInput,
    OnyxSetInput,
    OnyxUpdate,
    OnyxValue,
    OnyxInput,
    OnyxMethodMap,
    SetOptions,
} from './types';
import OnyxUtils from './OnyxUtils';
import logMessages from './logMessages';
import type {Connection} from './OnyxConnectionManager';
import connectionManager from './OnyxConnectionManager';
import * as GlobalSettings from './GlobalSettings';
import decorateWithMetrics from './metrics';
import OnyxMerge from './OnyxMerge';

/** Initialize the store with actions and listening for storage events */
function init({
    keys = {},
    initialKeyStates = {},
    evictableKeys = [],
    maxCachedKeysCount = 1000,
    shouldSyncMultipleInstances = !!global.localStorage,
    enablePerformanceMetrics = false,
    enableDevTools = true,
    skippableCollectionMemberIDs = [],
    ramOnlyKeys = [],
    snapshotMergeKeys = [],
}: InitOptions): void {
    if (enablePerformanceMetrics) {
        GlobalSettings.setPerformanceMetricsEnabled(true);
        applyDecorators();
    }

    initDevTools(enableDevTools);

    Storage.init();

    OnyxUtils.setSkippableCollectionMemberIDs(new Set(skippableCollectionMemberIDs));
    OnyxUtils.setSnapshotMergeKeys(new Set(snapshotMergeKeys));

    cache.setRamOnlyKeys(new Set<OnyxKey>(ramOnlyKeys));

    if (shouldSyncMultipleInstances) {
        Storage.keepInstancesSync?.((key, value) => {
            cache.set(key, value);

            // Check if this is a collection member key to prevent duplicate callbacks
            // When a collection is updated, individual members sync separately to other tabs
            // Setting isProcessingCollectionUpdate=true prevents triggering collection callbacks for each individual update
            const isKeyCollectionMember = OnyxUtils.isCollectionMember(key);

            OnyxUtils.keyChanged(key, value as OnyxValue<typeof key>, undefined, isKeyCollectionMember);
        });
    }

    if (maxCachedKeysCount > 0) {
        cache.setRecentKeysLimit(maxCachedKeysCount);
    }

    OnyxUtils.initStoreValues(keys, initialKeyStates, evictableKeys);

    // Initialize all of our keys with data provided then give green light to any pending connections
    Promise.all([cache.addEvictableKeysToRecentlyAccessedList(OnyxUtils.isCollectionKey, OnyxUtils.getAllKeys), OnyxUtils.initializeWithDefaultKeyStates()]).then(
        OnyxUtils.getDeferredInitTask().resolve,
    );
}

/**
 * Connects to an Onyx key given the options passed and listens to its changes.
 * This method will be deprecated soon. Please use `Onyx.connectWithoutView()` instead.
 *
 * @example
 * ```ts
 * const connection = Onyx.connectWithoutView({
 *     key: ONYXKEYS.SESSION,
 *     callback: onSessionChange,
 * });
 * ```
 *
 * @param connectOptions The options object that will define the behavior of the connection.
 * @param connectOptions.key The Onyx key to subscribe to.
 * @param connectOptions.callback A function that will be called when the Onyx data we are subscribed changes.
 * @param connectOptions.waitForCollectionCallback If set to `true`, it will return the entire collection to the callback as a single object.
 * @param connectOptions.selector This will be used to subscribe to a subset of an Onyx key's data. **Only used inside `useOnyx()` hook.**
 *        Using this setting on `useOnyx()` can have very positive performance benefits because the component will only re-render
 *        when the subset of data changes. Otherwise, any change of data on any property would normally
 *        cause the component to re-render (and that can be expensive from a performance standpoint).
 * @returns The connection object to use when calling `Onyx.disconnect()`.
 */
function connect<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): Connection {
    return connectionManager.connect(connectOptions);
}

/**
 * Connects to an Onyx key given the options passed and listens to its changes.
 *
 * @example
 * ```ts
 * const connection = Onyx.connectWithoutView({
 *     key: ONYXKEYS.SESSION,
 *     callback: onSessionChange,
 * });
 * ```
 *
 * @param connectOptions The options object that will define the behavior of the connection.
 * @param connectOptions.key The Onyx key to subscribe to.
 * @param connectOptions.callback A function that will be called when the Onyx data we are subscribed changes.
 * @param connectOptions.waitForCollectionCallback If set to `true`, it will return the entire collection to the callback as a single object.
 * @param connectOptions.selector This will be used to subscribe to a subset of an Onyx key's data. **Only used inside `useOnyx()` hook.**
 *        Using this setting on `useOnyx()` can have very positive performance benefits because the component will only re-render
 *        when the subset of data changes. Otherwise, any change of data on any property would normally
 *        cause the component to re-render (and that can be expensive from a performance standpoint).
 * @returns The connection object to use when calling `Onyx.disconnect()`.
 */
function connectWithoutView<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): Connection {
    return connectionManager.connect(connectOptions);
}

/**
 * Disconnects and removes the listener from the Onyx key.
 *
 * @example
 * ```ts
 * const connection = Onyx.connectWithoutView({
 *     key: ONYXKEYS.SESSION,
 *     callback: onSessionChange,
 * });
 *
 * Onyx.disconnect(connection);
 * ```
 *
 * @param connection Connection object returned by calling `Onyx.connect()` or `Onyx.connectWithoutView()`.
 */
function disconnect(connection: Connection): void {
    connectionManager.disconnect(connection);
}

/**
 * Write a value to our store with the given key
 *
 * @param key ONYXKEY to set
 * @param value value to store
 * @param options optional configuration object
 */
function set<TKey extends OnyxKey>(key: TKey, value: OnyxSetInput<TKey>, options?: SetOptions): Promise<void> {
    return OnyxUtils.afterInit(() => OnyxUtils.setWithRetry({key, value, options}));
}

/**
 * Sets multiple keys and values
 *
 * @example Onyx.multiSet({'key1': 'a', 'key2': 'b'});
 *
 * @param data object keyed by ONYXKEYS and the values to set
 */
function multiSet(data: OnyxMultiSetInput): Promise<void> {
    return OnyxUtils.afterInit(() => OnyxUtils.multiSetWithRetry(data));
}

/**
 * Merge a new value into an existing value at a key.
 *
 * The types of values that can be merged are `Object` and `Array`. To set another type of value use `Onyx.set()`.
 * Values of type `Object` get merged with the old value, whilst for `Array`'s we simply replace the current value with the new one.
 *
 * Calls to `Onyx.merge()` are batched so that any calls performed in a single tick will stack in a queue and get
 * applied in the order they were called. Note: `Onyx.set()` calls do not work this way so use caution when mixing
 * `Onyx.merge()` and `Onyx.set()`.
 *
 * @example
 * Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Joe']); // -> ['Joe']
 * Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Jack']); // -> ['Joe', 'Jack']
 * Onyx.merge(ONYXKEYS.POLICY, {id: 1}); // -> {id: 1}
 * Onyx.merge(ONYXKEYS.POLICY, {name: 'My Workspace'}); // -> {id: 1, name: 'My Workspace'}
 */
function merge<TKey extends OnyxKey>(key: TKey, changes: OnyxMergeInput<TKey>): Promise<void> {
    return OnyxUtils.afterInit(() => {
        const skippableCollectionMemberIDs = OnyxUtils.getSkippableCollectionMemberIDs();
        if (skippableCollectionMemberIDs.size) {
            try {
                const [, collectionMemberID] = OnyxUtils.splitCollectionMemberKey(key);
                if (skippableCollectionMemberIDs.has(collectionMemberID)) {
                    // The key is a skippable one, so we set the new changes to undefined.
                    // eslint-disable-next-line no-param-reassign
                    changes = undefined;
                }
            } catch (e) {
                // The key is not a collection one or something went wrong during split, so we proceed with the function's logic.
            }
        }

        const mergeQueue = OnyxUtils.getMergeQueue();
        const mergeQueuePromise = OnyxUtils.getMergeQueuePromise();

        // Top-level undefined values are ignored
        // Therefore, we need to prevent adding them to the merge queue
        if (changes === undefined) {
            return mergeQueue[key] ? mergeQueuePromise[key] : Promise.resolve();
        }

        // Merge attempts are batched together. The delta should be applied after a single call to get() to prevent a race condition.
        // Using the initial value from storage in subsequent merge attempts will lead to an incorrect final merged value.
        if (mergeQueue[key]) {
            mergeQueue[key].push(changes);
            return mergeQueuePromise[key];
        }
        mergeQueue[key] = [changes];

        mergeQueuePromise[key] = OnyxUtils.get(key).then((existingValue) => {
            // Calls to Onyx.set after a merge will terminate the current merge process and clear the merge queue
            if (mergeQueue[key] == null) {
                return Promise.resolve();
            }

            try {
                const validChanges = mergeQueue[key].filter((change) => {
                    const {isCompatible, existingValueType, newValueType} = utils.checkCompatibilityWithExistingValue(change, existingValue);
                    if (!isCompatible) {
                        Logger.logAlert(logMessages.incompatibleUpdateAlert(key, 'merge', existingValueType, newValueType));
                    }
                    return isCompatible;
                }) as Array<OnyxInput<TKey>>;

                // Clean up the write queue, so we don't apply these changes again.
                delete mergeQueue[key];
                delete mergeQueuePromise[key];

                if (!validChanges.length) {
                    return Promise.resolve();
                }

                // If the last change is null, we can just delete the key.
                // Therefore, we don't need to further broadcast and update the value so we can return early.
                if (validChanges.at(-1) === null) {
                    OnyxUtils.remove(key);
                    OnyxUtils.logKeyRemoved(OnyxUtils.METHOD.MERGE, key);
                    return Promise.resolve();
                }

                return OnyxMerge.applyMerge(key, existingValue, validChanges).then(({mergedValue, updatePromise}) => {
                    OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MERGE, key, changes, mergedValue);
                    return updatePromise;
                });
            } catch (error) {
                Logger.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
                return Promise.resolve();
            }
        });

        return mergeQueuePromise[key];
    });
}

/**
 * Merges a collection based on their keys.
 *
 * @example
 *
 * Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, {
 *     [`${ONYXKEYS.COLLECTION.REPORT}1`]: report1,
 *     [`${ONYXKEYS.COLLECTION.REPORT}2`]: report2,
 * });
 *
 * @param collectionKey e.g. `ONYXKEYS.COLLECTION.REPORT`
 * @param collection Object collection keyed by individual collection member keys and values
 */
function mergeCollection<TKey extends CollectionKeyBase>(collectionKey: TKey, collection: OnyxMergeCollectionInput<TKey>): Promise<void> {
    return OnyxUtils.afterInit(() => OnyxUtils.mergeCollectionWithPatches({collectionKey, collection, isProcessingCollectionUpdate: true}));
}

/**
 * Clear out all the data in the store
 *
 * Note that calling Onyx.clear() and then Onyx.set() on a key with a default
 * key state may store an unexpected value in Storage.
 *
 * E.g.
 * Onyx.clear();
 * Onyx.set(ONYXKEYS.DEFAULT_KEY, 'default');
 * Storage.getItem(ONYXKEYS.DEFAULT_KEY)
 *     .then((storedValue) => console.log(storedValue));
 * null is logged instead of the expected 'default'
 *
 * Onyx.set() might call Storage.setItem() before Onyx.clear() calls
 * Storage.setItem(). Use Onyx.merge() instead if possible. Onyx.merge() calls
 * Onyx.get(key) before calling Storage.setItem() via Onyx.set().
 * Storage.setItem() from Onyx.clear() will have already finished and the merged
 * value will be saved to storage after the default value.
 *
 * @param keysToPreserve is a list of ONYXKEYS that should not be cleared with the rest of the data
 */
function clear(keysToPreserve: OnyxKey[] = []): Promise<void> {
    return OnyxUtils.afterInit(() => {
        const defaultKeyStates = OnyxUtils.getDefaultKeyStates();
        const initialKeys = Object.keys(defaultKeyStates);

        const promise = OnyxUtils.getAllKeys()
            .then((cachedKeys) => {
                cache.clearNullishStorageKeys();

                const keysToBeClearedFromStorage: OnyxKey[] = [];
                const keyValuesToResetIndividually: KeyValueMapping = {};
                // We need to store old and new values for collection keys to properly notify subscribers when clearing Onyx
                // because the notification process needs the old values in cache but at that point they will be already removed from it.
                const keyValuesToResetAsCollection: Record<
                    OnyxKey,
                    {oldValues: Record<string, KeyValueMapping[OnyxKey] | undefined>; newValues: Record<string, KeyValueMapping[OnyxKey] | undefined>}
                > = {};

                const allKeys = new Set([...cachedKeys, ...initialKeys]);

                // The only keys that should not be cleared are:
                // 1. Anything specifically passed in keysToPreserve (because some keys like language preferences, offline
                //      status, or activeClients need to remain in Onyx even when signed out)
                // 2. Any keys with a default state (because they need to remain in Onyx as their default, and setting them
                //      to null would cause unknown behavior)
                //   2.1 However, if a default key was explicitly set to null, we need to reset it to the default value
                for (const key of allKeys) {
                    const isKeyToPreserve = keysToPreserve.includes(key);
                    const isDefaultKey = key in defaultKeyStates;

                    // If the key is being removed or reset to default:
                    // 1. Update it in the cache
                    // 2. Figure out whether it is a collection key or not,
                    //      since collection key subscribers need to be updated differently
                    if (!isKeyToPreserve) {
                        const oldValue = cache.get(key);
                        const newValue = defaultKeyStates[key] ?? null;
                        if (newValue !== oldValue) {
                            cache.set(key, newValue);

                            const collectionKey = OnyxUtils.getCollectionKey(key);

                            if (collectionKey) {
                                if (!keyValuesToResetAsCollection[collectionKey]) {
                                    keyValuesToResetAsCollection[collectionKey] = {oldValues: {}, newValues: {}};
                                }
                                keyValuesToResetAsCollection[collectionKey].oldValues[key] = oldValue;
                                keyValuesToResetAsCollection[collectionKey].newValues[key] = newValue ?? undefined;
                            } else {
                                keyValuesToResetIndividually[key] = newValue ?? undefined;
                            }
                        }
                    }

                    if (isKeyToPreserve || isDefaultKey) {
                        continue;
                    }

                    // If it isn't preserved and doesn't have a default, we'll remove it
                    keysToBeClearedFromStorage.push(key);
                }

                const updatePromises: Array<Promise<void>> = [];

                // Notify the subscribers for each key/value group so they can receive the new values
                for (const [key, value] of Object.entries(keyValuesToResetIndividually)) {
                    updatePromises.push(OnyxUtils.scheduleSubscriberUpdate(key, value));
                }
                for (const [key, value] of Object.entries(keyValuesToResetAsCollection)) {
                    updatePromises.push(OnyxUtils.scheduleNotifyCollectionSubscribers(key, value.newValues, value.oldValues));
                }

                // Exclude RAM-only keys to prevent them from being saved to storage
                const defaultKeyValuePairs = Object.entries(
                    Object.keys(defaultKeyStates)
                        .filter((key) => !keysToPreserve.includes(key) && !OnyxUtils.isRamOnlyKey(key))
                        .reduce((obj: KeyValueMapping, key) => {
                            // eslint-disable-next-line no-param-reassign
                            obj[key] = defaultKeyStates[key];
                            return obj;
                        }, {}),
                );

                // Remove only the items that we want cleared from storage, and reset others to default
                for (const key of keysToBeClearedFromStorage) cache.drop(key);
                return Storage.removeItems(keysToBeClearedFromStorage)
                    .then(() => connectionManager.refreshSessionID())
                    .then(() => Storage.multiSet(defaultKeyValuePairs))
                    .then(() => {
                        DevTools.clearState(keysToPreserve);
                        return Promise.all(updatePromises);
                    });
            })
            .then(() => undefined);

        return cache.captureTask(TASK.CLEAR, promise) as Promise<void>;
    });
}

/**
 * Insert API responses and lifecycle data into Onyx
 *
 * @param data An array of objects with update expressions
 * @returns resolves when all operations are complete
 */
function update<TKey extends OnyxKey>(data: Array<OnyxUpdate<TKey>>): Promise<void> {
    return OnyxUtils.afterInit(() => {
        // The queue of operations within a single `update` call in the format of <item key - list of operations updating the item>.
        // This allows us to batch the operations per item and merge them into one operation in the order they were requested.
        const updateQueue: Record<OnyxKey, Array<OnyxValue<OnyxKey>>> = {};
        const enqueueSetOperation = (key: OnyxKey, value: OnyxValue<OnyxKey>) => {
            // If a `set` operation is enqueued, we should clear the whole queue.
            // Since the `set` operation replaces the value entirely, there's no need to perform any previous operations.
            // To do this, we first put `null` in the queue, which removes the existing value, and then merge the new value.
            updateQueue[key] = [null, value];
        };
        const enqueueMergeOperation = (key: OnyxKey, value: OnyxValue<OnyxKey>) => {
            if (value === null) {
                // If we merge `null`, the value is removed and all the previous operations are discarded.
                updateQueue[key] = [null];
            } else if (!updateQueue[key]) {
                updateQueue[key] = [value];
            } else {
                updateQueue[key].push(value);
            }
        };

        const promises: Array<() => Promise<void>> = [];
        let clearPromise: Promise<void> = Promise.resolve();

        const onyxMethods = Object.values(OnyxUtils.METHOD);
        for (const {onyxMethod, key, value} of data) {
            if (!onyxMethods.includes(onyxMethod)) {
                Logger.logInfo(`Invalid onyxMethod ${onyxMethod} in Onyx update. Skipping this operation.`);
                continue;
            }
            if (onyxMethod !== OnyxUtils.METHOD.CLEAR && onyxMethod !== OnyxUtils.METHOD.MULTI_SET && typeof key !== 'string') {
                Logger.logInfo(`Invalid ${typeof key} key provided in Onyx update. Key must be of type string. Skipping this operation.`);
                continue;
            }

            const handlers: Record<OnyxMethodMap[keyof OnyxMethodMap], (k: typeof key, v: typeof value) => void> = {
                [OnyxUtils.METHOD.SET]: enqueueSetOperation,
                [OnyxUtils.METHOD.MERGE]: enqueueMergeOperation,
                [OnyxUtils.METHOD.MERGE_COLLECTION]: () => {
                    const collection = value as OnyxMergeCollectionInput<OnyxKey>;
                    if (!OnyxUtils.isValidNonEmptyCollectionForMerge(collection)) {
                        Logger.logInfo('Invalid or empty value provided in Onyx mergeCollection. Skipping this operation.');
                        return;
                    }

                    // Confirm all the collection keys belong to the same parent
                    const collectionKeys = Object.keys(collection);
                    if (OnyxUtils.doAllCollectionItemsBelongToSameParent(key, collectionKeys)) {
                        const mergedCollection: OnyxInputKeyValueMapping = collection;
                        for (const collectionKey of collectionKeys) enqueueMergeOperation(collectionKey, mergedCollection[collectionKey]);
                    }
                },
                [OnyxUtils.METHOD.SET_COLLECTION]: (k, v) => promises.push(() => setCollection(k as TKey, v as OnyxSetCollectionInput<TKey>)),
                [OnyxUtils.METHOD.MULTI_SET]: (k, v) => {
                    if (typeof value !== 'object' || Array.isArray(value) || typeof value === 'function') {
                        Logger.logInfo(`Invalid value provided in Onyx multiSet. Value must be of type object. Skipping this operation.`);
                        return;
                    }

                    for (const [entryKey, entryValue] of Object.entries(v as Partial<OnyxInputKeyValueMapping>)) enqueueSetOperation(entryKey, entryValue);
                },
                [OnyxUtils.METHOD.CLEAR]: () => {
                    clearPromise = clear();
                },
            };

            handlers[onyxMethod](key, value);
        }

        // Group all the collection-related keys and update each collection in a single `mergeCollection` call.
        // This is needed to prevent multiple `mergeCollection` calls for the same collection and `merge` calls for the individual items of the said collection.
        // This way, we ensure there is no race condition in the queued updates of the same key.
        for (const collectionKey of OnyxUtils.getCollectionKeys()) {
            const collectionItemKeys = Object.keys(updateQueue).filter((key) => OnyxUtils.isKeyMatch(collectionKey, key));
            if (collectionItemKeys.length <= 1) {
                // If there are no items of this collection in the updateQueue, we should skip it.
                // If there is only one item, we should update it individually, therefore retain it in the updateQueue.
                continue;
            }

            const batchedCollectionUpdates = collectionItemKeys.reduce(
                (queue: MixedOperationsQueue, key: string) => {
                    const operations = updateQueue[key];

                    // Remove the collection-related key from the updateQueue so that it won't be processed individually.
                    delete updateQueue[key];

                    const batchedChanges = OnyxUtils.mergeAndMarkChanges(operations);
                    if (operations[0] === null) {
                        // eslint-disable-next-line no-param-reassign
                        queue.set[key] = batchedChanges.result;
                    } else {
                        // eslint-disable-next-line no-param-reassign
                        queue.merge[key] = batchedChanges.result;
                        if (batchedChanges.replaceNullPatches.length > 0) {
                            // eslint-disable-next-line no-param-reassign
                            queue.mergeReplaceNullPatches[key] = batchedChanges.replaceNullPatches;
                        }
                    }
                    return queue;
                },
                {
                    merge: {},
                    mergeReplaceNullPatches: {},
                    set: {},
                },
            );

            if (!utils.isEmptyObject(batchedCollectionUpdates.merge)) {
                promises.push(() =>
                    OnyxUtils.mergeCollectionWithPatches({
                        collectionKey,
                        collection: batchedCollectionUpdates.merge as OnyxMergeCollectionInput<OnyxKey>,
                        mergeReplaceNullPatches: batchedCollectionUpdates.mergeReplaceNullPatches,
                        isProcessingCollectionUpdate: true,
                    }),
                );
            }
            if (!utils.isEmptyObject(batchedCollectionUpdates.set)) {
                promises.push(() => OnyxUtils.partialSetCollection({collectionKey, collection: batchedCollectionUpdates.set as OnyxSetCollectionInput<OnyxKey>}));
            }
        }

        for (const [key, operations] of Object.entries(updateQueue)) {
            if (operations[0] === null) {
                const batchedChanges = OnyxUtils.mergeChanges(operations).result;
                promises.push(() => set(key, batchedChanges));
                continue;
            }

            for (const operation of operations) {
                promises.push(() => merge(key, operation));
            }
        }

        const snapshotPromises = OnyxUtils.updateSnapshots(data, merge);

        // We need to run the snapshot updates before the other updates so the snapshot data can be updated before the loading state in the snapshot
        const finalPromises = snapshotPromises.concat(promises);

        return clearPromise.then(() => Promise.all(finalPromises.map((p) => p()))).then(() => undefined);
    });
}

/**
 * Sets a collection by replacing all existing collection members with new values.
 * Any existing collection members not included in the new data will be removed.
 *
 * @example
 * Onyx.setCollection(ONYXKEYS.COLLECTION.REPORT, {
 *     [`${ONYXKEYS.COLLECTION.REPORT}1`]: report1,
 *     [`${ONYXKEYS.COLLECTION.REPORT}2`]: report2,
 * });
 *
 * @param collectionKey e.g. `ONYXKEYS.COLLECTION.REPORT`
 * @param collection Object collection keyed by individual collection member keys and values
 */
function setCollection<TKey extends CollectionKeyBase>(collectionKey: TKey, collection: OnyxSetCollectionInput<TKey>): Promise<void> {
    return OnyxUtils.afterInit(() => OnyxUtils.setCollectionWithRetry({collectionKey, collection}));
}

const Onyx = {
    METHOD: OnyxUtils.METHOD,
    connect,
    connectWithoutView,
    disconnect,
    set,
    multiSet,
    merge,
    mergeCollection,
    setCollection,
    update,
    clear,
    init,
    registerLogger: Logger.registerLogger,
};

function applyDecorators() {
    // We are reassigning the functions directly so that internal function calls are also decorated
    // @ts-expect-error Reassign
    connect = decorateWithMetrics(connect, 'Onyx.connect');
    // @ts-expect-error Reassign
    connectWithoutView = decorateWithMetrics(connectWithoutView, 'Onyx.connectWithoutView');
    // @ts-expect-error Reassign
    set = decorateWithMetrics(set, 'Onyx.set');
    // @ts-expect-error Reassign
    multiSet = decorateWithMetrics(multiSet, 'Onyx.multiSet');
    // @ts-expect-error Reassign
    merge = decorateWithMetrics(merge, 'Onyx.merge');
    // @ts-expect-error Reassign
    mergeCollection = decorateWithMetrics(mergeCollection, 'Onyx.mergeCollection');
    // @ts-expect-error Reassign
    update = decorateWithMetrics(update, 'Onyx.update');
    // @ts-expect-error Reassign
    clear = decorateWithMetrics(clear, 'Onyx.clear');
}

export default Onyx;
export type {OnyxUpdate, ConnectOptions, SetOptions};
