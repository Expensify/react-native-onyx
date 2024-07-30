/* eslint-disable no-continue */
import _ from 'underscore';
import lodashPick from 'lodash/pick';
import * as Logger from './Logger';
import cache from './OnyxCache';
import createDeferredTask from './createDeferredTask';
import * as PerformanceUtils from './PerformanceUtils';
import Storage from './storage';
import utils from './utils';
import DevTools from './DevTools';
import type {
    Collection,
    CollectionKey,
    CollectionKeyBase,
    ConnectOptions,
    InitOptions,
    KeyValueMapping,
    Mapping,
    OnyxInputKeyValueMapping,
    OnyxCollection,
    MixedOperationsQueue,
    OnyxKey,
    OnyxMergeCollectionInput,
    OnyxMergeInput,
    OnyxMultiSetInput,
    OnyxSetInput,
    OnyxUpdate,
    OnyxValue,
    OnyxInput,
} from './types';
import OnyxUtils from './OnyxUtils';
import logMessages from './logMessages';

// Keeps track of the last connectionID that was used so we can keep incrementing it
let lastConnectionID = 0;

// Connections can be made before `Onyx.init`. They would wait for this task before resolving
const deferredInitTask = createDeferredTask();

/** Initialize the store with actions and listening for storage events */
function init({
    keys = {},
    initialKeyStates = {},
    safeEvictionKeys = [],
    maxCachedKeysCount = 1000,
    shouldSyncMultipleInstances = Boolean(global.localStorage),
    debugSetState = false,
}: InitOptions): void {
    Storage.init();

    if (shouldSyncMultipleInstances) {
        Storage.keepInstancesSync?.((key, value) => {
            const prevValue = cache.get(key, false) as OnyxValue<typeof key>;
            cache.set(key, value);
            OnyxUtils.keyChanged(key, value as OnyxValue<typeof key>, prevValue);
        });
    }

    if (debugSetState) {
        PerformanceUtils.setShouldDebugSetState(true);
    }

    if (maxCachedKeysCount > 0) {
        cache.setRecentKeysLimit(maxCachedKeysCount);
    }

    OnyxUtils.initStoreValues(keys, initialKeyStates, safeEvictionKeys);

    // Initialize all of our keys with data provided then give green light to any pending connections
    Promise.all([OnyxUtils.addAllSafeEvictionKeysToRecentlyAccessedList(), OnyxUtils.initializeWithDefaultKeyStates()]).then(deferredInitTask.resolve);
}

/**
 * Subscribes a react component's state directly to a store key
 *
 * @example
 * const connectionID = Onyx.connect({
 *     key: ONYXKEYS.SESSION,
 *     callback: onSessionChange,
 * });
 *
 * @param mapping the mapping information to connect Onyx to the components state
 * @param mapping.key ONYXKEY to subscribe to
 * @param [mapping.statePropertyName] the name of the property in the state to connect the data to
 * @param [mapping.withOnyxInstance] whose setState() method will be called with any changed data
 *      This is used by React components to connect to Onyx
 * @param [mapping.callback] a method that will be called with changed data
 *      This is used by any non-React code to connect to Onyx
 * @param [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
 *  component. Default is true.
 * @param [mapping.waitForCollectionCallback] If set to true, it will return the entire collection to the callback as a single object
 * @param [mapping.selector] THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be used to subscribe to a subset of an Onyx key's data.
 *       The sourceData and withOnyx state are passed to the selector and should return the simplified data. Using this setting on `withOnyx` can have very positive
 *       performance benefits because the component will only re-render when the subset of data changes. Otherwise, any change of data on any property would normally
 *       cause the component to re-render (and that can be expensive from a performance standpoint).
 * @param [mapping.initialValue] THIS PARAM IS ONLY USED WITH withOnyx().
 * If included, this will be passed to the component so that something can be rendered while data is being fetched from the DB.
 * Note that it will not cause the component to have the loading prop set to true.
 * @returns an ID to use when calling disconnect
 */
