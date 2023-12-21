import {Component} from 'react';
import * as Logger from './Logger';
import * as ActiveClientManager from './ActiveClientManager';
import {CollectionKey, CollectionKeyBase, DeepRecord, KeyValueMapping, NullishDeep, OnyxCollection, OnyxEntry, OnyxKey} from './types';

/**
 * Represents a mapping object where each `OnyxKey` maps to either a value of its corresponding type in `KeyValueMapping` or `null`.
 *
 * It's very similar to `KeyValueMapping` but this type accepts using `null` as well.
 */
type NullableKeyValueMapping = {
    [TKey in OnyxKey]: OnyxEntry<KeyValueMapping[TKey]>;
};

/**
 * Represents the base options used in `Onyx.connect()` method.
 */
type BaseConnectOptions = {
    statePropertyName?: string;
    withOnyxInstance?: Component;
    initWithStoredValues?: boolean;
};

/**
 * Represents the options used in `Onyx.connect()` method.
 * The type is built from `BaseConnectOptions` and extended to handle key/callback related options.
 * It includes two different forms, depending on whether we are waiting for a collection callback or not.
 *
 * If `waitForCollectionCallback` is `true`, it expects `key` to be a Onyx collection key and `callback` will be triggered with the whole collection
 * and will pass `value` as an `OnyxCollection`.
 *
 *
 * If `waitForCollectionCallback` is `false` or not specified, the `key` can be any Onyx key and `callback` will be triggered with updates of each collection item
 * and will pass `value` as an `OnyxEntry`.
 */
type ConnectOptions<TKey extends OnyxKey> = BaseConnectOptions &
    (
        | {
              key: TKey extends CollectionKey ? TKey : never;
              callback?: (value: OnyxCollection<KeyValueMapping[TKey]>) => void;
              waitForCollectionCallback: true;
          }
        | {
              key: TKey;
              callback?: (value: OnyxEntry<KeyValueMapping[TKey]>, key: TKey) => void;
              waitForCollectionCallback?: false;
          }
    );

/**
 * Represents a mapping between Onyx collection keys and their respective values.
 *
 * It helps to enforce that a Onyx collection key should not be without suffix (e.g. should always be of the form `${TKey}${string}`),
 * and to map each Onyx collection key with suffix to a value of type `TValue`.
 *
 * Also, the `TMap` type is inferred automatically in `mergeCollection()` method and represents
 * the object of collection keys/values specified in the second parameter of the method.
 */
type Collection<TKey extends CollectionKeyBase, TMap, TValue> = {
    [MapK in keyof TMap]: MapK extends `${TKey}${string}`
        ? MapK extends `${TKey}`
            ? never // forbids empty id
            : TValue
        : never;
};

/**
 * Represents different kinds of updates that can be passed to `Onyx.update()` method. It is a discriminated union of
 * different update methods (`SET`, `MERGE`, `MERGE_COLLECTION`), each with their own key and value structure.
 */
type OnyxUpdate =
    | {
          [TKey in OnyxKey]:
              | {
                    onyxMethod: typeof METHOD.SET;
                    key: TKey;
                    value: OnyxEntry<KeyValueMapping[TKey]>;
                }
              | {
                    onyxMethod: typeof METHOD.MERGE;
                    key: TKey;
                    value: NullishDeep<KeyValueMapping[TKey]>;
                };
      }[OnyxKey]
    | {
          [TKey in CollectionKeyBase]: {
              onyxMethod: typeof METHOD.MERGE_COLLECTION;
              key: TKey;
              value: Record<`${TKey}${string}`, NullishDeep<KeyValueMapping[TKey]>>;
          };
      }[CollectionKeyBase];

/**
 * Represents the options used in `Onyx.init()` method.
 */
type InitOptions = {
    keys?: DeepRecord<string, OnyxKey>;
    initialKeyStates?: Partial<NullableKeyValueMapping>;
    safeEvictionKeys?: OnyxKey[];
    maxCachedKeysCount?: number;
    captureMetrics?: boolean;
    shouldSyncMultipleInstances?: boolean;
    debugSetState?: boolean;
};

declare const METHOD: {
    readonly SET: 'set';
    readonly MERGE: 'merge';
    readonly MERGE_COLLECTION: 'mergecollection';
    readonly MULTI_SET: 'multiset';
    readonly CLEAR: 'clear';
};

/**
 * Returns current key names stored in persisted storage
 */
declare function getAllKeys(): Promise<Array<OnyxKey>>;

/**
 * Checks to see if this key has been flagged as
 * safe for removal.
 */
declare function isSafeEvictionKey(testKey: OnyxKey): boolean;

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
 *  component
 * @param [mapping.waitForCollectionCallback] If set to true, it will return the entire collection to the callback as a single object
 * @returns an ID to use when calling disconnect
 */
declare function connect<TKey extends OnyxKey>(mapping: ConnectOptions<TKey>): number;

/**
 * Remove the listener for a react component
 * @example
 * Onyx.disconnect(connectionID);
 *
 * @param connectionID unique id returned by call to Onyx.connect()
 */
