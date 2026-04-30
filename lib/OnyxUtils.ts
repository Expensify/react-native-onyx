import {deepEqual, shallowEqual} from 'fast-equals';
import type {ValueOf} from 'type-fest';
import _ from 'underscore';
import DevTools from './DevTools';
import * as Logger from './Logger';
import type Onyx from './Onyx';
import cache, {TASK} from './OnyxCache';
import OnyxKeys from './OnyxKeys';
import * as Str from './Str';
import Storage from './storage';
import type {
    CollectionKeyBase,
    ConnectOptions,
    DeepRecord,
    DefaultConnectCallback,
    DefaultConnectOptions,
    KeyValueMapping,
    CallbackToStateMapping,
    MultiMergeReplaceNullPatches,
    OnyxCollection,
    OnyxEntry,
    OnyxInput,
    OnyxInputKeyValueMapping,
    OnyxKey,
    OnyxMergeCollectionInput,
    OnyxUpdate,
    OnyxValue,
    Selector,
    MergeCollectionWithPatchesParams,
    SetCollectionParams,
    SetParams,
    OnyxMultiSetInput,
    RetriableOnyxOperation,
} from './types';
import type {FastMergeOptions, FastMergeResult} from './utils';
import utils from './utils';
import type {DeferredTask} from './createDeferredTask';
import createDeferredTask from './createDeferredTask';
import type {StorageKeyValuePair} from './storage/providers/types';
import logMessages from './logMessages';

// Method constants
const METHOD = {
    SET: 'set',
    MERGE: 'merge',
    MERGE_COLLECTION: 'mergecollection',
    SET_COLLECTION: 'setcollection',
    MULTI_SET: 'multiset',
    CLEAR: 'clear',
} as const;

// IndexedDB errors that indicate storage capacity issues where eviction can help
const IDB_STORAGE_ERRORS = [
    'quotaexceedederror', // Browser storage quota exceeded
] as const;

// SQLite errors that indicate storage capacity issues where eviction can help
const SQLITE_STORAGE_ERRORS = [
    'database or disk is full', // Device storage is full
] as const;

const STORAGE_ERRORS = [...IDB_STORAGE_ERRORS, ...SQLITE_STORAGE_ERRORS];

// Max number of retries for failed storage operations
const MAX_STORAGE_OPERATION_RETRY_ATTEMPTS = 5;

// Connection/state errors where the DB needs time to recover — backoff helps, eviction does not
const IDB_CONNECTION_ERRORS = [
    'internal error opening backing store', // Chrome/Edge: corrupted IDB state
    'connection to indexed database server lost', // Safari: IDB connection dropped
    'the database connection is closing', // Cross-browser: DB closing during write
] as const;

const SQLITE_CONNECTION_ERRORS = [
    'disk i/o error', // Native: filesystem/device stress
    'database is locked', // Native: concurrent access contention
] as const;

const CONNECTION_ERRORS = [...IDB_CONNECTION_ERRORS, ...SQLITE_CONNECTION_ERRORS];

// Retry backoff configuration
const RETRY_BASE_DELAY_MS = 100;
const RETRY_JITTER_FACTOR = 0.25;

type OnyxMethod = ValueOf<typeof METHOD>;

// Key/value store of Onyx key and arrays of values to merge
let mergeQueue: Record<OnyxKey, Array<OnyxValue<OnyxKey>>> = {};
let mergeQueuePromise: Record<OnyxKey, Promise<void>> = {};

// Holds a mapping of all the React components that want their state subscribed to a store key
let callbackToStateMapping: Record<string, CallbackToStateMapping<OnyxKey>> = {};

// Holds a mapping of the connected key to the subscriptionID for faster lookups
let onyxKeyToSubscriptionIDs = new Map();

// Optional user-provided key value states set when Onyx initializes or clears
let defaultKeyStates: Record<OnyxKey, OnyxValue<OnyxKey>> = {};

// Used for comparison with a new update to avoid invoking the Onyx.connect callback with the same data.
let lastConnectionCallbackData = new Map<number, {value: OnyxValue<OnyxKey>; matchedKey: OnyxKey | undefined}>();

let snapshotKey: OnyxKey | null = null;

// Keeps track of the last subscriptionID that was used so we can keep incrementing it
let lastSubscriptionID = 0;

// Connections can be made before `Onyx.init`. They would wait for this task before resolving
const deferredInitTask = createDeferredTask();

// Collection member IDs that Onyx should silently ignore across all operations — reads, writes, cache, and subscriber
// notifications. This is used to filter out keys formed from invalid/default IDs (e.g. "-1", "0",
// "undefined", "null", "NaN") that can appear when an ID variable is accidentally coerced to string.
let skippableCollectionMemberIDs = new Set<string>();
// Holds a set of keys that should always be merged into snapshot entries.
let snapshotMergeKeys = new Set<string>();

function getSnapshotKey(): OnyxKey | null {
    return snapshotKey;
}

/**
 * Getter - returns the merge queue.
 */
function getMergeQueue(): Record<OnyxKey, Array<OnyxValue<OnyxKey>>> {
    return mergeQueue;
}

/**
 * Getter - returns the merge queue promise.
 */
function getMergeQueuePromise(): Record<OnyxKey, Promise<void>> {
    return mergeQueuePromise;
}

/**
 * Getter - returns the default key states.
 */
function getDefaultKeyStates(): Record<OnyxKey, OnyxValue<OnyxKey>> {
    return defaultKeyStates;
}

/**
 * Getter - returns the deffered init task.
 */
function getDeferredInitTask(): DeferredTask {
    return deferredInitTask;
}

/**
 * Executes an action after Onyx has been initialized.
 * If Onyx is already initialized, the action is executed immediately.
 * Otherwise, it waits for initialization to complete before executing.
 *
 * @param action The action to execute after initialization
 * @returns The result of the action
 */
function afterInit<T>(action: () => Promise<T>): Promise<T> {
    if (deferredInitTask.isResolved) {
        return action();
    }
    return deferredInitTask.promise.then(action);
}

/**
 * Getter - returns the skippable collection member IDs.
 */
function getSkippableCollectionMemberIDs(): Set<string> {
    return skippableCollectionMemberIDs;
}

/**
 * Getter - returns the snapshot merge keys allowlist.
 */
function getSnapshotMergeKeys(): Set<string> {
    return snapshotMergeKeys;
}

/**
 * Setter - sets the skippable collection member IDs.
 */
function setSkippableCollectionMemberIDs(ids: Set<string>): void {
    skippableCollectionMemberIDs = ids;
}

/**
 * Setter - sets the snapshot merge keys allowlist.
 */
function setSnapshotMergeKeys(keys: Set<string>): void {
    snapshotMergeKeys = keys;
}

/**
 * Sets the initial values for the Onyx store
 *
 * @param keys - `ONYXKEYS` constants object from Onyx.init()
 * @param initialKeyStates - initial data to set when `init()` and `clear()` are called
 * @param evictableKeys - This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal.
 */
function initStoreValues(keys: DeepRecord<string, OnyxKey>, initialKeyStates: Partial<KeyValueMapping>, evictableKeys: OnyxKey[]): void {
    // We need the value of the collection keys later for checking if a
    // key is a collection. We store it in a map for faster lookup.
    const collectionValues = Object.values(keys.COLLECTION ?? {}) as string[];
    const collectionKeySet = collectionValues.reduce((acc, val) => {
        acc.add(val);
        return acc;
    }, new Set<OnyxKey>());

    // Set our default key states to use when initializing and clearing Onyx data
    defaultKeyStates = initialKeyStates;

    DevTools.initState(initialKeyStates);

    // Let Onyx know about which keys are safe to evict
    cache.setEvictionAllowList(evictableKeys);

    // Set collection keys in cache for optimized storage
    cache.setCollectionKeys(collectionKeySet);

    if (typeof keys.COLLECTION === 'object' && typeof keys.COLLECTION.SNAPSHOT === 'string') {
        snapshotKey = keys.COLLECTION.SNAPSHOT;
    }
}

/**
 * Sends an action to DevTools extension
 *
 * @param method - Onyx method from METHOD
 * @param key - Onyx key that was changed
 * @param value - contains the change that was made by the method
 * @param mergedValue - (optional) value that was written in the storage after a merge method was executed.
 */
function sendActionToDevTools(
    method: typeof METHOD.MERGE_COLLECTION | typeof METHOD.MULTI_SET | typeof METHOD.SET_COLLECTION,
    key: undefined,
    value: OnyxCollection<KeyValueMapping[OnyxKey]>,
    mergedValue?: undefined,
): void;
function sendActionToDevTools(
    method: Exclude<OnyxMethod, typeof METHOD.MERGE_COLLECTION | typeof METHOD.MULTI_SET | typeof METHOD.SET_COLLECTION>,
    key: OnyxKey,
    value: OnyxEntry<KeyValueMapping[OnyxKey]>,
    mergedValue?: OnyxEntry<KeyValueMapping[OnyxKey]>,
): void;
function sendActionToDevTools(
    method: OnyxMethod,
    key: OnyxKey | undefined,
    value: OnyxCollection<KeyValueMapping[OnyxKey]> | OnyxEntry<KeyValueMapping[OnyxKey]>,
    mergedValue: OnyxEntry<KeyValueMapping[OnyxKey]> = undefined,
): void {
    DevTools.registerAction(utils.formatActionName(method, key), value, key ? {[key]: mergedValue || value} : (value as OnyxCollection<KeyValueMapping[OnyxKey]>));
}