function connect<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): number {
    const mapping = connectOptions as Mapping<TKey>;
    const connectionID = lastConnectionID++;
    const callbackToStateMapping = OnyxUtils.getCallbackToStateMapping();
    callbackToStateMapping[connectionID] = mapping as Mapping<OnyxKey>;
    callbackToStateMapping[connectionID].connectionID = connectionID;

    // When keyChanged is called, a key is passed and the method looks through all the Subscribers in callbackToStateMapping for the matching key to get the connectionID
    // to avoid having to loop through all the Subscribers all the time (even when just one connection belongs to one key),
    // We create a mapping from key to lists of connectionIDs to access the specific list of connectionIDs.
    OnyxUtils.storeKeyByConnections(mapping.key, callbackToStateMapping[connectionID].connectionID);

    if (mapping.initWithStoredValues === false) {
        return connectionID;
    }

    // Commit connection only after init passes
    deferredInitTask.promise
        .then(() => OnyxUtils.addKeyToRecentlyAccessedIfNeeded(mapping))
        .then(() => {
            // Performance improvement
            // If the mapping is connected to an onyx key that is not a collection
            // we can skip the call to getAllKeys() and return an array with a single item
            if (Boolean(mapping.key) && typeof mapping.key === 'string' && !mapping.key.endsWith('_') && cache.getAllKeys().has(mapping.key)) {
                return new Set([mapping.key]);
            }
            return OnyxUtils.getAllKeys();
        })
        .then((keys) => {
            // We search all the keys in storage to see if any are a "match" for the subscriber we are connecting so that we
            // can send data back to the subscriber. Note that multiple keys can match as a subscriber could either be
            // subscribed to a "collection key" or a single key.
            const matchingKeys: string[] = [];
            keys.forEach((key) => {
                if (!OnyxUtils.isKeyMatch(mapping.key, key)) {
                    return;
                }
                matchingKeys.push(key);
            });
            // If the key being connected to does not exist we initialize the value with null. For subscribers that connected
            // directly via connect() they will simply get a null value sent to them without any information about which key matched
            // since there are none matched. In withOnyx() we wait for all connected keys to return a value before rendering the child
            // component. This null value will be filtered out so that the connected component can utilize defaultProps.
            if (matchingKeys.length === 0) {
                if (mapping.key && !OnyxUtils.isCollectionKey(mapping.key)) {
                    cache.addNullishStorageKey(mapping.key);
                }

                // Here we cannot use batching because the nullish value is expected to be set immediately for default props
                // or they will be undefined.
                OnyxUtils.sendDataToConnection(mapping, null, undefined, false);
                return;
            }

            // When using a callback subscriber we will either trigger the provided callback for each key we find or combine all values
            // into an object and just make a single call. The latter behavior is enabled by providing a waitForCollectionCallback key
            // combined with a subscription to a collection key.
            if (typeof mapping.callback === 'function') {
                if (OnyxUtils.isCollectionKey(mapping.key)) {
                    if (mapping.waitForCollectionCallback) {
                        OnyxUtils.getCollectionDataAndSendAsObject(matchingKeys, mapping);
                        return;
                    }

                    // We did not opt into using waitForCollectionCallback mode so the callback is called for every matching key.
                    OnyxUtils.multiGet(matchingKeys).then((values) => {
                        values.forEach((val, key) => {
                            OnyxUtils.sendDataToConnection(mapping, val as OnyxValue<TKey>, key as TKey, true);
                        });
                    });
                    return;
                }

                // If we are not subscribed to a collection key then there's only a single key to send an update for.
                OnyxUtils.get(mapping.key).then((val) => OnyxUtils.sendDataToConnection(mapping, val as OnyxValue<TKey>, mapping.key, true));
                return;
            }

            // If we have a withOnyxInstance that means a React component has subscribed via the withOnyx() HOC and we need to
            // group collection key member data into an object.
            if ('withOnyxInstance' in mapping && mapping.withOnyxInstance) {
                if (OnyxUtils.isCollectionKey(mapping.key)) {
                    OnyxUtils.getCollectionDataAndSendAsObject(matchingKeys, mapping);
                    return;
                }

                // If the subscriber is not using a collection key then we just send a single value back to the subscriber
                OnyxUtils.get(mapping.key).then((val) => OnyxUtils.sendDataToConnection(mapping, val as OnyxValue<TKey>, mapping.key, true));
                return;
            }

            console.error('Warning: Onyx.connect() was found without a callback or withOnyxInstance');
        });

    // The connectionID is returned back to the caller so that it can be used to clean up the connection when it's no longer needed
    // by calling Onyx.disconnect(connectionID).
    return connectionID;
}

