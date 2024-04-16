import {Component} from 'react';
import * as Logger from './Logger';
import {AnyComputedKey, ComputedKey, CollectionKey, CollectionKeyBase, DeepRecord, KeyValueMapping, NullishDeep, OnyxCollection, OnyxEntry, OnyxKey, Selector} from './types';

declare const METHOD: {
    readonly SET: 'set';
    readonly MERGE: 'merge';
    readonly MERGE_COLLECTION: 'mergecollection';
    readonly MULTI_SET: 'multiset';
    readonly CLEAR: 'clear';
};

type OnyxMethod = ValueOf<typeof METHOD>;

// Key/value store of Onyx key and arrays of values to merge
declare const mergeQueue: Record<OnyxKey, OnyxValue<OnyxKey>[]>;
declare const mergeQueuePromise: Record<OnyxKey, Promise<void | void[]>>;

// Holds a mapping of all the react components that want their state subscribed to a store key
declare const callbackToStateMapping: Record<string, Mapping<OnyxKey>>;

// Keeps a copy of the values of the onyx collection keys as a map for faster lookups
declare let onyxCollectionKeyMap: Map<OnyxKey, OnyxValue<OnyxKey>>;

// Holds a list of keys that have been directly subscribed to or recently modified from least to most recent
declare let recentlyAccessedKeys: OnyxKey[];

// Holds a list of keys that are safe to remove when we reach max storage. If a key does not match with
// whatever appears in this list it will NEVER be a candidate for eviction.
declare let evictionAllowList: OnyxKey[];

// Holds a map of keys and connectionID arrays whose keys will never be automatically evicted as
// long as we have at least one subscriber that returns false for the canEvict property.
declare const evictionBlocklist: Record<OnyxKey, number[]>;

// Optional user-provided key value states set when Onyx initializes or clears
declare let defaultKeyStates: Record<OnyxKey, OnyxValue<OnyxKey>>;

declare let batchUpdatesPromise: Promise<void> | null;
declare let batchUpdatesQueue: Array<() => void>;

/** Getter - returns the merge queue. */
declare function getMergeQueue(): Record<string, OnyxValue<string>[]>;

/** Getter - returns the merge queue promise. */
declare function getMergeQueuePromise(): Record<string, Promise<void | void[]>>;

/** Getter - returns the callback to state mapping. */
declare function getCallbackToStateMapping(): Record<string, Mapping<string>>;

/** Getter - returns the default key states. */
declare function getDefaultKeyStates(): Record<string, OnyxValue<string>>;

/**
 * Sets the initial values for the Onyx store
 *
 * @param keys - `ONYXKEYS` constants object from Onyx.init()
 * @param initialKeyStates - initial data to set when `init()` and `clear()` are called
 * @param safeEvictionKeys - This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal.
 */
declare function initStoreValues(keys: DeepRecord<string, OnyxKey>, initialKeyStates: Partial<NullableKeyValueMapping>, safeEvictionKeys: OnyxKey[]): void;

/**
 * Sends an action to DevTools extension
 *
 * @param method - Onyx method from METHOD
 * @param key - Onyx key that was changed
 * @param value - contains the change that was made by the method
 * @param mergedValue - (optional) value that was written in the storage after a merge method was executed.
 */
declare function sendActionToDevTools(method: OnyxMethod, key: undefined, value: Record<OnyxKey, OnyxValue<OnyxKey>>, mergedValue?: OnyxValue<OnyxKey>): void;
declare function sendActionToDevTools(method: OnyxMethod, key: OnyxKey, value: OnyxValue<OnyxKey>, mergedValue?: OnyxValue<OnyxKey>): void;

/**
 * We are batching together onyx updates. This helps with use cases where we schedule onyx updates after each other.
 * This happens for example in the Onyx.update function, where we process API responses that might contain a lot of
 * update operations. Instead of calling the subscribers for each update operation, we batch them together which will
 * cause react to schedule the updates at once instead of after each other. This is mainly a performance optimization.
 */
declare function maybeFlushBatchUpdates(): Promise<void>;

declare function batchUpdates(updates: () => void): Promise<void>;

/** Get some data from the store */
declare function get(key: OnyxKey): Promise<OnyxValue<OnyxKey>>;

/**
 * Returns current key names stored in persisted storage
 */
declare function getAllKeys(): Promise<Set<string>>;