/**
 * Takes a collection of items (eg. {testKey_1:{a:'a'}, testKey_2:{b:'b'}})
 * and runs it through a reducer function to return a subset of the data according to a selector.
 * The resulting collection will only contain items that are returned by the selector.
 */
function reduceCollectionWithSelector<TKey extends CollectionKeyBase, TReturn>(
    collection: OnyxCollection<KeyValueMapping[TKey]>,
    selector: Selector<TKey, TReturn>,
): Record<string, TReturn> {
    return Object.entries(collection ?? {}).reduce((finalCollection: Record<string, TReturn>, [key, item]) => {
        // eslint-disable-next-line no-param-reassign
        finalCollection[key] = selector(item);

        return finalCollection;
    }, {});
}

/** Get some data from the store */
function get<TKey extends OnyxKey, TValue extends OnyxValue<TKey>>(key: TKey): Promise<TValue> {
    // When we already have the value in cache - resolve right away
    if (cache.hasCacheForKey(key)) {
        return Promise.resolve(cache.get(key) as TValue);
    }

    // RAM-only keys should never read from storage (they may have stale persisted data
    // from before the key was migrated to RAM-only). Mark as nullish so future get() calls
    // short-circuit via hasCacheForKey and avoid re-running this branch.
    if (OnyxKeys.isRamOnlyKey(key)) {
        cache.addNullishStorageKey(key);
        return Promise.resolve(undefined as TValue);
    }

    const taskName = `${TASK.GET}:${key}` as const;

    // When a value retrieving task for this key is still running hook to it
    if (cache.hasPendingTask(taskName)) {
        return cache.getTaskPromise(taskName) as Promise<TValue>;
    }

    // Otherwise retrieve the value from storage and capture a promise to aid concurrent usages
    const promise = Storage.getItem(key)
        .then((val) => {
            if (skippableCollectionMemberIDs.size) {
                try {
                    const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key);
                    if (skippableCollectionMemberIDs.has(collectionMemberID)) {
                        // The key is a skippable one, so we set the value to undefined.
                        // eslint-disable-next-line no-param-reassign
                        val = undefined as OnyxValue<TKey>;
                    }
                } catch (e) {
                    // The key is not a collection one or something went wrong during split, so we proceed with the function's logic.
                }
            }

            if (val === undefined) {
                cache.addNullishStorageKey(key);
                return undefined;
            }

            cache.set(key, val);
            return val;
        })
        .catch((err) => Logger.logInfo(`Unable to get item from persistent storage. Key: ${key} Error: ${err}`));

    return cache.captureTask(taskName, promise) as Promise<TValue>;
}

// multiGet the data first from the cache and then from the storage for the missing keys.
function multiGet<TKey extends OnyxKey>(keys: CollectionKeyBase[]): Promise<Map<OnyxKey, OnyxValue<TKey>>> {
    // Keys that are not in the cache
    const missingKeys: OnyxKey[] = [];

    // Tasks that are pending
    const pendingTasks: Array<Promise<OnyxValue<TKey>>> = [];

    // Keys for the tasks that are pending
    const pendingKeys: OnyxKey[] = [];

    // Data to be sent back to the invoker
    const dataMap = new Map<OnyxKey, OnyxValue<TKey>>();

    /**
     * We are going to iterate over all the matching keys and check if we have the data in the cache.
     * If we do then we add it to the data object. If we do not have them, then we check if there is a pending task
     * for the key. If there is such task, then we add the promise to the pendingTasks array and the key to the pendingKeys
     * array. If there is no pending task then we add the key to the missingKeys array.
     *
     * These missingKeys will be later used to multiGet the data from the storage.
     */
    for (const key of keys) {
        // RAM-only keys should never read from storage as they may have stale persisted data
        // from before the key was migrated to RAM-only.
        if (OnyxKeys.isRamOnlyKey(key)) {
            if (cache.hasCacheForKey(key)) {
                dataMap.set(key, cache.get(key) as OnyxValue<TKey>);
            }
            continue;
        }

        const cacheValue = cache.get(key) as OnyxValue<TKey>;
        if (cacheValue) {
            dataMap.set(key, cacheValue);
            continue;
        }

        const pendingKey = `${TASK.GET}:${key}` as const;
        if (cache.hasPendingTask(pendingKey)) {
            pendingTasks.push(cache.getTaskPromise(pendingKey) as Promise<OnyxValue<TKey>>);
            pendingKeys.push(key);
        } else {
            missingKeys.push(key);
        }
    }

    return (
        Promise.all(pendingTasks)
            // Wait for all the pending tasks to resolve and then add the data to the data map.
            .then((values) => {
                for (const [index, value] of values.entries()) {
                    dataMap.set(pendingKeys[index], value);
                }

                return Promise.resolve();
            })
            // Get the missing keys using multiGet from the storage.
            .then(() => {
                if (missingKeys.length === 0) {
                    return Promise.resolve(undefined);
                }

                return Storage.multiGet(missingKeys);
            })
            // Add the data from the missing keys to the data map and also merge it to the cache.
            .then((values) => {
                if (!values || values.length === 0) {
                    return dataMap;
                }

                // temp object is used to merge the missing data into the cache
                const temp: OnyxCollection<KeyValueMapping[TKey]> = {};
                for (const [key, value] of values) {
                    if (skippableCollectionMemberIDs.size) {
                        try {
                            const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key);
                            if (skippableCollectionMemberIDs.has(collectionMemberID)) {
                                // The key is a skippable one, so we skip this iteration.
                                continue;
                            }
                        } catch (e) {
                            // The key is not a collection one or something went wrong during split, so we proceed with the function's logic.
                        }
                    }

                    dataMap.set(key, value as OnyxValue<TKey>);
                    temp[key] = value as OnyxValue<TKey>;
                }
                cache.merge(temp);
                return dataMap;
            })
    );
}

/**
 * This helper exists to map an array of Onyx keys such as `['report_', 'conciergeReportID']`
 * to the values for those keys (correctly typed) such as `[OnyxCollection<Report>, OnyxEntry<string>]`
 *
 * Note: just using `.map`, you'd end up with `Array<OnyxCollection<Report>|OnyxEntry<string>>`, which is not what we want. This preserves the order of the keys provided.
 */
function tupleGet<Keys extends readonly OnyxKey[]>(keys: Keys): Promise<{[Index in keyof Keys]: OnyxValue<Keys[Index]>}> {
    return Promise.all(keys.map((key) => get(key))) as Promise<{[Index in keyof Keys]: OnyxValue<Keys[Index]>}>;
}

/**
 * Stores a subscription ID associated with a given key.
 *
 * @param subscriptionID - A subscription ID of the subscriber.
 * @param key - A key that the subscriber is subscribed to.
 */
function storeKeyBySubscriptions(key: OnyxKey, subscriptionID: number) {
    if (!onyxKeyToSubscriptionIDs.has(key)) {
        onyxKeyToSubscriptionIDs.set(key, []);
    }
    onyxKeyToSubscriptionIDs.get(key).push(subscriptionID);
}

/**
 * Deletes a subscription ID associated with its corresponding key.
 *
 * @param subscriptionID - The subscription ID to be deleted.
 */
function deleteKeyBySubscriptions(subscriptionID: number) {
    const subscriber = callbackToStateMapping[subscriptionID];

    if (subscriber && onyxKeyToSubscriptionIDs.has(subscriber.key)) {
        const updatedSubscriptionsIDs = onyxKeyToSubscriptionIDs.get(subscriber.key).filter((id: number) => id !== subscriptionID);
        onyxKeyToSubscriptionIDs.set(subscriber.key, updatedSubscriptionsIDs);
    }

    lastConnectionCallbackData.delete(subscriptionID);
}

/** Returns current key names stored in persisted storage */
function getAllKeys(): Promise<Set<OnyxKey>> {
    // When we've already read stored keys, resolve right away
    const cachedKeys = cache.getAllKeys();
    if (cachedKeys.size > 0) {
        return Promise.resolve(cachedKeys);
    }

    // When a value retrieving task for all keys is still running hook to it
    if (cache.hasPendingTask(TASK.GET_ALL_KEYS)) {
        return cache.getTaskPromise(TASK.GET_ALL_KEYS) as Promise<Set<OnyxKey>>;
    }

    // Otherwise retrieve the keys from storage and capture a promise to aid concurrent usages
    const promise = Storage.getAllKeys().then((keys) => {
        // Filter out RAM-only keys from storage results as they may be stale entries
        // from before the key was migrated to RAM-only.
        const filteredKeys = keys.filter((key) => !OnyxKeys.isRamOnlyKey(key));
        cache.setAllKeys(filteredKeys);

        // return the updated set of keys
        return cache.getAllKeys();
    });

    return cache.captureTask(TASK.GET_ALL_KEYS, promise) as Promise<Set<OnyxKey>>;
}