/**
 * Remove the listener for a react component
 * @example
 * Onyx.disconnect(connectionID);
 *
 * @param connectionID unique id returned by call to Onyx.connect()
 */
function disconnect(connectionID: number, keyToRemoveFromEvictionBlocklist?: OnyxKey): void {
    const callbackToStateMapping = OnyxUtils.getCallbackToStateMapping();
    if (!callbackToStateMapping[connectionID]) {
        return;
    }

    // Remove this key from the eviction block list as we are no longer
    // subscribing to it and it should be safe to delete again
    if (keyToRemoveFromEvictionBlocklist) {
        OnyxUtils.removeFromEvictionBlockList(keyToRemoveFromEvictionBlocklist, connectionID);
    }

    OnyxUtils.deleteKeyByConnections(lastConnectionID);
    delete callbackToStateMapping[connectionID];
}

/**
 * Write a value to our store with the given key
 *
 * @param key ONYXKEY to set
 * @param value value to store
 */
function set<TKey extends OnyxKey>(key: TKey, value: OnyxSetInput<TKey>): Promise<void> {
    // When we use Onyx.set to set a key we want to clear the current delta changes from Onyx.merge that were queued
    // before the value was set. If Onyx.merge is currently reading the old value from storage, it will then not apply the changes.
    if (OnyxUtils.hasPendingMergeForKey(key)) {
        delete OnyxUtils.getMergeQueue()[key];
    }

    // Onyx.set will ignore `undefined` values as inputs, therefore we can return early.
    if (value === undefined) {
        return Promise.resolve();
    }

    const existingValue = cache.get(key, false);
    // If the existing value as well as the new value are null, we can return early.
    if (existingValue === undefined && value === null) {
        return Promise.resolve();
    }

    // Check if the value is compatible with the existing value in the storage
    const {isCompatible, existingValueType, newValueType} = utils.checkCompatibilityWithExistingValue(value, existingValue);
    if (!isCompatible) {
        Logger.logAlert(logMessages.incompatibleUpdateAlert(key, 'set', existingValueType, newValueType));
        return Promise.resolve();
    }

    // If the value is null, we remove the key from storage
    const {value: valueAfterRemoving, wasRemoved} = OnyxUtils.removeNullValues(key, value);

    const logSetCall = (hasChanged = true) => {
        // Logging properties only since values could be sensitive things we don't want to log
        Logger.logInfo(`set called for key: ${key}${_.isObject(value) ? ` properties: ${_.keys(value).join(',')}` : ''} hasChanged: ${hasChanged}`);
    };

    // Calling "OnyxUtils.removeNullValues" removes the key from storage and cache and updates the subscriber.
    // Therefore, we don't need to further broadcast and update the value so we can return early.
    if (wasRemoved) {
        logSetCall();
        return Promise.resolve();
    }

    const valueWithoutNullValues = valueAfterRemoving as OnyxValue<TKey>;
    const hasChanged = cache.hasValueChanged(key, valueWithoutNullValues);

    logSetCall(hasChanged);

    // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
    const updatePromise = OnyxUtils.broadcastUpdate(key, valueWithoutNullValues, hasChanged);

    // If the value has not changed or the key got removed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
    if (!hasChanged) {
        return updatePromise;
    }

    return Storage.setItem(key, valueWithoutNullValues)
        .catch((error) => OnyxUtils.evictStorageAndRetry(error, set, key, valueWithoutNullValues))
        .then(() => {
            OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.SET, key, valueWithoutNullValues);
            return updatePromise;
        });
}

/**
 * Sets multiple keys and values
 *
 * @example Onyx.multiSet({'key1': 'a', 'key2': 'b'});
 *
 * @param data object keyed by ONYXKEYS and the values to set
 */
