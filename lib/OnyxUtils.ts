/* eslint-disable no-continue */
import {deepEqual} from 'fast-equals';
import lodashClone from 'lodash/clone';
import type {ValueOf} from 'type-fest';
import lodashPick from 'lodash/pick';
import DevTools from './DevTools';
import * as Logger from './Logger';
import type Onyx from './Onyx';
import cache, {TASK} from './OnyxCache';
import * as PerformanceUtils from './PerformanceUtils';
import * as Str from './Str';
import unstable_batchedUpdates from './batch';
import Storage from './storage';
import type {
    CollectionKey,
    CollectionKeyBase,
    ConnectOptions,
    DeepRecord,
    DefaultConnectCallback,
    DefaultConnectOptions,
    KeyValueMapping,
    Mapping,
    OnyxCollection,
    OnyxEntry,
    OnyxInput,
    OnyxKey,
    OnyxMergeCollectionInput,
    OnyxUpdate,
    OnyxValue,
    Selector,
} from './types';
import utils from './utils';
import type {WithOnyxState} from './withOnyx/types';
import type {DeferredTask} from './createDeferredTask';
import createDeferredTask from './createDeferredTask';
import * as GlobalSettings from './GlobalSettings';
import decorateWithMetrics from './metrics';
import {getStorageManager} from './storage-eviction';

// Method constants
const METHOD = {
    SET: 'set',
    MERGE: 'merge',
    MERGE_COLLECTION: 'mergecollection',
    SET_COLLECTION: 'setcollection',
    MULTI_SET: 'multiset',
    CLEAR: 'clear',
} as const;

type OnyxMethod = ValueOf<typeof METHOD>;

// Key/value store of Onyx key and arrays of values to merge
const mergeQueue: Record<OnyxKey, Array<OnyxValue<OnyxKey>>> = {};
const mergeQueuePromise: Record<OnyxKey, Promise<void>> = {};

// Holds a mapping of all the React components that want their state subscribed to a store key
const callbackToStateMapping: Record<string, Mapping<OnyxKey>> = {};

// Keeps a copy of the values of the onyx collection keys as a map for faster lookups
let onyxCollectionKeySet = new Set<OnyxKey>();

// Holds a mapping of the connected key to the subscriptionID for faster lookups
const onyxKeyToSubscriptionIDs = new Map();

// Optional user-provided key value states set when Onyx initializes or clears
let defaultKeyStates: Record<OnyxKey, OnyxValue<OnyxKey>> = {};

let batchUpdatesPromise: Promise<void> | null = null;
let batchUpdatesQueue: Array<() => void> = [];

// Used for comparison with a new update to avoid invoking the Onyx.connect callback with the same data.
const lastConnectionCallbackData = new Map<number, OnyxValue<OnyxKey>>();

let snapshotKey: OnyxKey | null = null;

let fullyMergedSnapshotKeys: Set<string> | undefined;

// Keeps track of the last subscriptionID that was used so we can keep incrementing it
let lastSubscriptionID = 0;

// Connections can be made before `Onyx.init`. They would wait for this task before resolving
const deferredInitTask = createDeferredTask();

// Holds a set of collection member IDs which updates will be ignored when using Onyx methods.
let skippableCollectionMemberIDs = new Set<string>();

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
 * Getter - returns the skippable collection member IDs.
 */
function getSkippableCollectionMemberIDs(): Set<string> {
    return skippableCollectionMemberIDs;
}

/**
 * Setter - sets the skippable collection member IDs.
 */
function setSkippableCollectionMemberIDs(ids: Set<string>): void {
    skippableCollectionMemberIDs = ids;
}

/**
 * Sets the initial values for the Onyx store
 *
 * @param keys - `ONYXKEYS` constants object from Onyx.init()
 * @param initialKeyStates - initial data to set when `init()` and `clear()` are called
 * @param evictableKeys - This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal.
 * @param fullyMergedSnapshotKeys - Array of snapshot collection keys where full merge is supported and data structure can be changed after merge.
 */