declare function disconnect(connectionID: number, keyToRemoveFromEvictionBlocklist?: OnyxKey): void;

/**
 * Write a value to our store with the given key
 *
 * @param key ONYXKEY to set
 * @param value value to store
 */
declare function set<TKey extends OnyxKey>(key: TKey, value: OnyxEntry<KeyValueMapping[TKey]>): Promise<void>;

/**
 * Sets multiple keys and values
 *
 * @example Onyx.multiSet({'key1': 'a', 'key2': 'b'});
 *
 * @param data object keyed by ONYXKEYS and the values to set
 */
declare function multiSet(data: Partial<NullableKeyValueMapping>): Promise<void>;

/**
 * Merge a new value into an existing value at a key.
 *
 * The types of values that can be merged are `Object` and `Array`. To set another type of value use `Onyx.set()`. Merge
 * behavior uses lodash/merge under the hood for `Object` and simple concatenation for `Array`. However, it's important
 * to note that if you have an array value property on an `Object` that the default behavior of lodash/merge is not to
 * concatenate. See here: https://github.com/lodash/lodash/issues/2872
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
 *
 * @param key ONYXKEYS key
 * @param value Object or Array value to merge
 */
declare function merge<TKey extends OnyxKey>(key: TKey, value: NullishDeep<KeyValueMapping[TKey]>): Promise<void>;

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
declare function clear(keysToPreserve?: OnyxKey[]): Promise<void>;

/**
 * Merges a collection based on their keys
 *
 * Note that both `TKey` and `TMap` types are inferred automatically, `TKey` being the
 * collection key specified in the first parameter and `TMap` being the object of
 * collection keys/values specified in the second parameter.
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
declare function mergeCollection<TKey extends CollectionKeyBase, TMap>(collectionKey: TKey, collection: Collection<TKey, TMap, NullishDeep<KeyValueMapping[TKey]>>): Promise<void>;

/**
 * Insert API responses and lifecycle data into Onyx
 *
 * @param data An array of update objects
 * @returns resolves when all operations are complete
 */
declare function update(data: OnyxUpdate[]): Promise<void>;

/**
 * Initialize the store with actions and listening for storage events
 *
 * @param [options={}] config object
 * @param [options.keys={}] `ONYXKEYS` constants object
 * @param [options.initialKeyStates={}] initial data to set when `init()` and `clear()` is called
 * @param [options.safeEvictionKeys=[]] This is an array of keys
 * (individual or collection patterns) that when provided to Onyx are flagged
 * as "safe" for removal. Any components subscribing to these keys must also
 * implement a canEvict option. See the README for more info.
 * @param [options.maxCachedKeysCount=55] Sets how many recent keys should we try to keep in cache
 * Setting this to 0 would practically mean no cache
 * We try to free cache when we connect to a safe eviction key
 * @param [options.captureMetrics] Enables Onyx benchmarking and exposes the get/print/reset functions
 * @param [options.shouldSyncMultipleInstances] Auto synchronize storage events between multiple instances
 * of Onyx running in different tabs/windows. Defaults to true for platforms that support local storage (web/desktop)
 * @param [options.debugSetState] Enables debugging setState() calls to connected components.
 * @example
 * Onyx.init({
 *     keys: ONYXKEYS,
 *     initialKeyStates: {
 *         [ONYXKEYS.SESSION]: {loading: false},
 *     },
 * });
 */
declare function init(config?: InitOptions): void;

/**
 * @private
 */
declare function hasPendingMergeForKey(key: OnyxKey): boolean;

/**
 * When set these keys will not be persisted to storage
 */
declare function setMemoryOnlyKeys(keyList: OnyxKey[]): void;

/**
 * Sets the callback to be called when the clear finishes executing.
 */
declare function onClear(callback: () => void): void;

declare const Onyx: {
    connect: typeof connect;
    disconnect: typeof disconnect;
    set: typeof set;
    multiSet: typeof multiSet;
    merge: typeof merge;
    mergeCollection: typeof mergeCollection;
    hasPendingMergeForKey: typeof hasPendingMergeForKey;
    update: typeof update;
    clear: typeof clear;
    getAllKeys: typeof getAllKeys;
    init: typeof init;
    registerLogger: typeof Logger.registerLogger;
    addToEvictionBlockList: typeof addToEvictionBlockList;
    removeFromEvictionBlockList: typeof removeFromEvictionBlockList;
    isSafeEvictionKey: typeof isSafeEvictionKey;
    METHOD: typeof METHOD;
    setMemoryOnlyKeys: typeof setMemoryOnlyKeys;
    onClear: typeof onClear;
    isClientManagerReady: typeof ActiveClientManager.isReady;
    isClientTheLeader: typeof ActiveClientManager.isClientTheLeader;
    subscribeToClientChange: typeof ActiveClientManager.subscribeToClientChange;
};

export default Onyx;
export {OnyxUpdate, ConnectOptions};
