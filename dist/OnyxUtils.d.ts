import type { ValueOf } from 'type-fest';
import type Onyx from './Onyx';
import type { CollectionKey, CollectionKeyBase, DeepRecord, KeyValueMapping, Mapping, OnyxCollection, OnyxEntry, OnyxInput, OnyxKey, OnyxMergeCollectionInput, OnyxValue, WithOnyxConnectOptions } from './types';
declare const METHOD: {
    readonly SET: "set";
    readonly MERGE: "merge";
    readonly MERGE_COLLECTION: "mergecollection";
    readonly MULTI_SET: "multiset";
    readonly CLEAR: "clear";
};
type OnyxMethod = ValueOf<typeof METHOD>;
declare function getSnapshotKey(): OnyxKey | null;
/**
 * Getter - returns the merge queue.
 */
declare function getMergeQueue(): Record<OnyxKey, Array<OnyxValue<OnyxKey>>>;
/**
 * Getter - returns the merge queue promise.
 */
declare function getMergeQueuePromise(): Record<OnyxKey, Promise<void>>;
/**
 * Getter - returns the callback to state mapping.
 */
declare function getCallbackToStateMapping(): Record<string, Mapping<OnyxKey>>;
/**
 * Getter - returns the default key states.
 */
declare function getDefaultKeyStates(): Record<OnyxKey, OnyxValue<OnyxKey>>;
/**
 * Sets the initial values for the Onyx store
 *
 * @param keys - `ONYXKEYS` constants object from Onyx.init()
 * @param initialKeyStates - initial data to set when `init()` and `clear()` are called
 * @param safeEvictionKeys - This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal.
 */
declare function initStoreValues(keys: DeepRecord<string, OnyxKey>, initialKeyStates: Partial<KeyValueMapping>, safeEvictionKeys: OnyxKey[]): void;
/**
 * Sends an action to DevTools extension
 *
 * @param method - Onyx method from METHOD
 * @param key - Onyx key that was changed
 * @param value - contains the change that was made by the method
 * @param mergedValue - (optional) value that was written in the storage after a merge method was executed.
 */
declare function sendActionToDevTools(method: typeof METHOD.MERGE_COLLECTION | typeof METHOD.MULTI_SET, key: undefined, value: OnyxCollection<KeyValueMapping[OnyxKey]>, mergedValue?: undefined): void;
declare function sendActionToDevTools(method: Exclude<OnyxMethod, typeof METHOD.MERGE_COLLECTION | typeof METHOD.MULTI_SET>, key: OnyxKey, value: OnyxEntry<KeyValueMapping[OnyxKey]>, mergedValue?: OnyxEntry<KeyValueMapping[OnyxKey]>): void;
/**
 * We are batching together onyx updates. This helps with use cases where we schedule onyx updates after each other.
 * This happens for example in the Onyx.update function, where we process API responses that might contain a lot of
 * update operations. Instead of calling the subscribers for each update operation, we batch them together which will
 * cause react to schedule the updates at once instead of after each other. This is mainly a performance optimization.
 */
declare function maybeFlushBatchUpdates(): Promise<void>;
declare function batchUpdates(updates: () => void): Promise<void>;
/** Get some data from the store */
declare function get<TKey extends OnyxKey, TValue extends OnyxValue<TKey>>(key: TKey): Promise<TValue>;
/** Returns current key names stored in persisted storage */
declare function getAllKeys(): Promise<Set<OnyxKey>>;
/**
 * Returns set of all registered collection keys
 */
declare function getCollectionKeys(): Set<OnyxKey>;
/**
 * Checks to see if the subscriber's supplied key
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
/** Checks to see if this key has been flagged as safe for removal. */
declare function isSafeEvictionKey(testKey: OnyxKey): boolean;
/**
 * Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
 * If the requested key is a collection, it will return an object with all the collection members.
 */