function initStoreValues(keys: DeepRecord<string, OnyxKey>, initialKeyStates: Partial<KeyValueMapping>, evictableKeys: OnyxKey[], fullyMergedSnapshotKeysParam?: string[]): void {
    // We need the value of the collection keys later for checking if a
    // key is a collection. We store it in a map for faster lookup.
    const collectionValues = Object.values(keys.COLLECTION ?? {}) as string[];
    onyxCollectionKeySet = collectionValues.reduce((acc, val) => {
        acc.add(val);
        return acc;
    }, new Set<OnyxKey>());

    // Set our default key states to use when initializing and clearing Onyx data
    defaultKeyStates = initialKeyStates;

    DevTools.initState(initialKeyStates);

    // Let Onyx know about which keys are safe to evict
    cache.setEvictionAllowList(evictableKeys);

    if (typeof keys.COLLECTION === 'object' && typeof keys.COLLECTION.SNAPSHOT === 'string') {
        snapshotKey = keys.COLLECTION.SNAPSHOT;
        fullyMergedSnapshotKeys = new Set(fullyMergedSnapshotKeysParam ?? []);
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
 * We are batching together onyx updates. This helps with use cases where we schedule onyx updates after each other.
 * This happens for example in the Onyx.update function, where we process API responses that might contain a lot of
 * update operations. Instead of calling the subscribers for each update operation, we batch them together which will
 * cause react to schedule the updates at once instead of after each other. This is mainly a performance optimization.
 */
function maybeFlushBatchUpdates(): Promise<void> {
    if (batchUpdatesPromise) {
        return batchUpdatesPromise;
    }

    batchUpdatesPromise = new Promise((resolve) => {
        /* We use (setTimeout, 0) here which should be called once native module calls are flushed (usually at the end of the frame)
         * We may investigate if (setTimeout, 1) (which in React Native is equal to requestAnimationFrame) works even better
         * then the batch will be flushed on next frame.
         */
        setTimeout(() => {
            const updatesCopy = batchUpdatesQueue;
            batchUpdatesQueue = [];
            batchUpdatesPromise = null;
            unstable_batchedUpdates(() => {
                updatesCopy.forEach((applyUpdates) => {
                    applyUpdates();
                });
            });

            resolve();
        }, 0);
    });
    return batchUpdatesPromise;
}

function batchUpdates(updates: () => void): Promise<void> {
    batchUpdatesQueue.push(updates);
    return maybeFlushBatchUpdates();
}

/**
 * Takes a collection of items (eg. {testKey_1:{a:'a'}, testKey_2:{b:'b'}})
 * and runs it through a reducer function to return a subset of the data according to a selector.
 * The resulting collection will only contain items that are returned by the selector.
 */
function reduceCollectionWithSelector<TKey extends CollectionKeyBase, TMap, TReturn>(
    collection: OnyxCollection<KeyValueMapping[TKey]>,
    selector: Selector<TKey, TMap, TReturn>,
    withOnyxInstanceState: WithOnyxState<TMap> | undefined,
): Record<string, TReturn> {
    return Object.entries(collection ?? {}).reduce((finalCollection: Record<string, TReturn>, [key, item]) => {
        // eslint-disable-next-line no-param-reassign
        finalCollection[key] = selector(item, withOnyxInstanceState);

        return finalCollection;
    }, {});
}

/** Get some data from the store */
function get<TKey extends OnyxKey, TValue extends OnyxValue<TKey>>(key: TKey): Promise<TValue> {
    // When we already have the value in cache - resolve right away
    if (cache.hasCacheForKey(key)) {
        return Promise.resolve(cache.get(key) as TValue);
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
                    const [, collectionMemberID] = splitCollectionMemberKey(key);
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
    keys.forEach((key) => {
        const cacheValue = cache.get(key) as OnyxValue<TKey>;
        if (cacheValue) {
            dataMap.set(key, cacheValue);
            return;
        }

        const pendingKey = `${TASK.GET}:${key}` as const;
        if (cache.hasPendingTask(pendingKey)) {
            pendingTasks.push(cache.getTaskPromise(pendingKey) as Promise<OnyxValue<TKey>>);
            pendingKeys.push(key);
        } else {
            missingKeys.push(key);
        }
    });

    return (
        Promise.all(pendingTasks)
            // Wait for all the pending tasks to resolve and then add the data to the data map.
            .then((values) => {
                values.forEach((value, index) => {
                    dataMap.set(pendingKeys[index], value);
                });

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
                values.forEach(([key, value]) => {
                    if (skippableCollectionMemberIDs.size) {
                        try {
                            const [, collectionMemberID] = OnyxUtils.splitCollectionMemberKey(key);
                            if (skippableCollectionMemberIDs.has(collectionMemberID)) {
                                // The key is a skippable one, so we skip this iteration.
                                return;
                            }
                        } catch (e) {
                            // The key is not a collection one or something went wrong during split, so we proceed with the function's logic.
                        }
                    }

                    dataMap.set(key, value as OnyxValue<TKey>);
                    temp[key] = value as OnyxValue<TKey>;
                });
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
    return Promise.all(keys.map((key) => OnyxUtils.get(key))) as Promise<{[Index in keyof Keys]: OnyxValue<Keys[Index]>}>;
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
        cache.setAllKeys(keys);

        // return the updated set of keys
        return cache.getAllKeys();
    });

    return cache.captureTask(TASK.GET_ALL_KEYS, promise) as Promise<Set<OnyxKey>>;
}

/**
 * Returns set of all registered collection keys
 */
function getCollectionKeys(): Set<OnyxKey> {
    return onyxCollectionKeySet;
}

/**
 * Checks to see if the subscriber's supplied key
 * is associated with a collection of keys.
 */
function isCollectionKey(key: OnyxKey): key is CollectionKeyBase {
    return onyxCollectionKeySet.has(key);
}

function isCollectionMemberKey<TCollectionKey extends CollectionKeyBase>(collectionKey: TCollectionKey, key: string): key is `${TCollectionKey}${string}` {
    return key.startsWith(collectionKey) && key.length > collectionKey.length;
}

/**
 * Splits a collection member key into the collection key part and the ID part.
 * @param key - The collection member key to split.
 * @param collectionKey - The collection key of the `key` param that can be passed in advance to optimize the function.
 * @returns A tuple where the first element is the collection part and the second element is the ID part,
 * or throws an Error if the key is not a collection one.
 */
function splitCollectionMemberKey<TKey extends CollectionKey, CollectionKeyType = TKey extends `${infer Prefix}_${string}` ? `${Prefix}_` : never>(
    key: TKey,
    collectionKey?: string,
): [CollectionKeyType, string] {
    if (collectionKey && !isCollectionMemberKey(collectionKey, key)) {
        throw new Error(`Invalid '${collectionKey}' collection key provided, it isn't compatible with '${key}' key.`);
    }

    if (!collectionKey) {
        // eslint-disable-next-line no-param-reassign
        collectionKey = getCollectionKey(key);
    }

    return [collectionKey as CollectionKeyType, key.slice(collectionKey.length)];
}

/**
 * Checks to see if a provided key is the exact configured key of our connected subscriber
 * or if the provided key is a collection member key (in case our configured key is a "collection key")
 */
function isKeyMatch(configKey: OnyxKey, key: OnyxKey): boolean {
    return isCollectionKey(configKey) ? Str.startsWith(key, configKey) : configKey === key;
}

/**
 * Extracts the collection identifier of a given collection member key.
 *
 * For example:
 * - `getCollectionKey("report_123")` would return "report_"
 * - `getCollectionKey("report_")` would return "report_"
 * - `getCollectionKey("report_-1_something")` would return "report_"
 * - `getCollectionKey("sharedNVP_user_-1_something")` would return "sharedNVP_user_"
 *
 * @param key - The collection key to process.
 * @returns The plain collection key or throws an Error if the key is not a collection one.
 */
function getCollectionKey(key: CollectionKey): string {
    // Start by finding the position of the last underscore in the string
    let lastUnderscoreIndex = key.lastIndexOf('_');

    // Iterate backwards to find the longest key that ends with '_'
    while (lastUnderscoreIndex > 0) {
        const possibleKey = key.slice(0, lastUnderscoreIndex + 1);

        // Check if the substring is a key in the Set
        if (isCollectionKey(possibleKey)) {
            // Return the matching key and the rest of the string
            return possibleKey;
        }

        // Move to the next underscore to check smaller possible keys
        lastUnderscoreIndex = key.lastIndexOf('_', lastUnderscoreIndex - 1);
    }

    throw new Error(`Invalid '${key}' key provided, only collection keys are allowed.`);
}

/**
 * Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
 * If the requested key is a collection, it will return an object with all the collection members.
 */
function tryGetCachedValue<TKey extends OnyxKey>(key: TKey, mapping?: Partial<Mapping<TKey>>): OnyxValue<OnyxKey> {
    let val = cache.get(key);

    if (isCollectionKey(key)) {
        const allCacheKeys = cache.getAllKeys();

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

            values[cacheKey] = cache.get(cacheKey);
        });
        val = values;
    }

    if (mapping?.selector) {
        const state = mapping.withOnyxInstance ? mapping.withOnyxInstance.state : undefined;
        if (isCollectionKey(key)) {
            return reduceCollectionWithSelector(val as OnyxCollection<KeyValueMapping[TKey]>, mapping.selector, state);
        }
        return mapping.selector(val, state);
    }

    return val;
}

function getCachedCollection<TKey extends CollectionKeyBase>(collectionKey: TKey, collectionMemberKeys?: string[]): NonNullable<OnyxCollection<KeyValueMapping[TKey]>> {
    const allKeys = collectionMemberKeys || cache.getAllKeys();
    const collection: OnyxCollection<KeyValueMapping[TKey]> = {};

    // forEach exists on both Set and Array
    allKeys.forEach((key) => {
        // If we don't have collectionMemberKeys array then we have to check whether a key is a collection member key.
        // Because in that case the keys will be coming from `cache.getAllKeys()` and we need to filter out the keys that
        // are not part of the collection.
        if (!collectionMemberKeys && !isCollectionMemberKey(collectionKey, key)) {
            return;
        }

        const cachedValue = cache.get(key);

        if (cachedValue === undefined && !cache.hasNullishStorageKey(key)) {
            return;
        }

        collection[key] = cache.get(key);
    });

    return collection;
}

/**
 * When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks
 */
function keysChanged<TKey extends CollectionKeyBase>(
    collectionKey: TKey,
    partialCollection: OnyxCollection<KeyValueMapping[TKey]>,
    partialPreviousCollection: OnyxCollection<KeyValueMapping[TKey]> | undefined,
    notifyConnectSubscribers = true,
    notifyWithOnyxSubscribers = true,
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
        const isSubscribedToCollectionMemberKey = isCollectionMemberKey(collectionKey, subscriber.key);

        // Regular Onyx.connect() subscriber found.
        if (typeof subscriber.callback === 'function') {
            if (!notifyConnectSubscribers) {
                continue;
            }

            // If they are subscribed to the collection key and using waitForCollectionCallback then we'll
            // send the whole cached collection.
            if (isSubscribedToCollectionKey) {
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
                continue;
            }

            continue;
        }

        // React component subscriber found.
        if (utils.hasWithOnyxInstance(subscriber)) {
            if (!notifyWithOnyxSubscribers) {
                continue;
            }

            // We are subscribed to a collection key so we must update the data in state with the new
            // collection member key values from the partial update.
            if (isSubscribedToCollectionKey) {
                // If the subscriber has a selector, then the component's state must only be updated with the data
                // returned by the selector.
                const collectionSelector = subscriber.selector;
                if (collectionSelector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const previousData = prevState[subscriber.statePropertyName];
                        const newData = reduceCollectionWithSelector(cachedCollection, collectionSelector, subscriber.withOnyxInstance.state);

                        if (deepEqual(previousData, newData)) {
                            return null;
                        }

                        return {
                            [subscriber.statePropertyName]: newData,
                        };
                    });
                    continue;
                }

                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const prevCollection = prevState?.[subscriber.statePropertyName] ?? {};
                    const finalCollection = lodashClone(prevCollection);
                    const dataKeys = Object.keys(partialCollection ?? {});
                    for (const dataKey of dataKeys) {
                        finalCollection[dataKey] = cachedCollection[dataKey];
                    }

                    if (deepEqual(prevCollection, finalCollection)) {
                        return null;
                    }

                    PerformanceUtils.logSetStateCall(subscriber, prevState?.[subscriber.statePropertyName], finalCollection, 'keysChanged', collectionKey);
                    return {
                        [subscriber.statePropertyName]: finalCollection,
                    };
                });
                continue;
            }

            // If a React component is only interested in a single key then we can set the cached value directly to the state name.
            if (isSubscribedToCollectionMemberKey) {
                if (deepEqual(cachedCollection[subscriber.key], previousCollection[subscriber.key])) {
                    continue;
                }

                // However, we only want to update this subscriber if the partial data contains a change.
                // Otherwise, we would update them with a value they already have and trigger an unnecessary re-render.
                const dataFromCollection = partialCollection?.[subscriber.key];
                if (dataFromCollection === undefined) {
                    continue;
                }

                // If the subscriber has a selector, then the component's state must only be updated with the data
                // returned by the selector and the state should only change when the subset of data changes from what
                // it was previously.
                const selector = subscriber.selector;
                if (selector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const prevData = prevState[subscriber.statePropertyName];
                        const newData = selector(cachedCollection[subscriber.key], subscriber.withOnyxInstance.state);

                        if (deepEqual(prevData, newData)) {
                            return null;
                        }

                        PerformanceUtils.logSetStateCall(subscriber, prevData, newData, 'keysChanged', collectionKey);
                        return {
                            [subscriber.statePropertyName]: newData,
                        };
                    });
                    continue;
                }

                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const prevData = prevState[subscriber.statePropertyName];
                    const newData = cachedCollection[subscriber.key];

                    // Avoids triggering unnecessary re-renders when feeding empty objects
                    if (utils.isEmptyObject(newData) && utils.isEmptyObject(prevData)) {
                        return null;
                    }

                    if (deepEqual(prevData, newData)) {
                        return null;
                    }

                    PerformanceUtils.logSetStateCall(subscriber, prevData, newData, 'keysChanged', collectionKey);
                    return {
                        [subscriber.statePropertyName]: newData,
                    };
                });
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
    previousValue: OnyxValue<TKey>,
    canUpdateSubscriber: (subscriber?: Mapping<OnyxKey>) => boolean = () => true,
    notifyConnectSubscribers = true,
    notifyWithOnyxSubscribers = true,
): void {
    // Add or remove this key from the recentlyAccessedKeys lists
    if (value !== null) {
        cache.addLastAccessedKey(key, isCollectionKey(key));
    } else {
        cache.removeLastAccessedKey(key);
    }

    // We get the subscribers interested in the key that has just changed. If the subscriber's  key is a collection key then we will
    // notify them if the key that changed is a collection member. Or if it is a regular key notify them when there is an exact match. Depending on whether the subscriber
    // was connected via withOnyx we will call setState() directly on the withOnyx instance. If it is a regular connection we will pass the data to the provided callback.
    // Given the amount of times this function is called we need to make sure we are not iterating over all subscribers every time. On the other hand, we don't need to
    // do the same in keysChanged, because we only call that function when a collection key changes, and it doesn't happen that often.
    // For performance reason, we look for the given key and later if don't find it we look for the collection key, instead of checking if it is a collection key first.
    let stateMappingKeys = onyxKeyToSubscriptionIDs.get(key) ?? [];
    let collectionKey: string | undefined;
    try {
        collectionKey = getCollectionKey(key);
    } catch (e) {
        // If getCollectionKey() throws an error it means the key is not a collection key.
        collectionKey = undefined;
    }

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
        if (!subscriber || !isKeyMatch(subscriber.key, key) || !canUpdateSubscriber(subscriber)) {
            continue;
        }

        // Subscriber is a regular call to connect() and provided a callback
        if (typeof subscriber.callback === 'function') {
            if (!notifyConnectSubscribers) {
                continue;
            }
            if (lastConnectionCallbackData.has(subscriber.subscriptionID) && lastConnectionCallbackData.get(subscriber.subscriptionID) === value) {
                continue;
            }

            if (isCollectionKey(subscriber.key) && subscriber.waitForCollectionCallback) {
                let cachedCollection = cachedCollections[subscriber.key];

                if (!cachedCollection) {
                    cachedCollection = getCachedCollection(subscriber.key);
                    cachedCollections[subscriber.key] = cachedCollection;
                }

                cachedCollection[key] = value;
                subscriber.callback(cachedCollection, subscriber.key, {[key]: value});
                continue;
            }

            const subscriberCallback = subscriber.callback as DefaultConnectCallback<TKey>;
            subscriberCallback(value, key);

            lastConnectionCallbackData.set(subscriber.subscriptionID, value);
            continue;
        }

        // Subscriber connected via withOnyx() HOC
        if (utils.hasWithOnyxInstance(subscriber)) {
            if (!notifyWithOnyxSubscribers) {
                continue;
            }

            const selector = subscriber.selector;
            // Check if we are subscribing to a collection key and overwrite the collection member key value in state
            if (isCollectionKey(subscriber.key)) {
                // If the subscriber has a selector, then the consumer of this data must only be given the data
                // returned by the selector and only when the selected data has changed.
                if (selector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const prevWithOnyxData = prevState[subscriber.statePropertyName];
                        const newWithOnyxData = {
                            [key]: selector(value, subscriber.withOnyxInstance.state),
                        };
                        const prevDataWithNewData = {
                            ...prevWithOnyxData,
                            ...newWithOnyxData,
                        };

                        if (deepEqual(prevWithOnyxData, prevDataWithNewData)) {
                            return null;
                        }

                        PerformanceUtils.logSetStateCall(subscriber, prevWithOnyxData, newWithOnyxData, 'keyChanged', key);
                        return {
                            [subscriber.statePropertyName]: prevDataWithNewData,
                        };
                    });
                    continue;
                }

                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const prevCollection = prevState[subscriber.statePropertyName] || {};
                    const newCollection = {
                        ...prevCollection,
                        [key]: value,
                    };

                    if (deepEqual(prevCollection, newCollection)) {
                        return null;
                    }

                    PerformanceUtils.logSetStateCall(subscriber, prevCollection, newCollection, 'keyChanged', key);
                    return {
                        [subscriber.statePropertyName]: newCollection,
                    };
                });
                continue;
            }

            // If the subscriber has a selector, then the component's state must only be updated with the data
            // returned by the selector and only if the selected data has changed.
            if (selector) {
                subscriber.withOnyxInstance.setStateProxy(() => {
                    const prevValue = selector(previousValue, subscriber.withOnyxInstance.state);
                    const newValue = selector(value, subscriber.withOnyxInstance.state);

                    if (deepEqual(prevValue, newValue)) {
                        return null;
                    }

                    return {
                        [subscriber.statePropertyName]: newValue,
                    };
                });
                continue;
            }

            // If we did not match on a collection key then we just set the new data to the state property
            subscriber.withOnyxInstance.setStateProxy((prevState) => {
                const prevWithOnyxValue = prevState[subscriber.statePropertyName];

                // Avoids triggering unnecessary re-renders when feeding empty objects
                if (utils.isEmptyObject(value) && utils.isEmptyObject(prevWithOnyxValue)) {
                    return null;
                }
                if (prevWithOnyxValue === value) {
                    return null;
                }

                PerformanceUtils.logSetStateCall(subscriber, previousValue, value, 'keyChanged', key);
                return {
                    [subscriber.statePropertyName]: value,
                };
            });
            continue;
        }

        console.error('Warning: Found a matching subscriber to a key that changed, but no callback or withOnyxInstance could be found.');
    }
}