function multiSet(data: OnyxMultiSetInput): Promise<void> {
    const keyValuePairsToSet = OnyxUtils.prepareKeyValuePairsForStorage(data, true);

    const updatePromises = keyValuePairsToSet.map(([key, value]) => {
        const prevValue = cache.get(key, false);

        // Update cache and optimistically inform subscribers on the next tick
        cache.set(key, value);
        return OnyxUtils.scheduleSubscriberUpdate(key, value, prevValue);
    });

    return Storage.multiSet(keyValuePairsToSet)
        .catch((error) => OnyxUtils.evictStorageAndRetry(error, multiSet, data))
        .then(() => {
            OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MULTI_SET, undefined, data);
            return Promise.all(updatePromises);
        })
        .then(() => undefined);
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
            // We first only merge the changes, so we can provide these to the native implementation (SQLite uses only delta changes in "JSON_PATCH" to merge)
            // We don't want to remove null values from the "batchedDeltaChanges", because SQLite uses them to remove keys from storage natively.
            const validChanges = mergeQueue[key].filter((change) => {
                const {isCompatible, existingValueType, newValueType} = utils.checkCompatibilityWithExistingValue(change, existingValue);
                if (!isCompatible) {
                    Logger.logAlert(logMessages.incompatibleUpdateAlert(key, 'merge', existingValueType, newValueType));
                }
                return isCompatible;
            }) as Array<OnyxInput<TKey>>;

            if (!validChanges.length) {
                return Promise.resolve();
            }
            const batchedDeltaChanges = OnyxUtils.applyMerge(undefined, validChanges, false);

            // Case (1): When there is no existing value in storage, we want to set the value instead of merge it.
            // Case (2): The presence of a top-level `null` in the merge queue instructs us to drop the whole existing value.
            // In this case, we can't simply merge the batched changes with the existing value, because then the null in the merge queue would have no effect
            const shouldSetValue = !existingValue || mergeQueue[key].includes(null);

            // Clean up the write queue, so we don't apply these changes again
            delete mergeQueue[key];
            delete mergeQueuePromise[key];

            const logMergeCall = (hasChanged = true) => {
                // Logging properties only since values could be sensitive things we don't want to log
                Logger.logInfo(`merge called for key: ${key}${_.isObject(batchedDeltaChanges) ? ` properties: ${_.keys(batchedDeltaChanges).join(',')}` : ''} hasChanged: ${hasChanged}`);
            };

            // If the batched changes equal null, we want to remove the key from storage, to reduce storage size
            const {wasRemoved} = OnyxUtils.removeNullValues(key, batchedDeltaChanges);

            // Calling "OnyxUtils.removeNullValues" removes the key from storage and cache and updates the subscriber.
            // Therefore, we don't need to further broadcast and update the value so we can return early.
            if (wasRemoved) {
                logMergeCall();
                return Promise.resolve();
            }

            // For providers that can't handle delta changes, we need to merge the batched changes with the existing value beforehand.
            // The "preMergedValue" will be directly "set" in storage instead of being merged
            // Therefore we merge the batched changes with the existing value to get the final merged value that will be stored.
            // We can remove null values from the "preMergedValue", because "null" implicates that the user wants to remove a value from storage.
            const preMergedValue = OnyxUtils.applyMerge(shouldSetValue ? undefined : existingValue, [batchedDeltaChanges], true);

            // In cache, we don't want to remove the key if it's null to improve performance and speed up the next merge.
            const hasChanged = cache.hasValueChanged(key, preMergedValue);

            logMergeCall(hasChanged);

            // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
            const updatePromise = OnyxUtils.broadcastUpdate(key, preMergedValue as OnyxValue<TKey>, hasChanged);

            // If the value has not changed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
            if (!hasChanged) {
                return updatePromise;
            }

            return Storage.mergeItem(key, batchedDeltaChanges as OnyxValue<TKey>, preMergedValue as OnyxValue<TKey>, shouldSetValue).then(() => {
                OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MERGE, key, changes, preMergedValue);
                return updatePromise;
            });
        } catch (error) {
            Logger.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
            return Promise.resolve();
        }
    });

    return mergeQueuePromise[key];
}