declare function tryGetCachedValue<TKey extends OnyxKey>(key: TKey, mapping?: Partial<WithOnyxConnectOptions<TKey>>): OnyxValue<OnyxKey>;
/**
 * Remove a key from the recently accessed key list.
 */
declare function removeLastAccessedKey(key: OnyxKey): void;
/**
 * Add a key to the list of recently accessed keys. The least
 * recently accessed key should be at the head and the most
 * recently accessed key at the tail.
 */
declare function addLastAccessedKey(key: OnyxKey): void;
/**
 * Removes a key previously added to this list
 * which will enable it to be deleted again.
 */
declare function removeFromEvictionBlockList(key: OnyxKey, connectionID: number): void;
/** Keys added to this list can never be deleted. */
declare function addToEvictionBlockList(key: OnyxKey, connectionID: number): void;
/**
 * Take all the keys that are safe to evict and add them to
 * the recently accessed list when initializing the app. This
 * enables keys that have not recently been accessed to be
 * removed.
 */
declare function addAllSafeEvictionKeysToRecentlyAccessedList(): Promise<void>;
declare function getCachedCollection<TKey extends CollectionKeyBase>(collectionKey: TKey, collectionMemberKeys?: string[]): NonNullable<OnyxCollection<KeyValueMapping[TKey]>>;
/**
 * When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks
 */
declare function keysChanged<TKey extends CollectionKeyBase>(collectionKey: TKey, partialCollection: OnyxCollection<KeyValueMapping[TKey]>, partialPreviousCollection: OnyxCollection<KeyValueMapping[TKey]> | undefined, notifyRegularSubscibers?: boolean, notifyWithOnyxSubscibers?: boolean): void;
/**
 * When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks
 *
 * @example
 * keyChanged(key, value, subscriber => subscriber.initWithStoredValues === false)
 */
declare function keyChanged<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>, previousValue: OnyxValue<TKey>, canUpdateSubscriber?: (subscriber?: Mapping<OnyxKey>) => boolean, notifyRegularSubscibers?: boolean, notifyWithOnyxSubscibers?: boolean): void;
/**
 * Sends the data obtained from the keys to the connection. It either:
 *     - sets state on the withOnyxInstances
 *     - triggers the callback function
 */
declare function sendDataToConnection<TKey extends OnyxKey>(mapping: Mapping<TKey>, value: OnyxValue<TKey> | null, matchedKey: TKey | undefined, isBatched: boolean): void;
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
declare function scheduleSubscriberUpdate<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>, previousValue: OnyxValue<TKey>, canUpdateSubscriber?: (subscriber?: Mapping<OnyxKey>) => boolean): Promise<void>;
/**
 * This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
 * so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
 * subscriber callbacks receive the data in a different format than they normally expect and it breaks code.
 */
declare function scheduleNotifyCollectionSubscribers<TKey extends OnyxKey>(key: TKey, value: OnyxCollection<KeyValueMapping[TKey]>, previousValue?: OnyxCollection<KeyValueMapping[TKey]>): Promise<void>;
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
declare function evictStorageAndRetry<TMethod extends typeof Onyx.set | typeof Onyx.multiSet | typeof Onyx.mergeCollection>(error: Error, onyxMethod: TMethod, ...args: Parameters<TMethod>): Promise<void>;
/**
 * Notifies subscribers and writes current value to cache
 */
declare function broadcastUpdate<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>, hasChanged?: boolean): Promise<void>;
declare function hasPendingMergeForKey(key: OnyxKey): boolean;
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
declare function removeNullValues<Value extends OnyxInput<OnyxKey> | undefined>(key: OnyxKey, value: Value, shouldRemoveNestedNulls?: boolean): RemoveNullValuesOutput<Value>;
/**
 * Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
 * This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
 * to an array of key-value pairs in the above format and removes key-value pairs that are being set to null

* @return an array of key - value pairs <[key, value]>
 */
