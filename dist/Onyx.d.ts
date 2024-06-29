import * as Logger from './Logger';
import type { CollectionKeyBase, ConnectOptions, InitOptions, Mapping, OnyxKey, OnyxMergeCollectionInput, OnyxMergeInput, OnyxMultiSetInput, OnyxSetInput, OnyxUpdate } from './types';
/** Initialize the store with actions and listening for storage events */
declare function init({ keys, initialKeyStates, safeEvictionKeys, maxCachedKeysCount, shouldSyncMultipleInstances, debugSetState, }: InitOptions): void;
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
 * @param [mapping.selector] THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be used to subscribe to a subset of an Onyx key's data.
 *       The sourceData and withOnyx state are passed to the selector and should return the simplified data. Using this setting on `withOnyx` can have very positive
 *       performance benefits because the component will only re-render when the subset of data changes. Otherwise, any change of data on any property would normally
 *       cause the component to re-render (and that can be expensive from a performance standpoint).
 * @param [mapping.initialValue] THIS PARAM IS ONLY USED WITH withOnyx().
 * If included, this will be passed to the component so that something can be rendered while data is being fetched from the DB.
 * Note that it will not cause the component to have the loading prop set to true.
 * @returns an ID to use when calling disconnect
 */
declare function connect<TKey extends OnyxKey>(connectOptions: ConnectOptions<TKey>): number;
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
declare function set<TKey extends OnyxKey>(key: TKey, value: OnyxSetInput<TKey>): Promise<void>;
/**
 * Sets multiple keys and values
 *
 * @example Onyx.multiSet({'key1': 'a', 'key2': 'b'});
 *
 * @param data object keyed by ONYXKEYS and the values to set
 */
declare function multiSet(data: OnyxMultiSetInput): Promise<void>;
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
declare function merge<TKey extends OnyxKey>(key: TKey, changes: OnyxMergeInput<TKey>): Promise<void>;
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
declare function mergeCollection<TKey extends CollectionKeyBase, TMap>(collectionKey: TKey, collection: OnyxMergeCollectionInput<TKey, TMap>): Promise<void>;
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
 * Insert API responses and lifecycle data into Onyx
 *
 * @param data An array of objects with update expressions
 * @returns resolves when all operations are complete
 */
declare function update(data: OnyxUpdate[]): Promise<void>;
declare const Onyx: {
    readonly METHOD: {
        readonly SET: "set";
        readonly MERGE: "merge";
        readonly MERGE_COLLECTION: "mergecollection";
        readonly MULTI_SET: "multiset";
        readonly CLEAR: "clear";
    };
    readonly connect: typeof connect;
    readonly disconnect: typeof disconnect;
    readonly set: typeof set;
    readonly multiSet: typeof multiSet;
    readonly merge: typeof merge;
    readonly mergeCollection: typeof mergeCollection;
    readonly update: typeof update;
    readonly clear: typeof clear;
    readonly init: typeof init;
    readonly registerLogger: typeof Logger.registerLogger;
};
export default Onyx;
export type { OnyxUpdate, Mapping, ConnectOptions };