/**
 * Merges a collection based on their keys
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
function mergeCollection<TKey extends CollectionKeyBase, TMap>(collectionKey: TKey, collection: OnyxMergeCollectionInput<TKey, TMap>): Promise<void> {
    if (!OnyxUtils.isValidNonEmptyCollectionForMerge(collection)) {
        Logger.logInfo('mergeCollection() called with invalid or empty value. Skipping this update.');
        return Promise.resolve();
    }

    const mergedCollection: OnyxInputKeyValueMapping = collection;

    // Confirm all the collection keys belong to the same parent
    const mergedCollectionKeys = Object.keys(mergedCollection);
    if (!OnyxUtils.doAllCollectionItemsBelongToSameParent(collectionKey, mergedCollectionKeys)) {
        return Promise.resolve();
    }

    return OnyxUtils.getAllKeys()
        .then((persistedKeys) => {
            // Split to keys that exist in storage and keys that don't
            const keys = mergedCollectionKeys.filter((key) => {
                if (mergedCollection[key] === null) {
                    OnyxUtils.remove(key);
                    return false;
                }
                return true;
            });

            const existingKeys = keys.filter((key) => persistedKeys.has(key));

            const cachedCollectionForExistingKeys = OnyxUtils.getCachedCollection(collectionKey, existingKeys);

            const existingKeyCollection = existingKeys.reduce((obj: OnyxInputKeyValueMapping, key) => {
                const {isCompatible, existingValueType, newValueType} = utils.checkCompatibilityWithExistingValue(mergedCollection[key], cachedCollectionForExistingKeys[key]);
                if (!isCompatible) {
                    Logger.logAlert(logMessages.incompatibleUpdateAlert(key, 'mergeCollection', existingValueType, newValueType));
                    return obj;
                }
                // eslint-disable-next-line no-param-reassign
                obj[key] = mergedCollection[key];
                return obj;
            }, {}) as Record<OnyxKey, OnyxInput<TKey>>;

            const newCollection: Record<OnyxKey, OnyxInput<TKey>> = {};
            keys.forEach((key) => {
                if (persistedKeys.has(key)) {
                    return;
                }
                newCollection[key] = mergedCollection[key];
            });

            // When (multi-)merging the values with the existing values in storage,
            // we don't want to remove nested null values from the data that we pass to the storage layer,
            // because the storage layer uses them to remove nested keys from storage natively.
            const keyValuePairsForExistingCollection = OnyxUtils.prepareKeyValuePairsForStorage(existingKeyCollection, false);

            // We can safely remove nested null values when using (multi-)set,
            // because we will simply overwrite the existing values in storage.
            const keyValuePairsForNewCollection = OnyxUtils.prepareKeyValuePairsForStorage(newCollection, true);

            const promises = [];

            // We need to get the previously existing values so we can compare the new ones
            // against them, to avoid unnecessary subscriber updates.
            const previousCollectionPromise = Promise.all(existingKeys.map((key) => OnyxUtils.get(key).then((value) => [key, value]))).then(Object.fromEntries);

            // New keys will be added via multiSet while existing keys will be updated using multiMerge
            // This is because setting a key that doesn't exist yet with multiMerge will throw errors
            if (keyValuePairsForExistingCollection.length > 0) {
                promises.push(Storage.multiMerge(keyValuePairsForExistingCollection));
            }

            if (keyValuePairsForNewCollection.length > 0) {
                promises.push(Storage.multiSet(keyValuePairsForNewCollection));
            }

            // finalMergedCollection contains all the keys that were merged, without the keys of incompatible updates
            const finalMergedCollection = {...existingKeyCollection, ...newCollection};

            // Prefill cache if necessary by calling get() on any existing keys and then merge original data to cache
            // and update all subscribers
            const promiseUpdate = previousCollectionPromise.then((previousCollection) => {
                cache.merge(finalMergedCollection);
                return OnyxUtils.scheduleNotifyCollectionSubscribers(collectionKey, finalMergedCollection, previousCollection);
            });

            return Promise.all(promises)
                .catch((error) => OnyxUtils.evictStorageAndRetry(error, mergeCollection, collectionKey, mergedCollection))
                .then(() => {
                    OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MERGE_COLLECTION, undefined, mergedCollection);
                    return promiseUpdate;
                });
        })
        .then(() => undefined);
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
    const defaultKeyStates = OnyxUtils.getDefaultKeyStates();
    const initialKeys = Object.keys(defaultKeyStates);

    return OnyxUtils.getAllKeys()
        .then((cachedKeys) => {
            cache.clearNullishStorageKeys();

            const keysToBeClearedFromStorage: OnyxKey[] = [];
            const keyValuesToResetAsCollection: Record<OnyxKey, OnyxCollection<KeyValueMapping[OnyxKey]>> = {};
            const keyValuesToResetIndividually: KeyValueMapping = {};

            const allKeys = new Set([...cachedKeys, ...initialKeys]);

            // The only keys that should not be cleared are:
            // 1. Anything specifically passed in keysToPreserve (because some keys like language preferences, offline
            //      status, or activeClients need to remain in Onyx even when signed out)
            // 2. Any keys with a default state (because they need to remain in Onyx as their default, and setting them
            //      to null would cause unknown behavior)
            //   2.1 However, if a default key was explicitly set to null, we need to reset it to the default value
            allKeys.forEach((key) => {
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
                        if (OnyxUtils.isCollectionKey(collectionKey)) {
                            if (!keyValuesToResetAsCollection[collectionKey]) {
                                keyValuesToResetAsCollection[collectionKey] = {};
                            }
                            keyValuesToResetAsCollection[collectionKey]![key] = newValue ?? undefined;
                        } else {
                            keyValuesToResetIndividually[key] = newValue ?? undefined;
                        }
                    }
                }

                if (isKeyToPreserve || isDefaultKey) {
                    return;
                }

                // If it isn't preserved and doesn't have a default, we'll remove it
                keysToBeClearedFromStorage.push(key);
            });

            const updatePromises: Array<Promise<void>> = [];

            // Notify the subscribers for each key/value group so they can receive the new values
            Object.entries(keyValuesToResetIndividually).forEach(([key, value]) => {
                updatePromises.push(OnyxUtils.scheduleSubscriberUpdate(key, value, cache.get(key, false)));
            });
            Object.entries(keyValuesToResetAsCollection).forEach(([key, value]) => {
                updatePromises.push(OnyxUtils.scheduleNotifyCollectionSubscribers(key, value));
            });

            const defaultKeyValuePairs = Object.entries(
                Object.keys(defaultKeyStates)
                    .filter((key) => !keysToPreserve.includes(key))
                    .reduce((obj: KeyValueMapping, key) => {
                        // eslint-disable-next-line no-param-reassign
                        obj[key] = defaultKeyStates[key];
                        return obj;
                    }, {}),
            );

            // Remove only the items that we want cleared from storage, and reset others to default
            keysToBeClearedFromStorage.forEach((key) => cache.drop(key));
            return Storage.removeItems(keysToBeClearedFromStorage)
                .then(() => Storage.multiSet(defaultKeyValuePairs))
                .then(() => {
                    DevTools.clearState(keysToPreserve);
                    return Promise.all(updatePromises);
                });
        })
        .then(() => undefined);
}

function updateSnapshots(data: OnyxUpdate[]) {
    const snapshotCollectionKey = OnyxUtils.getSnapshotKey();
    if (!snapshotCollectionKey) return;

    const promises: Array<() => Promise<void>> = [];

    const snapshotCollection = OnyxUtils.getCachedCollection(snapshotCollectionKey);

    Object.entries(snapshotCollection).forEach(([snapshotKey, snapshotValue]) => {
        // Snapshots may not be present in cache. We don't know how to update them so we skip.
        if (!snapshotValue) {
            return;
        }

        let updatedData = {};

        data.forEach(({key, value}) => {
            // snapshots are normal keys so we want to skip update if they are written to Onyx
            if (OnyxUtils.isCollectionMemberKey(snapshotCollectionKey, key)) {
                return;
            }

            if (typeof snapshotValue !== 'object' || !('data' in snapshotValue)) {
                return;
            }

            const snapshotData = snapshotValue.data;
            if (!snapshotData || !snapshotData[key]) {
                return;
            }

            updatedData = {...updatedData, [key]: lodashPick(value, Object.keys(snapshotData[key]))};
        });

        // Skip the update if there's no data to be merged
        if (utils.isEmptyObject(updatedData)) {
            return;
        }

        promises.push(() => merge(snapshotKey, {data: updatedData}));
    });

    return Promise.all(promises.map((p) => p()));
}

/**
 * Insert API responses and lifecycle data into Onyx
 *
 * @param data An array of objects with update expressions
 * @returns resolves when all operations are complete
 */
