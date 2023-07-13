import {Component} from 'react';
import {PartialDeep} from 'type-fest';
import * as Logger from './Logger';
import {DeepRecord, Key, CollectionKey, Selector, Value} from './types';

type KeyValueMap = {
    [TKey in Key | CollectionKey]: Value[TKey];
};

type BaseConnectOptions<TKey extends Key | CollectionKey> = {
    statePropertyName?: string;
    withOnyxInstance?: Component;
    initWithStoredValues?: boolean;
    selector?: Selector<TKey>;
};

type ConnectOptions<TKey extends Key | CollectionKey> = BaseConnectOptions<TKey> &
    (
        | {
              key: TKey extends CollectionKey ? TKey : never;
              callback?: (value: Record<string, Value[TKey]> | null, key?: TKey) => void;
              waitForCollectionCallback: true;
          }
        | {
              key: TKey;
              callback?: (value: Value[TKey] | null, key?: TKey) => void;
              waitForCollectionCallback?: false;
          }
    );

type MergeCollection<TKey extends Key, TMap, TValue> = {
    [MapK in keyof TMap]: MapK extends `${TKey}${string}`
        ? MapK extends `${TKey}`
            ? never // forbids empty id
            : TValue
        : never;
};

type UpdateOperation<TKey extends Key | CollectionKey> =
    | {
          onyxMethod: 'set';
          key: TKey;
          value: Value[TKey];
      }
    | {
          onyxMethod: 'merge';
          key: TKey;
          value: PartialDeep<Value[TKey]>;
      }
    | {
          [TKey in CollectionKey]: {
              onyxMethod: 'mergeCollection';
              key: TKey;
              value: Record<`${TKey}${string}`, PartialDeep<Value[TKey]>>;
          };
      }[CollectionKey];

type UpdateOperations<TKeyList extends (Key | CollectionKey)[]> = {
    [TKey in keyof TKeyList]: UpdateOperation<TKeyList[TKey]>;
};

type InitOptions = {
    keys?: DeepRecord<string, string>;
    initialKeyStates?: Partial<KeyValueMap>;
    safeEvictionKeys?: Key[];
    maxCachedKeysCount?: number;
    captureMetrics?: boolean;
    shouldSyncMultipleInstances?: boolean;
    debugSetState?: boolean;
};

declare const METHOD: {
    readonly SET: string;
    readonly MERGE: string;
    readonly MERGE_COLLECTION: string;
    readonly CLEAR: string;
};

/**
 * Returns current key names stored in persisted storage
 */
declare function getAllKeys<TKey extends Key>(): Promise<TKey[]>;

/**
 * Checks to see if this key has been flagged as
 * safe for removal.
 *
 * @param testKey
 */
declare function isSafeEvictionKey<TKey extends Key | CollectionKey>(testKey: TKey): boolean;

/**
 * Removes a key previously added to this list
 * which will enable it to be deleted again.
 *
 * @param key
 * @param connectionID
 */
declare function removeFromEvictionBlockList<TKey extends Key | CollectionKey>(key: TKey, connectionID: number): void;

/**
 * Keys added to this list can never be deleted.
 *
 * @param key
 * @param connectionID
 */
declare function addToEvictionBlockList<TKey extends Key | CollectionKey>(key: TKey, connectionID: number): void;

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
 * @param {Object} [mapping.withOnyxInstance] whose setState() method will be called with any changed data
 *      This is used by React components to connect to Onyx
 * @param [mapping.callback] a method that will be called with changed data
 *      This is used by any non-React code to connect to Onyx
 * @param [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
 *  component
 * @param [mapping.waitForCollectionCallback] If set to true, it will return the entire collection to the callback as a single object
 * @param {String|Function} [mapping.selector] THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be used to subscribe to a subset of an Onyx key's data.
 *       If the selector is a string, the selector is passed to lodashGet on the sourceData. If the selector is a function, the sourceData and withOnyx state are
 *       passed to the selector and should return the simplified data. Using this setting on `withOnyx` can have very positive performance benefits because the component
 *       will only re-render when the subset of data changes. Otherwise, any change of data on any property would normally cause the component to re-render (and that can
 *       be expensive from a performance standpoint).
 * @returns an ID to use when calling disconnect
 */
declare function connect<TKey extends Key | CollectionKey>(mapping: ConnectOptions<TKey>): number;

/**
 * Remove the listener for a react component
 * @example
 * Onyx.disconnect(connectionID);
 *
 * @param connectionID unique id returned by call to Onyx.connect()
 * @param [keyToRemoveFromEvictionBlocklist]
 */
declare function disconnect<TKey extends Key | CollectionKey>(connectionID: number, keyToRemoveFromEvictionBlocklist?: TKey): void;

/**
 * Write a value to our store with the given key
 *
 * @param key ONYXKEY to set
 * @param value value to store
 */
declare function set<TKey extends Key | CollectionKey>(key: TKey, value: Value[TKey] | null): Promise<void>;

/**
 * Sets multiple keys and values
 *
 * @example Onyx.multiSet({'key1': 'a', 'key2': 'b'});
 *
 * @param data object keyed by ONYXKEYS and the values to set
 */
declare function multiSet(data: Partial<KeyValueMap>): Promise<void>;

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
declare function merge<TKey extends Key | CollectionKey>(key: TKey, value: PartialDeep<Value[TKey]>): Promise<void>;

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
declare function clear(keysToPreserve?: (Key | CollectionKey)[]): Promise<void>;

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
declare function mergeCollection<TKey extends CollectionKey, TMap>(collectionKey: TKey, collection: MergeCollection<TKey, TMap, PartialDeep<Value[TKey]>>): Promise<void>;

/**
 * Insert API responses and lifecycle data into Onyx
 *
 * @param data An array of objects with shape {onyxMethod: oneOf('set', 'merge', 'mergeCollection'), key: string, value: *}
 * @returns resolves when all operations are complete
 */
declare function update<TKeyList extends (Key | CollectionKey)[]>(data: UpdateOperations<[...TKeyList]>): Promise<void>;

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

declare const Onyx: {
    connect: typeof connect;
    disconnect: typeof disconnect;
    set: typeof set;
    multiSet: typeof multiSet;
    merge: typeof merge;
    mergeCollection: typeof mergeCollection;
    update: typeof update;
    clear: typeof clear;
    getAllKeys: typeof getAllKeys;
    init: typeof init;
    registerLogger: typeof Logger.registerLogger;
    addToEvictionBlockList: typeof addToEvictionBlockList;
    removeFromEvictionBlockList: typeof removeFromEvictionBlockList;
    isSafeEvictionKey: typeof isSafeEvictionKey;
    METHOD: typeof METHOD;
};

export default Onyx;
