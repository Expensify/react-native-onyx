import type {BatchQueryResult, QueryResult} from 'react-native-quick-sqlite';
import type {MixedOperationsQueue, OnyxKey, OnyxValue} from '../../types';

type KeyValuePair = [OnyxKey, OnyxValue<OnyxKey>];
type KeyList = OnyxKey[];
type KeyValuePairList = KeyValuePair[];

type OnStorageKeyChanged = <TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>) => void;

type StorageProvider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: string;
    /**
     * Initializes the storage provider
     */
    init: () => void;
    /**
     * Gets the value of a given key or return `null` if it's not available in storage
     */
    getItem: <TKey extends OnyxKey>(key: TKey) => Promise<OnyxValue<TKey>>;

    /**
     * Get multiple key-value pairs for the given array of keys in a batch
     */
    multiGet: (keys: KeyList) => Promise<KeyValuePairList>;

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem: <TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>) => Promise<QueryResult | void>;

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet: (pairs: KeyValuePairList) => Promise<BatchQueryResult | void>;

    /**
     * Multiple merging of existing and new values in a batch
     */
    multiMerge: (pairs: KeyValuePairList, mergeReplaceNullPatches?: MixedOperationsQueue['mergeReplaceNullPatches']) => Promise<BatchQueryResult | IDBValidKey[] | void>;

    /**
     * Merges an existing value with a new one
     * @param change - the change to merge with the existing value
     */
    mergeItem: <TKey extends OnyxKey>(key: TKey, change: OnyxValue<TKey>) => Promise<BatchQueryResult | void>;

    /**
     * Returns all keys available in storage
     */
    getAllKeys: () => Promise<KeyList>;

    /**
     * Removes given key and its value from storage
     */
    removeItem: (key: OnyxKey) => Promise<QueryResult | void>;

    /**
     * Removes given keys and their values from storage
     */
    removeItems: (keys: KeyList) => Promise<QueryResult | void>;

    /**
     * Clears absolutely everything from storage
     */
    clear: () => Promise<QueryResult | void>;

    /**
     * Gets the total bytes of the database file
     */
    getDatabaseSize: () => Promise<{bytesUsed: number; bytesRemaining: number}>;

    /**
     * @param onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    keepInstancesSync?: (onStorageKeyChanged: OnStorageKeyChanged) => void;
};

export default StorageProvider;
export type {KeyList, KeyValuePair, KeyValuePairList, OnStorageKeyChanged};