function update(data: OnyxUpdate[]): Promise<void> {
    // First, validate the Onyx object is in the format we expect
    data.forEach(({onyxMethod, key, value}) => {
        if (![OnyxUtils.METHOD.CLEAR, OnyxUtils.METHOD.SET, OnyxUtils.METHOD.MERGE, OnyxUtils.METHOD.MERGE_COLLECTION, OnyxUtils.METHOD.MULTI_SET].includes(onyxMethod)) {
            throw new Error(`Invalid onyxMethod ${onyxMethod} in Onyx update.`);
        }
        if (onyxMethod === OnyxUtils.METHOD.MULTI_SET) {
            // For multiset, we just expect the value to be an object
            if (typeof value !== 'object' || Array.isArray(value) || typeof value === 'function') {
                throw new Error('Invalid value provided in Onyx multiSet. Onyx multiSet value must be of type object.');
            }
        } else if (onyxMethod !== OnyxUtils.METHOD.CLEAR && typeof key !== 'string') {
            throw new Error(`Invalid ${typeof key} key provided in Onyx update. Onyx key must be of type string.`);
        }
    });

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

    data.forEach(({onyxMethod, key, value}) => {
        switch (onyxMethod) {
            case OnyxUtils.METHOD.SET:
                enqueueSetOperation(key, value);
                break;
            case OnyxUtils.METHOD.MERGE:
                enqueueMergeOperation(key, value);
                break;
            case OnyxUtils.METHOD.MERGE_COLLECTION: {
                const collection = value as Collection<CollectionKey, unknown, unknown>;
                if (!OnyxUtils.isValidNonEmptyCollectionForMerge(collection)) {
                    Logger.logInfo('mergeCollection enqueued within update() with invalid or empty value. Skipping this operation.');
                    break;
                }

                // Confirm all the collection keys belong to the same parent
                const collectionKeys = Object.keys(collection);
                if (OnyxUtils.doAllCollectionItemsBelongToSameParent(key, collectionKeys)) {
                    const mergedCollection: OnyxInputKeyValueMapping = collection;
                    collectionKeys.forEach((collectionKey) => enqueueMergeOperation(collectionKey, mergedCollection[collectionKey]));
                }

                break;
            }
            case OnyxUtils.METHOD.MULTI_SET:
                Object.entries(value).forEach(([entryKey, entryValue]) => enqueueSetOperation(entryKey, entryValue));
                break;
            case OnyxUtils.METHOD.CLEAR:
                clearPromise = clear();
                break;
            default:
                break;
        }
    });

    // Group all the collection-related keys and update each collection in a single `mergeCollection` call.
    // This is needed to prevent multiple `mergeCollection` calls for the same collection and `merge` calls for the individual items of the said collection.
    // This way, we ensure there is no race condition in the queued updates of the same key.
    OnyxUtils.getCollectionKeys().forEach((collectionKey) => {
        const collectionItemKeys = Object.keys(updateQueue).filter((key) => OnyxUtils.isKeyMatch(collectionKey, key));
        if (collectionItemKeys.length <= 1) {
            // If there are no items of this collection in the updateQueue, we should skip it.
            // If there is only one item, we should update it individually, therefore retain it in the updateQueue.
            return;
        }

        const batchedCollectionUpdates = collectionItemKeys.reduce(
            (queue: MixedOperationsQueue, key: string) => {
                const operations = updateQueue[key];

                // Remove the collection-related key from the updateQueue so that it won't be processed individually.
                delete updateQueue[key];

                const updatedValue = OnyxUtils.applyMerge(undefined, operations, false);
                if (operations[0] === null) {
                    // eslint-disable-next-line no-param-reassign
                    queue.set[key] = updatedValue;
                } else {
                    // eslint-disable-next-line no-param-reassign
                    queue.merge[key] = updatedValue;
                }
                return queue;
            },
            {
                merge: {},
                set: {},
            },
        );

        if (!utils.isEmptyObject(batchedCollectionUpdates.merge)) {
            promises.push(() => mergeCollection(collectionKey, batchedCollectionUpdates.merge as Collection<CollectionKey, unknown, unknown>));
        }
        if (!utils.isEmptyObject(batchedCollectionUpdates.set)) {
            promises.push(() => multiSet(batchedCollectionUpdates.set));
        }
    });

    Object.entries(updateQueue).forEach(([key, operations]) => {
        const batchedChanges = OnyxUtils.applyMerge(undefined, operations, false);

        if (operations[0] === null) {
            promises.push(() => set(key, batchedChanges));
        } else {
            promises.push(() => merge(key, batchedChanges));
        }
    });

    return clearPromise
        .then(() => Promise.all(promises.map((p) => p())))
        .then(() => updateSnapshots(data))
        .then(() => undefined);
}

const Onyx = {
    METHOD: OnyxUtils.METHOD,
    connect,
    disconnect,
    set,
    multiSet,
    merge,
    mergeCollection,
    update,
    clear,
    init,
    registerLogger: Logger.registerLogger,
} as const;

export default Onyx;
export type {OnyxUpdate, Mapping, ConnectOptions};