declare function prepareKeyValuePairsForStorage(data: Record<OnyxKey, OnyxInput<OnyxKey>>, shouldRemoveNestedNulls: boolean): Array<[OnyxKey, OnyxInput<OnyxKey>]>;
/**
 * Merges an array of changes with an existing value
 *
 * @param changes Array of changes that should be applied to the existing value
 */
declare function applyMerge<TValue extends OnyxInput<OnyxKey> | undefined, TChange extends OnyxInput<OnyxKey> | undefined>(existingValue: TValue, changes: TChange[], shouldRemoveNestedNulls: boolean): TChange;
/**
 * Merge user provided default key value pairs.
 */
declare function initializeWithDefaultKeyStates(): Promise<void>;
/**
 * Verify if the collection is valid for merging into the collection key using mergeCollection()
 */
declare function isValidMergeCollection<TKey extends CollectionKeyBase, TMap>(collectionKey: TKey, collection: OnyxMergeCollectionInput<TKey, TMap>): boolean;
declare const OnyxUtils: {
    METHOD: {
        readonly SET: "set";
        readonly MERGE: "merge";
        readonly MERGE_COLLECTION: "mergecollection";
        readonly MULTI_SET: "multiset";
        readonly CLEAR: "clear";
    };
    getMergeQueue: typeof getMergeQueue;
    getMergeQueuePromise: typeof getMergeQueuePromise;
    getCallbackToStateMapping: typeof getCallbackToStateMapping;
    getDefaultKeyStates: typeof getDefaultKeyStates;
    initStoreValues: typeof initStoreValues;
    sendActionToDevTools: typeof sendActionToDevTools;
    maybeFlushBatchUpdates: typeof maybeFlushBatchUpdates;
    batchUpdates: typeof batchUpdates;
    get: typeof get;
    getAllKeys: typeof getAllKeys;
    getCollectionKeys: typeof getCollectionKeys;
    isCollectionKey: typeof isCollectionKey;
    isCollectionMemberKey: typeof isCollectionMemberKey;
    splitCollectionMemberKey: typeof splitCollectionMemberKey;
    isKeyMatch: typeof isKeyMatch;
    isSafeEvictionKey: typeof isSafeEvictionKey;
    tryGetCachedValue: typeof tryGetCachedValue;
    removeLastAccessedKey: typeof removeLastAccessedKey;
    addLastAccessedKey: typeof addLastAccessedKey;
    removeFromEvictionBlockList: typeof removeFromEvictionBlockList;
    addToEvictionBlockList: typeof addToEvictionBlockList;
    addAllSafeEvictionKeysToRecentlyAccessedList: typeof addAllSafeEvictionKeysToRecentlyAccessedList;
    getCachedCollection: typeof getCachedCollection;
    keysChanged: typeof keysChanged;
    keyChanged: typeof keyChanged;
    sendDataToConnection: typeof sendDataToConnection;
    addKeyToRecentlyAccessedIfNeeded: typeof addKeyToRecentlyAccessedIfNeeded;
    getCollectionDataAndSendAsObject: typeof getCollectionDataAndSendAsObject;
    scheduleSubscriberUpdate: typeof scheduleSubscriberUpdate;
    scheduleNotifyCollectionSubscribers: typeof scheduleNotifyCollectionSubscribers;
    remove: typeof remove;
    reportStorageQuota: typeof reportStorageQuota;
    evictStorageAndRetry: typeof evictStorageAndRetry;
    broadcastUpdate: typeof broadcastUpdate;
    hasPendingMergeForKey: typeof hasPendingMergeForKey;
    removeNullValues: typeof removeNullValues;
    prepareKeyValuePairsForStorage: typeof prepareKeyValuePairsForStorage;
    applyMerge: typeof applyMerge;
    initializeWithDefaultKeyStates: typeof initializeWithDefaultKeyStates;
    getSnapshotKey: typeof getSnapshotKey;
    isValidMergeCollection: typeof isValidMergeCollection;
};
export default OnyxUtils;