/**
 * Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
 * If the requested key is a collection, it will return an object with all the collection members.
 */
function tryGetCachedValue<TKey extends OnyxKey>(key: TKey): OnyxValue<OnyxKey> {
    let val = cache.get(key);

    if (OnyxKeys.isCollectionKey(key)) {
        const collectionData = cache.getCollectionData(key);
        if (collectionData !== undefined) {
            val = collectionData;
        } else {
            // If we haven't loaded all keys yet, we can't determine if the collection exists
            if (cache.getAllKeys().size === 0) {
                return;
            }
            // Set an empty collection object for collections that exist but have no data
            val = {};
        }
    }

    return val;
}

function getCachedCollection<TKey extends CollectionKeyBase>(collectionKey: TKey, collectionMemberKeys?: string[]): NonNullable<OnyxCollection<KeyValueMapping[TKey]>> {
    // Use optimized collection data retrieval when cache is populated
    const collectionData = cache.getCollectionData(collectionKey);
    const allKeys = collectionMemberKeys || cache.getAllKeys();
    if (collectionData !== undefined && (Array.isArray(allKeys) ? allKeys.length > 0 : allKeys.size > 0)) {
        // If we have specific member keys, filter the collection
        if (collectionMemberKeys) {
            const filteredCollection: OnyxCollection<KeyValueMapping[TKey]> = {};
            for (const key of collectionMemberKeys) {
                if (collectionData[key] !== undefined) {
                    filteredCollection[key] = collectionData[key];
                } else if (cache.hasNullishStorageKey(key)) {
                    filteredCollection[key] = cache.get(key);
                }
            }
            return filteredCollection;
        }

        // Return a copy to avoid mutations affecting the cache
        return {...collectionData};
    }

    // Fallback to original implementation if collection data not available
    const collection: OnyxCollection<KeyValueMapping[TKey]> = {};

    // forEach exists on both Set and Array
    for (const key of allKeys) {
        // If we don't have collectionMemberKeys array then we have to check whether a key is a collection member key.
        // Because in that case the keys will be coming from `cache.getAllKeys()` and we need to filter out the keys that
        // are not part of the collection.
        if (!collectionMemberKeys && !OnyxKeys.isCollectionMemberKey(collectionKey, key)) {
            continue;
        }

        const cachedValue = cache.get(key);

        if (cachedValue === undefined && !cache.hasNullishStorageKey(key)) {
            continue;
        }

        collection[key] = cache.get(key);
    }

    return collection;
}

/**
 * When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks
 */
function keysChanged<TKey extends CollectionKeyBase>(
    collectionKey: TKey,
    partialCollection: OnyxCollection<KeyValueMapping[TKey]>,
    partialPreviousCollection: OnyxCollection<KeyValueMapping[TKey]> | undefined,
): void {
    // We prepare the "cached collection" which is the entire collection + the new partial data that
    // was merged in via mergeCollection().
    const cachedCollection = getCachedCollection(collectionKey);

    const previousCollection = partialPreviousCollection ?? {};

    // We are iterating over all subscribers similar to keyChanged(). However, we are looking for subscribers who are subscribing to either a collection key or
    // individual collection key member for the collection that is being updated. It is important to note that the collection parameter cane be a PARTIAL collection
    // and does not represent all of the combined keys and values for a collection key. It is just the "new" data that was merged in via mergeCollection().
    const stateMappingKeys = Object.keys(callbackToStateMapping);

    for (const stateMappingKey of stateMappingKeys) {
        const subscriber = callbackToStateMapping[stateMappingKey];
        if (!subscriber) {
            continue;
        }

        // Skip iteration if we do not have a collection key or a collection member key on this subscriber
        if (!Str.startsWith(subscriber.key, collectionKey)) {
            continue;
        }

        /**
         * e.g. Onyx.connect({key: ONYXKEYS.COLLECTION.REPORT, callback: ...});
         */
        const isSubscribedToCollectionKey = subscriber.key === collectionKey;

        /**
         * e.g. Onyx.connect({key: `${ONYXKEYS.COLLECTION.REPORT}{reportID}`, callback: ...});
         */
        const isSubscribedToCollectionMemberKey = OnyxKeys.isCollectionMemberKey(collectionKey, subscriber.key);

        // Regular Onyx.connect() subscriber found.
        if (typeof subscriber.callback === 'function') {
            try {
                // If they are subscribed to the collection key and using waitForCollectionCallback then we'll
                // send the whole cached collection.
                if (isSubscribedToCollectionKey) {
                    lastConnectionCallbackData.set(subscriber.subscriptionID, {value: cachedCollection, matchedKey: subscriber.key});

                    if (subscriber.waitForCollectionCallback) {
                        subscriber.callback(cachedCollection, subscriber.key, partialCollection);
                        continue;
                    }

                    // If they are not using waitForCollectionCallback then we notify the subscriber with
                    // the new merged data but only for any keys in the partial collection.
                    const dataKeys = Object.keys(partialCollection ?? {});
                    for (const dataKey of dataKeys) {
                        if (deepEqual(cachedCollection[dataKey], previousCollection[dataKey])) {
                            continue;
                        }

                        subscriber.callback(cachedCollection[dataKey], dataKey);
                    }
                    continue;
                }

                // And if the subscriber is specifically only tracking a particular collection member key then we will
                // notify them with the cached data for that key only.
                if (isSubscribedToCollectionMemberKey) {
                    if (deepEqual(cachedCollection[subscriber.key], previousCollection[subscriber.key])) {
                        continue;
                    }

                    const subscriberCallback = subscriber.callback as DefaultConnectCallback<TKey>;
                    subscriberCallback(cachedCollection[subscriber.key], subscriber.key as TKey);
                    lastConnectionCallbackData.set(subscriber.subscriptionID, {value: cachedCollection[subscriber.key], matchedKey: subscriber.key});
                    continue;
                }

                continue;
            } catch (error) {
                Logger.logAlert(`[OnyxUtils.keysChanged] Subscriber callback threw an error for key '${collectionKey}': ${error}`);
            }
        }
    }
}

/**
 * When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks
 *
 * @example
 * keyChanged(key, value, subscriber => subscriber.initWithStoredValues === false)
 */
function keyChanged<TKey extends OnyxKey>(
    key: TKey,
    value: OnyxValue<TKey>,
    canUpdateSubscriber: (subscriber?: CallbackToStateMapping<OnyxKey>) => boolean = () => true,
    isProcessingCollectionUpdate = false,
): void {
    // Add or remove this key from the recentlyAccessedKeys list
    if (value !== null && value !== undefined) {
        cache.addLastAccessedKey(key, OnyxKeys.isCollectionKey(key));
    } else {
        cache.removeLastAccessedKey(key);
    }

    // We get the subscribers interested in the key that has just changed. If the subscriber's  key is a collection key then we will
    // notify them if the key that changed is a collection member. Or if it is a regular key notify them when there is an exact match.
    // Given the amount of times this function is called we need to make sure we are not iterating over all subscribers every time. On the other hand, we don't need to
    // do the same in keysChanged, because we only call that function when a collection key changes, and it doesn't happen that often.
    // For performance reason, we look for the given key and later if don't find it we look for the collection key, instead of checking if it is a collection key first.
    let stateMappingKeys = onyxKeyToSubscriptionIDs.get(key) ?? [];
    const collectionKey = OnyxKeys.getCollectionKey(key);

    if (collectionKey) {
        // Getting the collection key from the specific key because only collection keys were stored in the mapping.
        stateMappingKeys = [...stateMappingKeys, ...(onyxKeyToSubscriptionIDs.get(collectionKey) ?? [])];
        if (stateMappingKeys.length === 0) {
            return;
        }
    }

    const cachedCollections: Record<string, ReturnType<typeof getCachedCollection>> = {};

    for (const stateMappingKey of stateMappingKeys) {
        const subscriber = callbackToStateMapping[stateMappingKey];
        if (!subscriber || !OnyxKeys.isKeyMatch(subscriber.key, key) || !canUpdateSubscriber(subscriber)) {
            continue;
        }

        // Subscriber is a regular call to connect() and provided a callback
        if (typeof subscriber.callback === 'function') {
            try {
                const lastData = lastConnectionCallbackData.get(subscriber.subscriptionID);
                if (lastData && lastData.matchedKey === key && lastData.value === value) {
                    continue;
                }

                if (OnyxKeys.isCollectionKey(subscriber.key) && subscriber.waitForCollectionCallback) {
                    // Skip individual key changes for collection callbacks during collection updates
                    // to prevent duplicate callbacks - the collection update will handle this properly
                    if (isProcessingCollectionUpdate) {
                        continue;
                    }
                    let cachedCollection = cachedCollections[subscriber.key];

                    if (!cachedCollection) {
                        cachedCollection = getCachedCollection(subscriber.key);
                        cachedCollections[subscriber.key] = cachedCollection;
                    }

                    cachedCollection[key] = value;
                    lastConnectionCallbackData.set(subscriber.subscriptionID, {value: cachedCollection, matchedKey: subscriber.key});
                    subscriber.callback(cachedCollection, subscriber.key, {[key]: value});
                    continue;
                }

                const subscriberCallback = subscriber.callback as DefaultConnectCallback<TKey>;
                subscriberCallback(value, key);

                lastConnectionCallbackData.set(subscriber.subscriptionID, {value, matchedKey: key});
                continue;
            } catch (error) {
                Logger.logAlert(`[OnyxUtils.keyChanged] Subscriber callback threw an error for key '${key}': ${error}`);
            }

            continue;
        }

        console.error('Warning: Found a matching subscriber to a key that changed, but no callback could be found.');
    }
}