/**
 * Sends the data obtained from the keys to the connection. It either:
 *     - sets state on the withOnyxInstances
 *     - triggers the callback function
 */
function sendDataToConnection<TKey extends OnyxKey>(mapping: Mapping<TKey>, value: OnyxValue<TKey> | null, matchedKey: TKey | undefined, isBatched: boolean): void {
    // If the mapping no longer exists then we should not send any data.
    // This means our subscriber disconnected or withOnyx wrapped component unmounted.
    if (!callbackToStateMapping[mapping.subscriptionID]) {
        return;
    }

    if (utils.hasWithOnyxInstance(mapping)) {
        let newData: OnyxValue<OnyxKey> = value;

        // If the mapping has a selector, then the component's state must only be updated with the data
        // returned by the selector.
        if (mapping.selector) {
            if (isCollectionKey(mapping.key)) {
                newData = reduceCollectionWithSelector(value as OnyxCollection<KeyValueMapping[TKey]>, mapping.selector, mapping.withOnyxInstance.state);
            } else {
                newData = mapping.selector(value, mapping.withOnyxInstance.state);
            }
        }

        PerformanceUtils.logSetStateCall(mapping, null, newData, 'sendDataToConnection');
        if (isBatched) {
            batchUpdates(() => mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData));
        } else {
            mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData);
        }
        return;
    }

    // When there are no matching keys in "Onyx.connect", we pass null to "sendDataToConnection" explicitly,
    // to allow the withOnyx instance to set the value in the state initially and therefore stop the loading state once all
    // required keys have been set.
    // If we would pass undefined to setWithOnyxInstance instead, withOnyx would not set the value in the state.
    // withOnyx will internally replace null values with undefined and never pass null values to wrapped components.
    // For regular callbacks, we never want to pass null values, but always just undefined if a value is not set in cache or storage.
    const valueToPass = value === null ? undefined : value;
    const lastValue = lastConnectionCallbackData.get(mapping.subscriptionID);
    lastConnectionCallbackData.get(mapping.subscriptionID);

    // If the value has not changed we do not need to trigger the callback
    if (lastConnectionCallbackData.has(mapping.subscriptionID) && valueToPass === lastValue) {
        return;
    }

    (mapping as DefaultConnectOptions<TKey>).callback?.(valueToPass, matchedKey as TKey);
}

