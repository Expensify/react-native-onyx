import type {BatchQueryResult, QueryResult} from 'react-native-quick-sqlite';

type Key = string;
type Value = IDBValidKey;
type KeyValuePair = [Key, Value];
type KeyList = Key[];
type KeyValuePairList = KeyValuePair[];

type OnStorageKeyChanged = (key: Key, value: Value | null) => void;

type StorageProvider = {
    /**
     * Gets the value of a given key or return `null` if it's not available in storage
     */
    getItem: (key: Key) => Promise<Value | null>;

    /**
     * Get multiple key-value pairs for the given array of keys in a batch
     */
    multiGet: (keys: KeyList) => Promise<KeyValuePairList>;

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem: (key: Key, value: Value) => Promise<QueryResult | void>;

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet: (pairs: KeyValuePairList) => Promise<BatchQueryResult | void>;

    /**
     * Multiple merging of existing and new values in a batch
     */
    multiMerge: (pairs: KeyValuePairList) => Promise<BatchQueryResult | IDBValidKey[]>;

    /**
     * Merges an existing value with a new one by leveraging JSON_PATCH
     * @param changes - the delta for a specific key
     * @param modifiedData - the pre-merged data from `Onyx.applyMerge`
     */
    mergeItem: (key: Key, changes: Value, modifiedData: Value) => Promise<BatchQueryResult | void>;

    /**
     * Returns all keys available in storage
     */
    getAllKeys: () => Promise<KeyList>;

    /**
     * Removes given key and its value from storage
     */
    removeItem: (key: Key) => Promise<QueryResult | void>;

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
export type {Value, Key, KeyList, KeyValuePairList};