/**
 * Sends the data obtained from the keys to the connection.
 */
function sendDataToConnection<TKey extends OnyxKey>(mapping: CallbackToStateMapping<TKey>, matchedKey: TKey | undefined): void {
    // If the mapping no longer exists then we should not send any data.
    // This means our subscriber was disconnected.
    if (!callbackToStateMapping[mapping.subscriptionID]) {
        return;
    }

    // Always read the latest value from cache to avoid stale or duplicate data.
    // For collection subscribers with waitForCollectionCallback, read the full collection.
    // For individual key subscribers, read just that key's value.
    let value: OnyxValue<TKey> | undefined;
    if (OnyxKeys.isCollectionKey(mapping.key) && mapping.waitForCollectionCallback) {
        const collection = getCachedCollection(mapping.key);
        value = Object.keys(collection).length > 0 ? (collection as OnyxValue<TKey>) : undefined;
    } else {
        value = cache.get(matchedKey ?? mapping.key) as OnyxValue<TKey>;
    }

    // For regular callbacks, we never want to pass null values, but always just undefined if a value is not set in cache or storage.
    value = value === null ? undefined : value;
    const lastData = lastConnectionCallbackData.get(mapping.subscriptionID);

    // If the value has not changed for the same key we do not need to trigger the callback.
    // We compare matchedKey to avoid suppressing callbacks for different collection members
    // that happen to have shallow-equal values (e.g. during hydration racing with set()).
    if (lastData && lastData.matchedKey === matchedKey && shallowEqual(lastData.value, value)) {
        return;
    }

    (mapping as DefaultConnectOptions<TKey>).callback?.(value, matchedKey as TKey);
}

/**
 * Gets the data for a given an array of matching keys, combines them into an object, and sends the result back to the subscriber.
 */
function getCollectionDataAndSendAsObject<TKey extends OnyxKey>(matchingKeys: CollectionKeyBase[], mapping: CallbackToStateMapping<TKey>): void {
    multiGet(matchingKeys).then(() => {
        sendDataToConnection(mapping, mapping.key);
    });
}

/**
 * Remove a key from Onyx and update the subscribers
 */
function remove<TKey extends OnyxKey>(key: TKey, isProcessingCollectionUpdate?: boolean): Promise<void> {
    cache.drop(key);
    keyChanged(key, undefined as OnyxValue<TKey>, undefined, isProcessingCollectionUpdate);

    if (OnyxKeys.isRamOnlyKey(key)) {
        return Promise.resolve();
    }

    return Storage.removeItem(key).then(() => undefined);
}

/**
 * Returns a promise that resolves after the given number of milliseconds.
 */
function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Calculates exponential backoff delay with jitter for a given retry attempt.
 * Formula: baseDelay * 2^attempt ± jitter
 * Attempt 0: ~100ms, Attempt 1: ~200ms, ..., Attempt 4: ~1600ms
 */
function getRetryDelay(attempt: number): number {
    const baseDelay = RETRY_BASE_DELAY_MS * 2 ** attempt;
    const jitter = baseDelay * RETRY_JITTER_FACTOR * (2 * Math.random() - 1);
    return Math.max(0, Math.round(baseDelay + jitter));
}

function reportStorageQuota(error?: Error): Promise<void> {
    return Storage.getDatabaseSize()
        .then(({bytesUsed, bytesRemaining}) => {
            Logger.logInfo(`Storage Quota Check -- bytesUsed: ${bytesUsed} bytesRemaining: ${bytesRemaining}. Original error: ${error}`);
        })
        .catch((dbSizeError) => {
            Logger.logAlert(`Unable to get database size. getDatabaseSize error: ${dbSizeError}. Original error: ${error}`);
        });
}

/**
 * Handles storage operation failures based on the error type:
 * - Storage capacity errors: evicts data and retries the operation
 * - Invalid data errors: logs an alert and throws an error
 * - Other errors: retries the operation
 */
function retryOperation<TMethod extends RetriableOnyxOperation>(error: Error, onyxMethod: TMethod, defaultParams: Parameters<TMethod>[0], retryAttempt: number | undefined): Promise<void> {
    const currentRetryAttempt = retryAttempt ?? 0;
    const nextRetryAttempt = currentRetryAttempt + 1;

    Logger.logInfo(`Failed to save to storage. Error: ${error}. onyxMethod: ${onyxMethod.name}. retryAttempt: ${currentRetryAttempt}/${MAX_STORAGE_OPERATION_RETRY_ATTEMPTS}`);

    if (error && Str.startsWith(error.message, "Failed to execute 'put' on 'IDBObjectStore'")) {
        Logger.logAlert(`Attempted to set invalid data set in Onyx. Please ensure all data is serializable. Error: ${error}`);
        throw error;
    }

    const errorMessage = error?.message?.toLowerCase?.();
    const errorName = error?.name?.toLowerCase?.();
    const isStorageCapacityError = STORAGE_ERRORS.some((storageError) => errorName?.includes(storageError) || errorMessage?.includes(storageError));
    const isConnectionError = CONNECTION_ERRORS.some((connError) => errorName?.includes(connError) || errorMessage?.includes(connError));

    if (nextRetryAttempt > MAX_STORAGE_OPERATION_RETRY_ATTEMPTS) {
        if (isConnectionError) {
            Logger.logAlert(`Connection error exhausted all retries with backoff. Error: ${error}. onyxMethod: ${onyxMethod.name}.`);
        } else {
            Logger.logAlert(`Storage operation failed after 5 retries. Error: ${error}. onyxMethod: ${onyxMethod.name}.`);
        }
        return Promise.resolve();
    }

    if (!isStorageCapacityError) {
        const delay = getRetryDelay(currentRetryAttempt);

        if (isConnectionError) {
            Logger.logInfo(`Connection error detected, retrying with backoff (${delay}ms). Error: ${error}. onyxMethod: ${onyxMethod.name}. retryAttempt: ${nextRetryAttempt}/${MAX_STORAGE_OPERATION_RETRY_ATTEMPTS}`);
        }

        return wait(delay).then(() =>
            // @ts-expect-error No overload matches this call.
            onyxMethod(defaultParams, nextRetryAttempt).then(() => {
                if (isConnectionError) {
                    Logger.logInfo(`Connection error recovered after backoff on attempt ${nextRetryAttempt}/${MAX_STORAGE_OPERATION_RETRY_ATTEMPTS}. onyxMethod: ${onyxMethod.name}.`);
                }
            }),
        );
    }

    // Find the least recently accessed evictable key that we can remove
    const keyForRemoval = cache.getKeyForEviction();
    if (!keyForRemoval) {
        // If we have no acceptable keys to remove then we are possibly trying to save mission critical data. If this is the case,
        // then we should stop retrying as there is not much the user can do to fix this. Instead of getting them stuck in an infinite loop we
        // will allow this write to be skipped.
        Logger.logAlert(`Out of storage. But found no acceptable keys to remove. Error: ${error}`);
        return reportStorageQuota(error);
    }

    // Remove the least recently accessed key and retry.
    Logger.logInfo(`Out of storage. Evicting least recently accessed key (${keyForRemoval}) and retrying. Error: ${error}`);
    reportStorageQuota(error);

    // @ts-expect-error No overload matches this call.
    return remove(keyForRemoval).then(() => onyxMethod(defaultParams, nextRetryAttempt));
}

/**
 * Notifies subscribers and writes current value to cache
 */
function broadcastUpdate<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>, hasChanged?: boolean): void {
    // Update subscribers if the cached value has changed, or when the subscriber specifically requires
    // all updates regardless of value changes (indicated by initWithStoredValues set to false).
    if (hasChanged) {
        cache.set(key, value);
    }

    keyChanged(key, value, (subscriber) => hasChanged || subscriber?.initWithStoredValues === false);
}

function hasPendingMergeForKey(key: OnyxKey): boolean {
    return !!mergeQueue[key];
}

/**
 * Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
 * This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
 * to an array of key-value pairs in the above format and removes key-value pairs that are being set to null
 *
 * @return an array of key - value pairs <[key, value]>
 */