/**
 * Checks to see if the a subscriber's supplied key
 * is associated with a collection of keys.
 */
declare function isCollectionKey(key: OnyxKey): key is CollectionKeyBase;

declare function isCollectionMemberKey<TCollectionKey extends CollectionKeyBase>(collectionKey: TCollectionKey, key: string): key is `${TCollectionKey}${string}`;

/**
 * Splits a collection member key into the collection key part and the ID part.
 * @param key - The collection member key to split.
 * @returns A tuple where the first element is the collection part and the second element is the ID part.
 */
declare function splitCollectionMemberKey<TKey extends CollectionKey>(key: TKey): [TKey extends `${infer Prefix}_${string}` ? `${Prefix}_` : never, string];

/**
 * Checks to see if a provided key is the exact configured key of our connected subscriber
 * or if the provided key is a collection member key (in case our configured key is a "collection key")
 */
declare function isKeyMatch(configKey: OnyxKey, key: OnyxKey): boolean;

/**
 * Checks to see if this key has been flagged as
 * safe for removal.
 */
declare function isSafeEvictionKey(testKey: OnyxKey): boolean;

/**
 * Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
 * If the requested key is a collection, it will return an object with all the collection members.
 */
declare function tryGetCachedValue<TKey extends OnyxKey>(key: TKey, mapping: Mapping<TKey>): OnyxValue<OnyxKey>;

/** Remove a key from the recently accessed key list. */
declare function removeLastAccessedKey(key: OnyxKey): void;

/**
 * Add a key to the list of recently accessed keys.
 * The least recently accessed key should be at the head and the most recently accessed key at the tail.
 */
declare function addLastAccessedKey(key: OnyxKey): void;

/**
 * Removes a key previously added to this list
 * which will enable it to be deleted again.
 */
declare function removeFromEvictionBlockList(key: OnyxKey, connectionID: number): void;

/**
 * Keys added to this list can never be deleted.
 */
declare function addToEvictionBlockList(key: OnyxKey, connectionID: number): void;

/**
 * Take all the keys that are safe to evict and add them to
 * the recently accessed list when initializing the app. This
 * enables keys that have not recently been accessed to be removed.
 */
declare function addAllSafeEvictionKeysToRecentlyAccessedList(): Promise<void>;

declare function getCachedCollection<TKey extends CollectionKeyBase>(collectionKey: TKey): Record<OnyxKey, OnyxValue<OnyxKey>>;

/** When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks */
declare function keysChanged<TKey extends CollectionKeyBase>(
    collectionKey: TKey,
    partialCollection: OnyxCollection<OnyxValue<OnyxKey>>,
    notifyRegularSubscibers?: boolean,
    notifyWithOnyxSubscibers?: boolean,
): void;
/**
 * When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks
 *
 * @example
 * keyChanged(key, value, subscriber => subscriber.initWithStoredValues === false)
 *
 * @param [canUpdateSubscriber] only subscribers that pass this truth test will be updated
 */
declare function keyChanged(
    key: OnyxKey,
    data: OnyxValue<OnyxKey>,
    prevData: OnyxValue<OnyxKey>,
    canUpdateSubscriber?: (_subscriber: Mapping<OnyxKey>) => boolean,
    notifyRegularSubscibers?: boolean,
    notifyWithOnyxSubscibers?: boolean,
): void;

/**
 * Sends the data obtained from the keys to the connection. It either:
 *     - sets state on the withOnyxInstances
 *     - triggers the callback function
 */
declare function sendDataToConnection<TKey extends OnyxKey>(
    mapping: Mapping<TKey>,
    val: OnyxValue<OnyxKey> | Record<OnyxKey, OnyxValue<OnyxKey>>,
    matchedKey: TKey | undefined,
    isBatched: boolean,
): void;

/**
 * We check to see if this key is flagged as safe for eviction and add it to the recentlyAccessedKeys list so that when we
 * run out of storage the least recently accessed key can be removed.
 */
declare function addKeyToRecentlyAccessedIfNeeded<TKey extends OnyxKey>(mapping: Mapping<TKey>): void;

/**
 * Gets the data for a given an array of matching keys, combines them into an object, and sends the result back to the subscriber.
 */
declare function getCollectionDataAndSendAsObject<TKey extends OnyxKey>(matchingKeys: CollectionKeyBase[], mapping: Mapping<TKey>): void;