/**
 * We check to see if this key is flagged as safe for eviction and add it to the recentlyAccessedKeys list so that when we
 * run out of storage the least recently accessed key can be removed.
 */
function addKeyToRecentlyAccessedIfNeeded<TKey extends OnyxKey>(mapping: Mapping<TKey>): void {
    if (!cache.isEvictableKey(mapping.key)) {
        return;
    }

    // Add the key to recentKeys first (this makes it the most recent key)
    cache.addToAccessedKeys(mapping.key);

    // Try to free some cache whenever we connect to a safe eviction key
    cache.removeLeastRecentlyUsedKeys();

    if (utils.hasWithOnyxInstance(mapping) && !isCollectionKey(mapping.key)) {
        // All React components subscribing to a key flagged as a safe eviction key must implement the canEvict property.
        if (mapping.canEvict === undefined) {
            throw new Error(`Cannot subscribe to safe eviction key '${mapping.key}' without providing a canEvict value.`);
        }

        cache.addLastAccessedKey(mapping.key, isCollectionKey(mapping.key));
    }
}

/**
 * Gets the data for a given an array of matching keys, combines them into an object, and sends the result back to the subscriber.
 */
function getCollectionDataAndSendAsObject<TKey extends OnyxKey>(matchingKeys: CollectionKeyBase[], mapping: Mapping<TKey>): void {
    multiGet(matchingKeys).then((dataMap) => {
        const data = Object.fromEntries(dataMap.entries()) as OnyxValue<TKey>;
        sendDataToConnection(mapping, data, undefined, true);
    });
}