function prepareKeyValuePairsForStorage(
    data: Record<OnyxKey, OnyxInput<OnyxKey>>,
    shouldRemoveNestedNulls?: boolean,
    replaceNullPatches?: MultiMergeReplaceNullPatches,
    isProcessingCollectionUpdate?: boolean,
): StorageKeyValuePair[] {
    const pairs: StorageKeyValuePair[] = [];

    for (const [key, value] of Object.entries(data)) {
        if (value === null) {
            remove(key, isProcessingCollectionUpdate);
            continue;
        }

        const valueWithoutNestedNullValues = shouldRemoveNestedNulls ?? true ? utils.removeNestedNullValues(value) : value;

        if (valueWithoutNestedNullValues !== undefined) {
            pairs.push([key, valueWithoutNestedNullValues, replaceNullPatches?.[key]]);
        }
    }

    return pairs;
}

/**
 * Merges an array of changes with an existing value or creates a single change.
 *
 * @param changes Array of changes that should be merged
 * @param existingValue The existing value that should be merged with the changes
 */
function mergeChanges<TValue extends OnyxInput<OnyxKey> | undefined, TChange extends OnyxInput<OnyxKey> | undefined>(changes: TChange[], existingValue?: TValue): FastMergeResult<TChange> {
    return mergeInternal('merge', changes, existingValue);
}

/**
 * Merges an array of changes with an existing value or creates a single change.
 * It will also mark deep nested objects that need to be entirely replaced during the merge.
 *
 * @param changes Array of changes that should be merged
 * @param existingValue The existing value that should be merged with the changes
 */
function mergeAndMarkChanges<TValue extends OnyxInput<OnyxKey> | undefined, TChange extends OnyxInput<OnyxKey> | undefined>(
    changes: TChange[],
    existingValue?: TValue,
): FastMergeResult<TChange> {
    return mergeInternal('mark', changes, existingValue);
}

/**
 * Merges an array of changes with an existing value or creates a single change.
 *
 * @param changes Array of changes that should be merged
 * @param existingValue The existing value that should be merged with the changes
 */
function mergeInternal<TValue extends OnyxInput<OnyxKey> | undefined, TChange extends OnyxInput<OnyxKey> | undefined>(
    mode: 'merge' | 'mark',
    changes: TChange[],
    existingValue?: TValue,
): FastMergeResult<TChange> {
    const lastChange = changes?.at(-1);

    if (Array.isArray(lastChange)) {
        return {result: lastChange, replaceNullPatches: []};
    }

    if (changes.some((change) => change && typeof change === 'object')) {
        // Object values are then merged one after the other
        return changes.reduce<FastMergeResult<TChange>>(
            (modifiedData, change) => {
                const options: FastMergeOptions = mode === 'merge' ? {shouldRemoveNestedNulls: true, objectRemovalMode: 'replace'} : {objectRemovalMode: 'mark'};
                const {result, replaceNullPatches} = utils.fastMerge(modifiedData.result, change, options);

                // eslint-disable-next-line no-param-reassign
                modifiedData.result = result;
                // eslint-disable-next-line no-param-reassign
                modifiedData.replaceNullPatches = [...modifiedData.replaceNullPatches, ...replaceNullPatches];

                return modifiedData;
            },
            {
                result: (existingValue ?? {}) as TChange,
                replaceNullPatches: [],
            },
        );
    }

    // If we have anything else we can't merge it so we'll
    // simply return the last value that was queued
    return {result: lastChange as TChange, replaceNullPatches: []};
}

/**
 * Merge user provided default key value pairs.
 */
function initializeWithDefaultKeyStates(): Promise<void> {
    // Eagerly load the entire database into cache in a single batch read.
    // This is faster than lazy-loading individual keys because:
    // 1. One DB transaction instead of hundreds
    // 2. All subsequent reads are synchronous cache hits
    return Storage.getAll()
        .then((pairs) => {
            const allDataFromStorage: Record<string, unknown> = {};
            for (const [key, value] of pairs) {
                // RAM-only keys should not be cached from storage as they may have stale persisted data
                // from before the key was migrated to RAM-only.
                if (OnyxKeys.isRamOnlyKey(key)) {
                    continue;
                }

                // Skip collection members that are marked as skippable
                if (skippableCollectionMemberIDs.size && OnyxKeys.getCollectionKey(key)) {
                    const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key);

                    if (skippableCollectionMemberIDs.has(collectionMemberID)) {
                        continue;
                    }
                }

                allDataFromStorage[key] = value;
            }

            // Load all storage data into cache silently (no subscriber notifications)
            cache.setAllKeys(Object.keys(allDataFromStorage));
            cache.merge(allDataFromStorage);

            // For keys that have a developer-defined default (via `initialKeyStates`), merge the
            // persisted value with the default so new properties added in code updates are applied
            // without wiping user data that already exists in storage.
            const defaultKeysFromStorage = Object.keys(defaultKeyStates).reduce((obj: Record<string, unknown>, key) => {
                if (key in allDataFromStorage) {
                    // eslint-disable-next-line no-param-reassign
                    obj[key] = allDataFromStorage[key];
                }
                return obj;
            }, {});

            const merged = utils.fastMerge(defaultKeysFromStorage, defaultKeyStates, {
                shouldRemoveNestedNulls: true,
            }).result;
            cache.merge(merged ?? {});

            // Notify subscribers about default key states so that any subscriber that connected
            // before init (e.g. during module load) receives the merged default values immediately
            for (const [key, value] of Object.entries(merged ?? {})) {
                keyChanged(key, value);
            }
        })
        .catch((error) => {
            Logger.logAlert(`Failed to load data from storage during init. The app will boot with default key states only. Error: ${error}`);

            // Populate the key index so getAllKeys() returns correct results for default keys.
            // Without this, subscribers that check getAllKeys() would see an empty set even
            // though we have default values in cache.
            cache.setAllKeys(Object.keys(defaultKeyStates));

            // Boot with defaults so the app renders instead of deadlocking.
            // Users will get a fresh-install experience but the app won't be bricked.
            cache.merge(defaultKeyStates);

            // Notify subscribers about default key states so that any subscriber that connected
            // before init (e.g. during module load) receives the merged default values immediately
            for (const [key, value] of Object.entries(defaultKeyStates)) {
                keyChanged(key, value);
            }
        });
}

/**
 * Validate the collection is not empty and has a correct type before applying mergeCollection()
 */
function isValidNonEmptyCollectionForMerge<TKey extends CollectionKeyBase>(collection: OnyxMergeCollectionInput<TKey>): boolean {
    return typeof collection === 'object' && !Array.isArray(collection) && !utils.isEmptyObject(collection);
}

/**
 * Verify if all the collection keys belong to the same parent
 */
