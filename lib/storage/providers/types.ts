import type {OnyxKey, OnyxValue} from '../../types';
import type {FastMergeReplaceNullPatch} from '../../utils';

type StorageKeyValuePair = [key: OnyxKey, value: OnyxValue<OnyxKey>, replaceNullPatches?: FastMergeReplaceNullPatch[]];
type StorageKeyList = OnyxKey[];

type DatabaseSize = {
    bytesUsed: number;
    bytesRemaining: number;
};

type OnStorageKeyChanged = <TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>) => void;

type StorageProvider<TStore> = {
    store: TStore;

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
    multiGet: (keys: StorageKeyList) => Promise<StorageKeyValuePair[]>;

    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem: <TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>) => Promise<void>;

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet: (pairs: StorageKeyValuePair[]) => Promise<void>;

    /**
     * Multiple merging of existing and new values in a batch
     */
    multiMerge: (pairs: StorageKeyValuePair[]) => Promise<void>;

    /**
     * Merges an existing value with a new one
     * @param change - the change to merge with the existing value
     */
    mergeItem: <TKey extends OnyxKey>(key: TKey, change: OnyxValue<TKey>, replaceNullPatches?: FastMergeReplaceNullPatch[]) => Promise<void>;

    /**
     * Returns all keys available in storage
     */
    getAllKeys: () => Promise<StorageKeyList>;

    /**
     * Removes given key and its value from storage
     */
    removeItem: (key: OnyxKey) => Promise<void>;

    /**
     * Removes given keys and their values from storage
     */
    removeItems: (keys: StorageKeyList) => Promise<void>;

    /**
     * Clears absolutely everything from storage
     */
    clear: () => Promise<void>;

    /**
     * Gets the total bytes of the database file
     */
    getDatabaseSize: () => Promise<DatabaseSize>;

    /**
     * @param onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    keepInstancesSync?: (onStorageKeyChanged: OnStorageKeyChanged) => void;
};

export default StorageProvider;
export type {StorageKeyList, StorageKeyValuePair, OnStorageKeyChanged};