/**
 * Schedules an update that will be appended to the macro task queue (so it doesn't update the subscribers immediately).
 *
 * @example
 * scheduleSubscriberUpdate(key, value, subscriber => subscriber.initWithStoredValues === false)
 */
function scheduleSubscriberUpdate<TKey extends OnyxKey>(
    key: TKey,
    value: OnyxValue<TKey>,
    previousValue: OnyxValue<TKey>,
    canUpdateSubscriber: (subscriber?: Mapping<OnyxKey>) => boolean = () => true,
): Promise<void> {
    const promise = Promise.resolve().then(() => keyChanged(key, value, previousValue, canUpdateSubscriber, true, false));
    batchUpdates(() => keyChanged(key, value, previousValue, canUpdateSubscriber, false, true));
    return Promise.all([maybeFlushBatchUpdates(), promise]).then(() => undefined);
}

/**
 * This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
 * so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
 * subscriber callbacks receive the data in a different format than they normally expect and it breaks code.
 */
function scheduleNotifyCollectionSubscribers<TKey extends OnyxKey>(
    key: TKey,
    value: OnyxCollection<KeyValueMapping[TKey]>,
    previousValue?: OnyxCollection<KeyValueMapping[TKey]>,
): Promise<void> {
    const promise = Promise.resolve().then(() => keysChanged(key, value, previousValue, true, false));
    batchUpdates(() => keysChanged(key, value, previousValue, false, true));
    return Promise.all([maybeFlushBatchUpdates(), promise]).then(() => undefined);
}

/**
 * Remove a key from Onyx and update the subscribers
 */
function remove<TKey extends OnyxKey>(key: TKey): Promise<void> {
    const prevValue = cache.get(key, false) as OnyxValue<TKey>;
    cache.drop(key);
    scheduleSubscriberUpdate(key, undefined as OnyxValue<TKey>, prevValue);
    return Storage.removeItem(key).then(() => {
        const storageManager = getStorageManager();
        if (storageManager) {
            storageManager.trackKeyRemoval(key);
        }
        return undefined;
    });
}

function reportStorageQuota(): Promise<void> {
    return Storage.getDatabaseSize()
        .then(({bytesUsed, bytesRemaining}) => {
            Logger.logInfo(`Storage Quota Check -- bytesUsed: ${bytesUsed} bytesRemaining: ${bytesRemaining}`);
        })
        .catch((dbSizeError) => {
            Logger.logAlert(`Unable to get database size. Error: ${dbSizeError}`);
        });
}