function doAllCollectionItemsBelongToSameParent<TKey extends CollectionKeyBase>(collectionKey: TKey, collectionKeys: string[]): boolean {
    let hasCollectionKeyCheckFailed = false;
    for (const dataKey of collectionKeys) {
        if (OnyxKeys.isKeyMatch(collectionKey, dataKey)) {
            continue;
        }

        if (process.env.NODE_ENV === 'development') {
            throw new Error(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
        }

        hasCollectionKeyCheckFailed = true;
        Logger.logAlert(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
    }

    return !hasCollectionKeyCheckFailed;
}

/**
 * Subscribes to an Onyx key and listens to its changes.
 *
 * @param connectOptions The options object that will define the behavior of the connection.
 * @returns The subscription ID to use when calling `OnyxUtils.unsubscribeFromKey()`.
 */
function subscribeToKey<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): number {
    const mapping = connectOptions as CallbackToStateMapping<TKey>;
    const subscriptionID = lastSubscriptionID++;
    callbackToStateMapping[subscriptionID] = mapping as CallbackToStateMapping<OnyxKey>;
    callbackToStateMapping[subscriptionID].subscriptionID = subscriptionID;

    // If the subscriber is attempting to connect to a collection member whose ID is skippable (e.g. "undefined", "null", etc.)
    // we suppress wiring the subscription fully to avoid unnecessary callback emissions such as for "report_undefined".
    // We still return a valid subscriptionID so callers can disconnect safely.
    try {
        const skippableIDs = getSkippableCollectionMemberIDs();
        if (skippableIDs.size) {
            const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(mapping.key);
            if (skippableIDs.has(collectionMemberID)) {
                // Clean up the provisional mapping to avoid retaining unused subscribers.
                cache.addNullishStorageKey(mapping.key);
                delete callbackToStateMapping[subscriptionID];
                return subscriptionID;
            }
        }
    } catch (e) {
        // Not a collection member key, proceed as usual.
    }

    // When keyChanged is called, a key is passed and the method looks through all the Subscribers in callbackToStateMapping for the matching key to get the subscriptionID
    // to avoid having to loop through all the Subscribers all the time (even when just one connection belongs to one key),
    // We create a mapping from key to lists of subscriptionIDs to access the specific list of subscriptionIDs.
    storeKeyBySubscriptions(mapping.key, callbackToStateMapping[subscriptionID].subscriptionID);

    if (mapping.initWithStoredValues === false) {
        return subscriptionID;
    }

    // Commit connection only after init passes
    deferredInitTask.promise
        // This first .then() adds a microtask tick for compatibility reasons and
        // to ensure subscribers don't receive an extra initial callback before Onyx.update() data arrives.
        .then(() => undefined)
        .then(() => {
            // Performance improvement
            // If the mapping is connected to an onyx key that is not a collection
            // we can skip the call to getAllKeys() and return an array with a single item
            if (!!mapping.key && typeof mapping.key === 'string' && !OnyxKeys.isCollectionKey(mapping.key) && cache.getAllKeys().has(mapping.key)) {
                return new Set([mapping.key]);
            }
            return getAllKeys();
        })
        .then((keys) => {
            // We search all the keys in storage to see if any are a "match" for the subscriber we are connecting so that we
            // can send data back to the subscriber. Note that multiple keys can match as a subscriber could either be
            // subscribed to a "collection key" or a single key.
            const matchingKeys: string[] = [];

            // Performance optimization: For single key subscriptions, avoid O(n) iteration
            if (!OnyxKeys.isCollectionKey(mapping.key)) {
                if (keys.has(mapping.key)) {
                    matchingKeys.push(mapping.key);
                }
            } else {
                // Collection case - need to iterate through all keys to find matches (O(n))
                for (const key of keys) {
                    if (!OnyxKeys.isKeyMatch(mapping.key, key)) {
                        continue;
                    }
                    matchingKeys.push(key);
                }
            }
            // If the key being connected to does not exist we initialize the value with null. For subscribers that connected
            // directly via connect() they will simply get a null value sent to them without any information about which key matched
            // since there are none matched.
            if (matchingKeys.length === 0) {
                if (mapping.key) {
                    cache.addNullishStorageKey(mapping.key);
                }

                const matchedKey = OnyxKeys.isCollectionKey(mapping.key) && mapping.waitForCollectionCallback ? mapping.key : undefined;

                // Here we cannot use batching because the nullish value is expected to be set immediately for default props
                // or they will be undefined.
                sendDataToConnection(mapping, matchedKey);
                return;
            }

            // When using a callback subscriber we will either trigger the provided callback for each key we find or combine all values
            // into an object and just make a single call. The latter behavior is enabled by providing a waitForCollectionCallback key
            // combined with a subscription to a collection key.
            if (typeof mapping.callback === 'function') {
                if (OnyxKeys.isCollectionKey(mapping.key)) {
                    if (mapping.waitForCollectionCallback) {
                        getCollectionDataAndSendAsObject(matchingKeys, mapping);
                        return;
                    }

                    // We did not opt into using waitForCollectionCallback mode so the callback is called for every matching key.
                    multiGet(matchingKeys).then(() => {
                        for (const key of matchingKeys) {
                            sendDataToConnection(mapping, key as TKey);
                        }
                    });
                    return;
                }

                // If we are not subscribed to a collection key then there's only a single key to send an update for.
                get(mapping.key).then(() => sendDataToConnection(mapping, mapping.key));
                return;
            }

            console.error('Warning: Onyx.connect() was found without a callback');
        });

    // The subscriptionID is returned back to the caller so that it can be used to clean up the connection when it's no longer needed
    // by calling OnyxUtils.unsubscribeFromKey(subscriptionID).
    return subscriptionID;
}

/**
 * Disconnects and removes the listener from the Onyx key.
 *
 * @param subscriptionID Subscription ID returned by calling `OnyxUtils.subscribeToKey()`.
 */
function unsubscribeFromKey(subscriptionID: number): void {
    if (!callbackToStateMapping[subscriptionID]) {
        return;
    }

    deleteKeyBySubscriptions(subscriptionID);
    delete callbackToStateMapping[subscriptionID];
}

function updateSnapshots<TKey extends OnyxKey>(data: Array<OnyxUpdate<TKey>>, mergeFn: typeof Onyx.merge): Array<() => Promise<void>> {
    const snapshotCollectionKey = getSnapshotKey();
    if (!snapshotCollectionKey) return [];

    const promises: Array<() => Promise<void>> = [];

    const snapshotCollection = getCachedCollection(snapshotCollectionKey);

    for (const [snapshotEntryKey, snapshotEntryValue] of Object.entries(snapshotCollection)) {
        // Snapshots may not be present in cache. We don't know how to update them so we skip.
        if (!snapshotEntryValue) {
            continue;
        }

        let updatedData: Record<string, unknown> = {};

        for (const {key, value} of data) {
            // snapshots are normal keys so we want to skip update if they are written to Onyx
            if (OnyxKeys.isCollectionMemberKey(snapshotCollectionKey, key)) {
                continue;
            }

            if (typeof snapshotEntryValue !== 'object' || !('data' in snapshotEntryValue)) {
                continue;
            }

            const snapshotData = snapshotEntryValue.data;
            if (!snapshotData || !snapshotData[key]) {
                continue;
            }

            if (Array.isArray(value) || Array.isArray(snapshotData[key])) {
                updatedData[key] = value || [];
                continue;
            }

            if (value === null) {
                updatedData[key] = value;
                continue;
            }

            const oldValue = updatedData[key] || {};

            // Snapshot entries are stored as a "shape" of the last known data per key, so by default we only
            // merge fields that already exist in the snapshot to avoid unintentionally bloating snapshot data.
            // Some clients need specific fields (like pending status) even when they are missing in the snapshot,
            // so we allow an explicit, opt-in list of keys to always include during snapshot merges.
            const snapshotExistingKeys = Object.keys(snapshotData[key] || {});
            const allowedNewKeys = getSnapshotMergeKeys();
            const keysToCopy = new Set([...snapshotExistingKeys, ...allowedNewKeys]);
            const newValue = typeof value === 'object' && value !== null ? utils.pick(value as Record<string, unknown>, [...keysToCopy]) : {};

            updatedData = {...updatedData, [key]: Object.assign(oldValue, newValue)};
        }

        // Skip the update if there's no data to be merged
        if (utils.isEmptyObject(updatedData)) {
            continue;
        }

        promises.push(() => mergeFn(snapshotEntryKey, {data: updatedData}));
    }

    return promises;
}

/**
 * Writes a value to our store with the given key.
 * Serves as core implementation for `Onyx.set()` public function, the difference being
 * that this internal function allows passing an additional `retryAttempt` parameter to retry on failure.
 *
 * @param params - set parameters
 * @param params.key ONYXKEY to set
 * @param params.value value to store
 * @param params.options optional configuration object
 * @param retryAttempt retry attempt
 */
function setWithRetry<TKey extends OnyxKey>({key, value, options}: SetParams<TKey>, retryAttempt?: number): Promise<void> {
    // When we use Onyx.set to set a key we want to clear the current delta changes from Onyx.merge that were queued
    // before the value was set. If Onyx.merge is currently reading the old value from storage, it will then not apply the changes.
    if (OnyxUtils.hasPendingMergeForKey(key)) {
        delete OnyxUtils.getMergeQueue()[key];
    }

    if (skippableCollectionMemberIDs.size) {
        try {
            const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key);
            if (skippableCollectionMemberIDs.has(collectionMemberID)) {
                // The key is a skippable one, so we set the new value to null.
                // eslint-disable-next-line no-param-reassign
                value = null;
            }
        } catch (e) {
            // The key is not a collection one or something went wrong during split, so we proceed with the function's logic.
        }
    }

    // Onyx.set will ignore `undefined` values as inputs, therefore we can return early.
    if (value === undefined) {
        return Promise.resolve();
    }

    const existingValue = cache.get(key);

    // If the existing value as well as the new value are null, we can return early.
    if (existingValue === undefined && value === null) {
        return Promise.resolve();
    }

    // Check if the value is compatible with the existing value in the storage
    const {isCompatible, existingValueType, newValueType, isEmptyArrayCoercion} = utils.checkCompatibilityWithExistingValue(value, existingValue);
    if (isEmptyArrayCoercion) {
        // Setting an object over empty array isn't semantically correct, but we allow it
        // in case we accidentally encoded an empty object as an empty array in PHP. If you're
        // looking at a bugbot from this message, we're probably missing that key in OnyxKeys::KEYS_REQUIRING_EMPTY_OBJECT
        Logger.logAlert(`[ENSURE_BUGBOT] Onyx setWithRetry called on key "${key}" whose existing value is an empty array. Will coerce to object.`);
    }
    if (!isCompatible) {
        Logger.logAlert(logMessages.incompatibleUpdateAlert(key, 'set', existingValueType, newValueType));
        return Promise.resolve();
    }

    // If the change is null, we can just delete the key.
    // Therefore, we don't need to further broadcast and update the value so we can return early.
    if (value === null) {
        OnyxUtils.remove(key);
        OnyxUtils.logKeyRemoved(OnyxUtils.METHOD.SET, key);
        return Promise.resolve();
    }

    const valueWithoutNestedNullValues = utils.removeNestedNullValues(value) as OnyxValue<TKey>;
    const hasChanged = options?.skipCacheCheck ? true : cache.hasValueChanged(key, valueWithoutNestedNullValues);

    OnyxUtils.logKeyChanged(OnyxUtils.METHOD.SET, key, value, hasChanged);

    // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
    OnyxUtils.broadcastUpdate(key, valueWithoutNestedNullValues, hasChanged);

    // If the value has not changed and this isn't a retry attempt, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
    if (!hasChanged && !retryAttempt) {
        return Promise.resolve();
    }

    // If a key is a RAM-only key or a member of RAM-only collection, we skip the step that modifies the storage
    if (OnyxKeys.isRamOnlyKey(key)) {
        OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.SET, key, valueWithoutNestedNullValues);
        return Promise.resolve();
    }

    return Storage.setItem(key, valueWithoutNestedNullValues)
        .catch((error) => OnyxUtils.retryOperation(error, setWithRetry, {key, value: valueWithoutNestedNullValues, options}, retryAttempt))
        .then(() => {
            OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.SET, key, valueWithoutNestedNullValues);
        });
}