/**
 * Schedules an update that will be appended to the macro task queue (so it doesn't update the subscribers immediately).
 *
 * @example
 * scheduleSubscriberUpdate(key, value, subscriber => subscriber.initWithStoredValues === false)
 */
declare function scheduleSubscriberUpdate<TKey extends OnyxKey>(
    key: TKey,
    value: KeyValueMapping[TKey],
    prevValue: KeyValueMapping[TKey],
    canUpdateSubscriber?: (_subscriber: Mapping<OnyxKey>) => boolean,
): Promise<void>;

/**
 * This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
 * so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
 * subscriber callbacks receive the data in a different format than they normally expect and it breaks code.
 */
declare function scheduleNotifyCollectionSubscribers(key: OnyxKey, value: OnyxCollection<OnyxValue<OnyxKey>>): Promise<void>;

/**
 * Remove a key from Onyx and update the subscribers
 */
declare function remove<TKey extends OnyxKey>(key: TKey): Promise<void>;

declare function reportStorageQuota(): Promise<void>;

/**
 * If we fail to set or merge we must handle this by
 * evicting some data from Onyx and then retrying to do
 * whatever it is we attempted to do.
 */
declare function evictStorageAndRetry<TMethod extends typeof Onyx.set | typeof Onyx.multiSet | typeof Onyx.mergeCollection>(
    error: Error,
    onyxMethod: TMethod,
    ...args: Parameters<TMethod>
): Promise<void>;

/** Notifies subscribers and writes current value to cache */
declare function broadcastUpdate<TKey extends OnyxKey>(key: TKey, value: KeyValueMapping[TKey], hasChanged: boolean, wasRemoved?: boolean): Promise<void[]>;

/**
 * @private
 */
declare function hasPendingMergeForKey(key: OnyxKey): boolean;

/**
 * Removes a key from storage if the value is null.
 * Otherwise removes all nested null values in objects and returns the object
 * @returns The value without null values and a boolean "wasRemoved", which indicates if the key got removed completely
 */
declare function removeNullValues<TKey extends OnyxKey>(
    key: TKey,
    value: OnyxValue<TKey>,
): {
    value: OnyxValue<TKey>;
    wasRemoved: boolean;
};
/**
 * Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
 * This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
 * to an array of key-value pairs in the above format and removes key-value pairs that are being set to null
 *
 * @return an array of key - value pairs <[key, value]>
 */
declare function prepareKeyValuePairsForStorage(data: Record<OnyxKey, OnyxValue<OnyxKey>>): Array<[OnyxKey, OnyxValue<OnyxKey>]>;
/**
 * Merges an array of changes with an existing value
 *
 * @param changes Array of changes that should be applied to the existing value
 */
declare function applyMerge(existingValue: OnyxValue<OnyxKey>, changes: Array<OnyxValue<OnyxKey>>, shouldRemoveNullObjectValues: boolean): any;
/**
 * Merge user provided default key value pairs.
 */
declare function initializeWithDefaultKeyStates(): Promise<void>;

/**
 * Returns a string cache key for a possible computed key.
 */
declare function getCacheKey(key: OnyxKey | AnyComputedKey): string;

/**
 * Returns if a key is a computed key.
 */
declare function isComputedKey(key: OnyxKey | AnyComputedKey): key is AnyComputedKey;

/**
 * Adds an entry in the dependent cache key map.
 */
declare function addDependentCacheKey(key: OnyxKey, dependentKey: OnyxKey): void;

const OnyxUtils = {
    METHOD,
    getMergeQueue,
    getMergeQueuePromise,
    getCallbackToStateMapping,
    getDefaultKeyStates,
    initStoreValues,
    sendActionToDevTools,
    maybeFlushBatchUpdates,
    batchUpdates,
    get,
    getAllKeys,
    isCollectionKey,
    isCollectionMemberKey,
    splitCollectionMemberKey,
    isKeyMatch,
    isSafeEvictionKey,
    tryGetCachedValue,
    removeLastAccessedKey,
    addLastAccessedKey,
    removeFromEvictionBlockList,
    addToEvictionBlockList,
    addAllSafeEvictionKeysToRecentlyAccessedList,
    getCachedCollection,
    keysChanged,
    keyChanged,
    sendDataToConnection,
    addKeyToRecentlyAccessedIfNeeded,
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
    getCacheKey,
    isComputedKey,
    addDependentCacheKey,
} as const;

export default OnyxUtils;