/**
 * If we fail to set or merge we must handle this by
 * evicting some data from Onyx and then retrying to do
 * whatever it is we attempted to do.
 */
function evictStorageAndRetry<TMethod extends typeof Onyx.set | typeof Onyx.multiSet | typeof Onyx.mergeCollection | typeof Onyx.setCollection>(
    error: Error,
    onyxMethod: TMethod,
    ...args: Parameters<TMethod>
): Promise<void> {
    Logger.logInfo(`Failed to save to storage. Error: ${error}. onyxMethod: ${onyxMethod.name}`);

    if (error && Str.startsWith(error.message, "Failed to execute 'put' on 'IDBObjectStore'")) {
        Logger.logAlert('Attempted to set invalid data set in Onyx. Please ensure all data is serializable.');
        throw error;
    }

    // Find the first key that we can remove that has no subscribers in our blocklist
    const keyForRemoval = cache.getKeyForEviction();
    if (!keyForRemoval) {
        // If we have no acceptable keys to remove then we are possibly trying to save mission critical data. If this is the case,
        // then we should stop retrying as there is not much the user can do to fix this. Instead of getting them stuck in an infinite loop we
        // will allow this write to be skipped.
        Logger.logAlert('Out of storage. But found no acceptable keys to remove.');
        return reportStorageQuota();
    }

    // Remove the least recently viewed key that is not currently being accessed and retry.
    Logger.logInfo(`Out of storage. Evicting least recently accessed key (${keyForRemoval}) and retrying.`);
    reportStorageQuota();

    // @ts-expect-error No overload matches this call.
    return remove(keyForRemoval).then(() => onyxMethod(...args));
}

/**
 * Notifies subscribers and writes current value to cache
 */
function broadcastUpdate<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>, hasChanged?: boolean): Promise<void> {
    const prevValue = cache.get(key, false) as OnyxValue<TKey>;

    // Update subscribers if the cached value has changed, or when the subscriber specifically requires
    // all updates regardless of value changes (indicated by initWithStoredValues set to false).
    if (hasChanged) {
        cache.set(key, value);
    } else {
        cache.addToAccessedKeys(key);
    }

    return scheduleSubscriberUpdate(key, value, prevValue, (subscriber) => hasChanged || subscriber?.initWithStoredValues === false).then(() => undefined);
}

function hasPendingMergeForKey(key: OnyxKey): boolean {
    return !!mergeQueue[key];
}

type RemoveNullValuesOutput<Value extends OnyxInput<OnyxKey> | undefined> = {
    value: Value;
    wasRemoved: boolean;
};

/**
 * Removes a key from storage if the value is null.
 * Otherwise removes all nested null values in objects,
 * if shouldRemoveNestedNulls is true and returns the object.
 *
 * @returns The value without null values and a boolean "wasRemoved", which indicates if the key got removed completely
 */
function removeNullValues<Value extends OnyxInput<OnyxKey> | undefined>(key: OnyxKey, value: Value, shouldRemoveNestedNulls = true): RemoveNullValuesOutput<Value> {
    if (value === null) {
        remove(key);
        return {value, wasRemoved: true};
    }

    if (value === undefined) {
        return {value, wasRemoved: false};
    }

    // We can remove all null values in an object by merging it with itself
    // utils.fastMerge recursively goes through the object and removes all null values
    // Passing two identical objects as source and target to fastMerge will not change it, but only remove the null values
    return {value: shouldRemoveNestedNulls ? utils.removeNestedNullValues(value) : value, wasRemoved: false};
}

/**
 * Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
 * This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
 * to an array of key-value pairs in the above format and removes key-value pairs that are being set to null

* @return an array of key - value pairs <[key, value]>
 */
function prepareKeyValuePairsForStorage(data: Record<OnyxKey, OnyxInput<OnyxKey>>, shouldRemoveNestedNulls: boolean): Array<[OnyxKey, OnyxInput<OnyxKey>]> {
    return Object.entries(data).reduce<Array<[OnyxKey, OnyxInput<OnyxKey>]>>((pairs, [key, value]) => {
        const {value: valueAfterRemoving, wasRemoved} = removeNullValues(key, value, shouldRemoveNestedNulls);

        if (!wasRemoved && valueAfterRemoving !== undefined) {
            pairs.push([key, valueAfterRemoving]);
        }

        return pairs;
    }, []);
}

/**
 * Merges an array of changes with an existing value
 *
 * @param changes Array of changes that should be applied to the existing value
 */
function applyMerge<TValue extends OnyxInput<OnyxKey> | undefined, TChange extends OnyxInput<OnyxKey> | undefined>(
    existingValue: TValue,
    changes: TChange[],
    shouldRemoveNestedNulls: boolean,
): TChange {
    const lastChange = changes?.at(-1);

    if (Array.isArray(lastChange)) {
        return lastChange;
    }

    if (changes.some((change) => change && typeof change === 'object')) {
        // Object values are then merged one after the other
        return changes.reduce((modifiedData, change) => utils.fastMerge(modifiedData, change, shouldRemoveNestedNulls), (existingValue || {}) as TChange);
    }

    // If we have anything else we can't merge it so we'll
    // simply return the last value that was queued
    return lastChange as TChange;
}

/**
 * Merge user provided default key value pairs.
 */
function initializeWithDefaultKeyStates(): Promise<void> {
    return Storage.multiGet(Object.keys(defaultKeyStates)).then((pairs) => {
        const existingDataAsObject = Object.fromEntries(pairs);

        const merged = utils.fastMerge(existingDataAsObject, defaultKeyStates);
        cache.merge(merged ?? {});

        Object.entries(merged ?? {}).forEach(([key, value]) => keyChanged(key, value, existingDataAsObject));
    });
}

/**
 * Validate the collection is not empty and has a correct type before applying mergeCollection()
 */