/**
 * Sets multiple keys and values.
 * Serves as core implementation for `Onyx.multiSet()` public function, the difference being
 * that this internal function allows passing an additional `retryAttempt` parameter to retry on failure.
 *
 * @param data object keyed by ONYXKEYS and the values to set
 * @param retryAttempt retry attempt
 */
function multiSetWithRetry(data: OnyxMultiSetInput, retryAttempt?: number): Promise<void> {
    let newData = data;

    if (skippableCollectionMemberIDs.size) {
        newData = Object.keys(newData).reduce((result: OnyxMultiSetInput, key) => {
            try {
                const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key);
                // If the collection member key is a skippable one we set its value to null.
                // eslint-disable-next-line no-param-reassign
                result[key] = !skippableCollectionMemberIDs.has(collectionMemberID) ? newData[key] : null;
            } catch {
                // The key is not a collection one or something went wrong during split, so we assign the data to result anyway.
                // eslint-disable-next-line no-param-reassign
                result[key] = newData[key];
            }

            return result;
        }, {});
    }

    const keyValuePairsToSet = OnyxUtils.prepareKeyValuePairsForStorage(newData, true);

    for (const [key, value] of keyValuePairsToSet) {
        // When we use multiSet to set a key we want to clear the current delta changes from Onyx.merge that were queued
        // before the value was set. If Onyx.merge is currently reading the old value from storage, it will then not apply the changes.
        if (OnyxUtils.hasPendingMergeForKey(key)) {
            delete OnyxUtils.getMergeQueue()[key];
        }

        // Update cache and optimistically inform subscribers
        cache.set(key, value);
        keyChanged(key, value);
    }

    const keyValuePairsToStore = keyValuePairsToSet.filter((keyValuePair) => {
        const [key] = keyValuePair;
        // Filter out the RAM-only key value pairs, as they should not be saved to storage
        return !OnyxKeys.isRamOnlyKey(key);
    });

    return Storage.multiSet(keyValuePairsToStore)
        .catch((error) => OnyxUtils.retryOperation(error, multiSetWithRetry, newData, retryAttempt))
        .then(() => {
            OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.MULTI_SET, undefined, newData);
        });
}

/**
 * Sets a collection by replacing all existing collection members with new values.
 * Any existing collection members not included in the new data will be removed.
 * Serves as core implementation for `Onyx.setCollection()` public function, the difference being
 * that this internal function allows passing an additional `retryAttempt` parameter to retry on failure.
 *
 * @param params - collection parameters
 * @param params.collectionKey e.g. `ONYXKEYS.COLLECTION.REPORT`
 * @param params.collection Object collection keyed by individual collection member keys and values
 * @param retryAttempt retry attempt
 */
function setCollectionWithRetry<TKey extends CollectionKeyBase>({collectionKey, collection}: SetCollectionParams<TKey>, retryAttempt?: number): Promise<void> {
    let resultCollection: OnyxInputKeyValueMapping = collection;
    let resultCollectionKeys = Object.keys(resultCollection);

    // Confirm all the collection keys belong to the same parent
    if (!OnyxUtils.doAllCollectionItemsBelongToSameParent(collectionKey, resultCollectionKeys)) {
        Logger.logAlert(`setCollection called with keys that do not belong to the same parent ${collectionKey}. Skipping this update.`);
        return Promise.resolve();
    }

    if (skippableCollectionMemberIDs.size) {
        resultCollection = resultCollectionKeys.reduce((result: OnyxInputKeyValueMapping, key) => {
            try {
                const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key, collectionKey);
                // If the collection member key is a skippable one we set its value to null.
                // eslint-disable-next-line no-param-reassign
                result[key] = !skippableCollectionMemberIDs.has(collectionMemberID) ? resultCollection[key] : null;
            } catch {
                // Something went wrong during split, so we assign the data to result anyway.
                // eslint-disable-next-line no-param-reassign
                result[key] = resultCollection[key];
            }

            return result;
        }, {});
    }
    resultCollectionKeys = Object.keys(resultCollection);

    return OnyxUtils.getAllKeys().then((persistedKeys) => {
        const mutableCollection: OnyxInputKeyValueMapping = {...resultCollection};

        for (const key of persistedKeys) {
            if (!key.startsWith(collectionKey)) {
                continue;
            }
            if (resultCollectionKeys.includes(key)) {
                continue;
            }

            mutableCollection[key] = null;
        }

        const keyValuePairs = OnyxUtils.prepareKeyValuePairsForStorage(mutableCollection, true, undefined, true);
        const previousCollection = OnyxUtils.getCachedCollection(collectionKey);

        for (const [key, value] of keyValuePairs) cache.set(key, value);

        keysChanged(collectionKey, mutableCollection, previousCollection);

        // RAM-only keys are not supposed to be saved to storage
        if (OnyxKeys.isRamOnlyKey(collectionKey)) {
            OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.SET_COLLECTION, undefined, mutableCollection);
            return;
        }

        return Storage.multiSet(keyValuePairs)
            .catch((error) => OnyxUtils.retryOperation(error, setCollectionWithRetry, {collectionKey, collection}, retryAttempt))
            .then(() => {
                OnyxUtils.sendActionToDevTools(OnyxUtils.METHOD.SET_COLLECTION, undefined, mutableCollection);
            });
    });
}

/**
 * Merges a collection based on their keys.
 * Serves as core implementation for `Onyx.mergeCollection()` public function, the difference being
 * that this internal function allows passing an additional `mergeReplaceNullPatches` parameter and retries on failure.
 *
 * @param params - mergeCollection parameters
 * @param params.collectionKey e.g. `ONYXKEYS.COLLECTION.REPORT`
 * @param params.collection Object collection keyed by individual collection member keys and values
 * @param params.mergeReplaceNullPatches Record where the key is a collection member key and the value is a list of
 * tuples that we'll use to replace the nested objects of that collection member record with something else.
 * @param params.isProcessingCollectionUpdate whether this is part of a collection update operation.
 * @param retryAttempt retry attempt
 */