function isValidNonEmptyCollectionForMerge<TKey extends CollectionKeyBase, TMap>(collection: OnyxMergeCollectionInput<TKey, TMap>): boolean {
    return typeof collection === 'object' && !Array.isArray(collection) && !utils.isEmptyObject(collection);
}

/**
 * Verify if all the collection keys belong to the same parent
 */
function doAllCollectionItemsBelongToSameParent<TKey extends CollectionKeyBase>(collectionKey: TKey, collectionKeys: string[]): boolean {
    let hasCollectionKeyCheckFailed = false;
    collectionKeys.forEach((dataKey) => {
        if (isKeyMatch(collectionKey, dataKey)) {
            return;
        }

        if (process.env.NODE_ENV === 'development') {
            throw new Error(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
        }

        hasCollectionKeyCheckFailed = true;
        Logger.logAlert(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
    });

    return !hasCollectionKeyCheckFailed;
}

/**
 * Subscribes to an Onyx key and listens to its changes.
 *
 * @param connectOptions The options object that will define the behavior of the connection.
 * @returns The subscription ID to use when calling `OnyxUtils.unsubscribeFromKey()`.
 */
function subscribeToKey<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): number {
    const mapping = connectOptions as Mapping<TKey>;
    const subscriptionID = lastSubscriptionID++;
    callbackToStateMapping[subscriptionID] = mapping as Mapping<OnyxKey>;
    callbackToStateMapping[subscriptionID].subscriptionID = subscriptionID;

    // When keyChanged is called, a key is passed and the method looks through all the Subscribers in callbackToStateMapping for the matching key to get the subscriptionID
    // to avoid having to loop through all the Subscribers all the time (even when just one connection belongs to one key),
    // We create a mapping from key to lists of subscriptionIDs to access the specific list of subscriptionIDs.
    storeKeyBySubscriptions(mapping.key, callbackToStateMapping[subscriptionID].subscriptionID);

    if (mapping.initWithStoredValues === false) {
        return subscriptionID;
    }

    // Commit connection only after init passes
    deferredInitTask.promise
        .then(() => addKeyToRecentlyAccessedIfNeeded(mapping))
        .then(() => {
            // Performance improvement
            // If the mapping is connected to an onyx key that is not a collection
            // we can skip the call to getAllKeys() and return an array with a single item
            if (!!mapping.key && typeof mapping.key === 'string' && !isCollectionKey(mapping.key) && cache.getAllKeys().has(mapping.key)) {
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
            if (!isCollectionKey(mapping.key)) {
                if (keys.has(mapping.key)) {
                    matchingKeys.push(mapping.key);
                }
            } else {
                // Collection case - need to iterate through all keys to find matches (O(n))
                keys.forEach((key) => {
                    if (!isKeyMatch(mapping.key, key)) {
                        return;
                    }
                    matchingKeys.push(key);
                });
            }
            // If the key being connected to does not exist we initialize the value with null. For subscribers that connected
            // directly via connect() they will simply get a null value sent to them without any information about which key matched
            // since there are none matched. In withOnyx() we wait for all connected keys to return a value before rendering the child
            // component. This null value will be filtered out so that the connected component can utilize defaultProps.
            if (matchingKeys.length === 0) {
                if (mapping.key && !isCollectionKey(mapping.key)) {
                    cache.addNullishStorageKey(mapping.key);
                }

                // Here we cannot use batching because the nullish value is expected to be set immediately for default props
                // or they will be undefined.
                sendDataToConnection(mapping, null, undefined, false);
                return;
            }

            // When using a callback subscriber we will either trigger the provided callback for each key we find or combine all values
            // into an object and just make a single call. The latter behavior is enabled by providing a waitForCollectionCallback key
            // combined with a subscription to a collection key.
            if (typeof mapping.callback === 'function') {
                if (isCollectionKey(mapping.key)) {
                    if (mapping.waitForCollectionCallback) {
                        getCollectionDataAndSendAsObject(matchingKeys, mapping);
                        return;
                    }

                    // We did not opt into using waitForCollectionCallback mode so the callback is called for every matching key.
                    multiGet(matchingKeys).then((values) => {
                        values.forEach((val, key) => {
                            sendDataToConnection(mapping, val as OnyxValue<TKey>, key as TKey, true);
                        });
                    });
                    return;
                }

                // If we are not subscribed to a collection key then there's only a single key to send an update for.
                get(mapping.key).then((val) => sendDataToConnection(mapping, val as OnyxValue<TKey>, mapping.key, true));
                return;
            }

            // If we have a withOnyxInstance that means a React component has subscribed via the withOnyx() HOC and we need to
            // group collection key member data into an object.
            if (utils.hasWithOnyxInstance(mapping)) {
                if (isCollectionKey(mapping.key)) {
                    getCollectionDataAndSendAsObject(matchingKeys, mapping);
                    return;
                }

                // If the subscriber is not using a collection key then we just send a single value back to the subscriber
                get(mapping.key).then((val) => sendDataToConnection(mapping, val as OnyxValue<TKey>, mapping.key, true));
                return;
            }

            console.error('Warning: Onyx.connect() was found without a callback or withOnyxInstance');
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

    deleteKeyBySubscriptions(lastSubscriptionID);
    delete callbackToStateMapping[subscriptionID];
}

function updateSnapshots(data: OnyxUpdate[], mergeFn: typeof Onyx.merge): Array<() => Promise<void>> {
    const snapshotCollectionKey = OnyxUtils.getSnapshotKey();
    if (!snapshotCollectionKey) return [];

    const promises: Array<() => Promise<void>> = [];

    const snapshotCollection = OnyxUtils.getCachedCollection(snapshotCollectionKey);

    Object.entries(snapshotCollection).forEach(([snapshotEntryKey, snapshotEntryValue]) => {
        // Snapshots may not be present in cache. We don't know how to update them so we skip.
        if (!snapshotEntryValue) {
            return;
        }

        let updatedData: Record<string, unknown> = {};

        data.forEach(({key, value}) => {
            // snapshots are normal keys so we want to skip update if they are written to Onyx
            if (OnyxUtils.isCollectionMemberKey(snapshotCollectionKey, key)) {
                return;
            }

            if (typeof snapshotEntryValue !== 'object' || !('data' in snapshotEntryValue)) {
                return;
            }

            const snapshotData = snapshotEntryValue.data;
            if (!snapshotData || !snapshotData[key]) {
                return;
            }

            if (Array.isArray(value) || Array.isArray(snapshotData[key])) {
                updatedData[key] = value || [];
                return;
            }

            if (value === null) {
                updatedData[key] = value;
                return;
            }

            const oldValue = updatedData[key] || {};
            let collectionKey: string | undefined;
            try {
                collectionKey = getCollectionKey(key);
            } catch (e) {
                // If getCollectionKey() throws an error it means the key is not a collection key.
                collectionKey = undefined;
            }
            const shouldFullyMerge = fullyMergedSnapshotKeys?.has(collectionKey || key);
            const newValue = shouldFullyMerge ? value : lodashPick(value, Object.keys(snapshotData[key]));

            updatedData = {...updatedData, [key]: Object.assign(oldValue, newValue)};
        });

        // Skip the update if there's no data to be merged
        if (utils.isEmptyObject(updatedData)) {
            return;
        }

        promises.push(() => mergeFn(snapshotEntryKey, {data: updatedData}));
    });

    return promises;
}

const OnyxUtils = {
    METHOD,
    getMergeQueue,
    getMergeQueuePromise,
    getDefaultKeyStates,
    getDeferredInitTask,
    initStoreValues,
    sendActionToDevTools,
    maybeFlushBatchUpdates,
    batchUpdates,
    get,
    getAllKeys,
    getCollectionKeys,
    isCollectionKey,
    isCollectionMemberKey,
    splitCollectionMemberKey,
    isKeyMatch,
    tryGetCachedValue,
    getCachedCollection,
    keysChanged,
    keyChanged,
    sendDataToConnection,
    getCollectionKey,
    getCollectionDataAndSendAsObject,
    scheduleSubscriberUpdate,
    scheduleNotifyCollectionSubscribers,
    remove,
    reportStorageQuota,
    evictStorageAndRetry,
    broadcastUpdate,
    hasPendingMergeForKey,
    removeNullValues,
    prepareKeyValuePairsForStorage,
    applyMerge,
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
    storeKeyBySubscriptions,
    deleteKeyBySubscriptions,
    addKeyToRecentlyAccessedIfNeeded,
    reduceCollectionWithSelector,
    updateSnapshots,
};

GlobalSettings.addGlobalSettingsChangeListener(({enablePerformanceMetrics}) => {
    if (!enablePerformanceMetrics) {
        return;
    }
    // We are reassigning the functions directly so that internal function calls are also decorated

    // @ts-expect-error Reassign
    initStoreValues = decorateWithMetrics(initStoreValues, 'OnyxUtils.initStoreValues');
    // @ts-expect-error Reassign
    maybeFlushBatchUpdates = decorateWithMetrics(maybeFlushBatchUpdates, 'OnyxUtils.maybeFlushBatchUpdates');
    // @ts-expect-error Reassign
    batchUpdates = decorateWithMetrics(batchUpdates, 'OnyxUtils.batchUpdates');
    // @ts-expect-error Complex type signature
    get = decorateWithMetrics(get, 'OnyxUtils.get');
    // @ts-expect-error Reassign
    getAllKeys = decorateWithMetrics(getAllKeys, 'OnyxUtils.getAllKeys');
    // @ts-expect-error Reassign
    getCollectionKeys = decorateWithMetrics(getCollectionKeys, 'OnyxUtils.getCollectionKeys');
    // @ts-expect-error Reassign
    addEvictableKeysToRecentlyAccessedList = decorateWithMetrics(cache.addEvictableKeysToRecentlyAccessedList, 'OnyxCache.addEvictableKeysToRecentlyAccessedList');
    // @ts-expect-error Reassign
    keysChanged = decorateWithMetrics(keysChanged, 'OnyxUtils.keysChanged');
    // @ts-expect-error Reassign
    keyChanged = decorateWithMetrics(keyChanged, 'OnyxUtils.keyChanged');
    // @ts-expect-error Reassign
    sendDataToConnection = decorateWithMetrics(sendDataToConnection, 'OnyxUtils.sendDataToConnection');
    // @ts-expect-error Reassign
    scheduleSubscriberUpdate = decorateWithMetrics(scheduleSubscriberUpdate, 'OnyxUtils.scheduleSubscriberUpdate');
    // @ts-expect-error Reassign
    scheduleNotifyCollectionSubscribers = decorateWithMetrics(scheduleNotifyCollectionSubscribers, 'OnyxUtils.scheduleNotifyCollectionSubscribers');
    // @ts-expect-error Reassign
    remove = decorateWithMetrics(remove, 'OnyxUtils.remove');
    // @ts-expect-error Reassign
    reportStorageQuota = decorateWithMetrics(reportStorageQuota, 'OnyxUtils.reportStorageQuota');
    // @ts-expect-error Complex type signature
    evictStorageAndRetry = decorateWithMetrics(evictStorageAndRetry, 'OnyxUtils.evictStorageAndRetry');
    // @ts-expect-error Reassign
    broadcastUpdate = decorateWithMetrics(broadcastUpdate, 'OnyxUtils.broadcastUpdate');
    // @ts-expect-error Reassign
    initializeWithDefaultKeyStates = decorateWithMetrics(initializeWithDefaultKeyStates, 'OnyxUtils.initializeWithDefaultKeyStates');
    // @ts-expect-error Complex type signature
    multiGet = decorateWithMetrics(multiGet, 'OnyxUtils.multiGet');
    // @ts-expect-error Reassign
    tupleGet = decorateWithMetrics(tupleGet, 'OnyxUtils.tupleGet');
    // @ts-expect-error Reassign
    subscribeToKey = decorateWithMetrics(subscribeToKey, 'OnyxUtils.subscribeToKey');
});

export type {OnyxMethod};
export default OnyxUtils;