function mergeCollectionWithPatches<TKey extends CollectionKeyBase>(
    {collectionKey, collection, mergeReplaceNullPatches, isProcessingCollectionUpdate = false}: MergeCollectionWithPatchesParams<TKey>,
    retryAttempt?: number,
): Promise<void> {
    if (!isValidNonEmptyCollectionForMerge(collection)) {
        Logger.logInfo('mergeCollection() called with invalid or empty value. Skipping this update.');
        return Promise.resolve();
    }

    let resultCollection: OnyxInputKeyValueMapping = collection;
    let resultCollectionKeys = Object.keys(resultCollection);

    // Confirm all the collection keys belong to the same parent
    if (!doAllCollectionItemsBelongToSameParent(collectionKey, resultCollectionKeys)) {
        return Promise.resolve();
    }

    if (skippableCollectionMemberIDs.size) {
        resultCollection = resultCollectionKeys.reduce((result: OnyxInputKeyValueMapping, key) => {
            try {
                const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key, collectionKey);
                // If the collection member key is a skippable one we set its value to null.
                // eslint-disable-next-line no-param-reassign
                result[key] = !skippableCollectionMemberIDs.has(collectionMemberID) ? resultCollection[key] : null;
            } catch {
                // Something went wrong during split, so we assign the data to result anyway.
                // eslint-disable-next-line no-param-reassign
                result[key] = resultCollection[key];
            }

            return result;
        }, {});
    }
    resultCollectionKeys = Object.keys(resultCollection);

    return getAllKeys()
        .then((persistedKeys) => {
            // Split to keys that exist in storage and keys that don't
            const keys = resultCollectionKeys.filter((key) => {
                if (resultCollection[key] === null) {
                    remove(key, isProcessingCollectionUpdate);
                    return false;
                }
                return true;
            });

            const existingKeys = keys.filter((key) => persistedKeys.has(key));

            const cachedCollectionForExistingKeys = getCachedCollection(collectionKey, existingKeys);

            const existingKeyCollection = existingKeys.reduce((obj: OnyxInputKeyValueMapping, key) => {
                const {isCompatible, existingValueType, newValueType, isEmptyArrayCoercion} = utils.checkCompatibilityWithExistingValue(
                    resultCollection[key],
                    cachedCollectionForExistingKeys[key],
                );

                if (isEmptyArrayCoercion) {
                    // Merging an object into an empty array isn't semantically correct, but we allow it
                    // in case we accidentally encoded an empty object as an empty array in PHP. If you're
                    // looking at a bugbot from this message, we're probably missing that key in OnyxKeys::KEYS_REQUIRING_EMPTY_OBJECT
                    Logger.logAlert(`[ENSURE_BUGBOT] Onyx mergeCollection called on key "${key}" whose existing value is an empty array. Will coerce to object.`);
                }
                if (!isCompatible) {
                    Logger.logAlert(logMessages.incompatibleUpdateAlert(key, 'mergeCollection', existingValueType, newValueType));
                    return obj;
                }

                // eslint-disable-next-line no-param-reassign
                obj[key] = resultCollection[key];
                return obj;
            }, {}) as Record<OnyxKey, OnyxInput<TKey>>;

            const newCollection: Record<OnyxKey, OnyxInput<TKey>> = {};
            for (const key of keys) {
                if (persistedKeys.has(key)) {
                    continue;
                }
                newCollection[key] = resultCollection[key];
            }

            // When (multi-)merging the values with the existing values in storage,
            // we don't want to remove nested null values from the data that we pass to the storage layer,
            // because the storage layer uses them to remove nested keys from storage natively.
            const keyValuePairsForExistingCollection = prepareKeyValuePairsForStorage(existingKeyCollection, false, mergeReplaceNullPatches);

            // We can safely remove nested null values when using (multi-)set,
            // because we will simply overwrite the existing values in storage.
            const keyValuePairsForNewCollection = prepareKeyValuePairsForStorage(newCollection, true);

            const promises = [];

            // We need to get the previously existing values so we can compare the new ones
            // against them, to avoid unnecessary subscriber updates.
            const previousCollectionPromise = Promise.all(existingKeys.map((key) => get(key).then((value) => [key, value]))).then(Object.fromEntries);

            // New keys will be added via multiSet while existing keys will be updated using multiMerge
            // This is because setting a key that doesn't exist yet with multiMerge will throw errors
            // We can skip this step for RAM-only keys as they should never be saved to storage
            if (!OnyxKeys.isRamOnlyKey(collectionKey) && keyValuePairsForExistingCollection.length > 0) {
                promises.push(Storage.multiMerge(keyValuePairsForExistingCollection));
            }

            // We can skip this step for RAM-only keys as they should never be saved to storage
            if (!OnyxKeys.isRamOnlyKey(collectionKey) && keyValuePairsForNewCollection.length > 0) {
                promises.push(Storage.multiSet(keyValuePairsForNewCollection));
            }

            // finalMergedCollection contains all the keys that were merged, without the keys of incompatible updates
            const finalMergedCollection = {...existingKeyCollection, ...newCollection};

            // Prefill cache if necessary by calling get() on any existing keys and then merge original data to cache
            // and update all subscribers
            const promiseUpdate = previousCollectionPromise.then((previousCollection) => {
                cache.merge(finalMergedCollection);
                keysChanged(collectionKey, finalMergedCollection, previousCollection);
            });

            return Promise.all(promises)
                .catch((error) =>
                    retryOperation(
                        error,
                        mergeCollectionWithPatches,
                        {collectionKey, collection: resultCollection as OnyxMergeCollectionInput<TKey>, mergeReplaceNullPatches, isProcessingCollectionUpdate},
                        retryAttempt,
                    ),
                )
                .then(() => {
                    sendActionToDevTools(METHOD.MERGE_COLLECTION, undefined, resultCollection);
                    return promiseUpdate;
                });
        })
        .then(() => undefined);
}

/**
 * Sets keys in a collection by replacing all targeted collection members with new values.
 * Any existing collection members not included in the new data will not be removed.
 * Retries on failure.
 *
 * @param params - collection parameters
 * @param params.collectionKey e.g. `ONYXKEYS.COLLECTION.REPORT`
 * @param params.collection Object collection keyed by individual collection member keys and values
 * @param retryAttempt retry attempt
 */
function partialSetCollection<TKey extends CollectionKeyBase>({collectionKey, collection}: SetCollectionParams<TKey>, retryAttempt?: number): Promise<void> {
    let resultCollection: OnyxInputKeyValueMapping = collection;
    let resultCollectionKeys = Object.keys(resultCollection);

    // Confirm all the collection keys belong to the same parent
    if (!doAllCollectionItemsBelongToSameParent(collectionKey, resultCollectionKeys)) {
        Logger.logAlert(`setCollection called with keys that do not belong to the same parent ${collectionKey}. Skipping this update.`);
        return Promise.resolve();
    }

    if (skippableCollectionMemberIDs.size) {
        resultCollection = resultCollectionKeys.reduce((result: OnyxInputKeyValueMapping, key) => {
            try {
                const [, collectionMemberID] = OnyxKeys.splitCollectionMemberKey(key, collectionKey);
                // If the collection member key is a skippable one we set its value to null.
                // eslint-disable-next-line no-param-reassign
                result[key] = !skippableCollectionMemberIDs.has(collectionMemberID) ? resultCollection[key] : null;
            } catch {
                // Something went wrong during split, so we assign the data to result anyway.
                // eslint-disable-next-line no-param-reassign
                result[key] = resultCollection[key];
            }

            return result;
        }, {});
    }
    resultCollectionKeys = Object.keys(resultCollection);

    return getAllKeys().then((persistedKeys) => {
        const mutableCollection: OnyxInputKeyValueMapping = {...resultCollection};
        const existingKeys = resultCollectionKeys.filter((key) => persistedKeys.has(key));
        const previousCollection = getCachedCollection(collectionKey, existingKeys);
        const keyValuePairs = prepareKeyValuePairsForStorage(mutableCollection, true, undefined, true);

        for (const [key, value] of keyValuePairs) cache.set(key, value);

        keysChanged(collectionKey, mutableCollection, previousCollection);

        if (OnyxKeys.isRamOnlyKey(collectionKey)) {
            sendActionToDevTools(METHOD.SET_COLLECTION, undefined, mutableCollection);
            return;
        }

        return Storage.multiSet(keyValuePairs)
            .catch((error) => retryOperation(error, partialSetCollection, {collectionKey, collection}, retryAttempt))
            .then(() => {
                sendActionToDevTools(METHOD.SET_COLLECTION, undefined, mutableCollection);
            });
    });
}

function logKeyChanged(onyxMethod: Extract<OnyxMethod, 'set' | 'merge'>, key: OnyxKey, value: unknown, hasChanged: boolean) {
    Logger.logInfo(`${onyxMethod} called for key: ${key}${_.isObject(value) ? ` properties: ${_.keys(value).join(',')}` : ''} hasChanged: ${hasChanged}`);
}

function logKeyRemoved(onyxMethod: Extract<OnyxMethod, 'set' | 'merge'>, key: OnyxKey) {
    Logger.logInfo(`${onyxMethod} called for key: ${key} => null passed, so key was removed`);
}

/**
 * Getter - returns the callback to state mapping, useful in test environments.
 */
function getCallbackToStateMapping(): Record<number, CallbackToStateMapping<OnyxKey>> {
    return callbackToStateMapping;
}

/**
 * Clear internal variables used in this file, useful in test environments.
 */
function clearOnyxUtilsInternals() {
    mergeQueue = {};
    mergeQueuePromise = {};
    callbackToStateMapping = {};
    onyxKeyToSubscriptionIDs = new Map();
    lastConnectionCallbackData = new Map();
}

const OnyxUtils = {
    METHOD,
    getMergeQueue,
    getMergeQueuePromise,
    getDefaultKeyStates,
    getDeferredInitTask,
    afterInit,
    initStoreValues,
    sendActionToDevTools,
    get,
    getAllKeys,
    tryGetCachedValue,
    getCachedCollection,
    keysChanged,
    keyChanged,
    sendDataToConnection,
    getCollectionDataAndSendAsObject,
    remove,
    reportStorageQuota,
    retryOperation,
    broadcastUpdate,
    hasPendingMergeForKey,
    prepareKeyValuePairsForStorage,
    mergeChanges,
    mergeAndMarkChanges,
    initializeWithDefaultKeyStates,
    getSnapshotKey,
    multiGet,
    tupleGet,
    isValidNonEmptyCollectionForMerge,
    doAllCollectionItemsBelongToSameParent,
    subscribeToKey,
    unsubscribeFromKey,
    getSkippableCollectionMemberIDs,
    setSkippableCollectionMemberIDs,
    getSnapshotMergeKeys,
    setSnapshotMergeKeys,
    storeKeyBySubscriptions,
    deleteKeyBySubscriptions,
    reduceCollectionWithSelector,
    updateSnapshots,
    mergeCollectionWithPatches,
    partialSetCollection,
    logKeyChanged,
    logKeyRemoved,
    setWithRetry,
    multiSetWithRetry,
    setCollectionWithRetry,
    getCallbackToStateMapping,
};

export type {OnyxMethod};
export default OnyxUtils;
export {clearOnyxUtilsInternals};
