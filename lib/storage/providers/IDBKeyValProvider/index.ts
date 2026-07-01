import type {UseStore} from 'idb-keyval';
import * as IDB from 'idb-keyval';
import utils from '../../../utils';
import type StorageProvider from '../types';
import type {OnyxKey, OnyxValue} from '../../../types';
import createStore from './createStore';
import classifyIDBError from './classifyError';
import type {StorageKeyValuePair} from '../types';

const DB_NAME = 'OnyxDB';
const STORE_NAME = 'keyvaluepairs';

/**
 * Awaits an IndexedDB write transaction. idb-keyval's promisifyRequest rejects with
 * `transaction.error`, which is `null` for an abort not caused by its own request
 * (connection close / versionchange / a sibling transaction aborting). Normalize that
 * `null` into a tagged AbortError.
 */
function promisifyWriteTransaction(transaction: IDBTransaction): Promise<void> {
    return IDB.promisifyRequest(transaction).catch((error) => {
        throw error ?? new DOMException('IDB write transaction aborted without an error', 'AbortError');
    });
}

const provider: StorageProvider<UseStore | undefined> = {
    // We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
    // which might not be available in certain environments that load the bundle (e.g. electron main process).
    store: undefined,
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'IDBKeyValProvider',
    /**
     * Classifies an IndexedDB write failure into the shared storage taxonomy.
     */
    classifyError: classifyIDBError,
    /**
     * Initializes the storage provider
     */
    init() {
        const newIdbKeyValStore = createStore(DB_NAME, STORE_NAME);

        if (newIdbKeyValStore == null) {
            throw Error('IDBKeyVal store could not be created');
        }
        provider.store = newIdbKeyValStore;
    },

    setItem(key, value) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        if (value === null) {
            return provider.removeItem(key);
        }

        // Drive the write through the manual store transaction so promisifyWriteTransaction can
        // normalize a null abort error — idb-keyval's IDB.set() awaits the raw transaction and
        // would propagate the unclassifiable "Error: null".
        return provider.store('readwrite', (store) => {
            store.put(value, key);
            return promisifyWriteTransaction(store.transaction);
        });
    },
    multiGet(keysParam) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return IDB.getMany(keysParam, provider.store).then((values) => values.map((value, index) => [keysParam[index], value]));
    },
    multiMerge(pairs) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return provider.store('readwrite', (store) => {
            // Note: we are using the manual store transaction here, to fit the read and update
            // of the items in one transaction to achieve best performance.
            const getValues = Promise.all(pairs.map(([key]) => IDB.promisifyRequest<OnyxValue<OnyxKey>>(store.get(key))));

            return getValues.then((values) => {
                for (const [index, [key, value]] of pairs.entries()) {
                    if (value === null) {
                        store.delete(key);
                    } else {
                        const newValue = utils.fastMerge(values.at(index) as Record<string, unknown>, value as Record<string, unknown>, {
                            shouldRemoveNestedNulls: true,
                            objectRemovalMode: 'replace',
                        }).result;

                        store.put(newValue, key);
                    }
                }

                return promisifyWriteTransaction(store.transaction);
            });
        });
    },
    mergeItem(key, change) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly.
        return provider.multiMerge([[key, change]]);
    },
    multiSet(pairs) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return provider.store('readwrite', (store) => {
            for (const [key, value] of pairs) {
                if (value === null) {
                    store.delete(key);
                } else {
                    store.put(value, key);
                }
            }

            return promisifyWriteTransaction(store.transaction);
        });
    },
    clear() {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return IDB.clear(provider.store);
    },
    getAllKeys() {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return IDB.keys(provider.store);
    },
    getAll() {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return IDB.entries(provider.store) as Promise<StorageKeyValuePair[]>;
    },
    getItem(key) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return (
            IDB.get(key, provider.store)
                // idb-keyval returns undefined for missing items, but this needs to return null so that idb-keyval does the same thing as SQLiteStorage.
                .then((val) => (val === undefined ? null : val))
        );
    },
    removeItem(key) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return provider.store('readwrite', (store) => {
            store.delete(key);
            return promisifyWriteTransaction(store.transaction);
        });
    },
    removeItems(keysParam) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return provider.store('readwrite', (store) => {
            for (const key of keysParam) {
                store.delete(key);
            }
            return promisifyWriteTransaction(store.transaction);
        });
    },
    getDatabaseSize() {
        if (!provider.store) {
            throw new Error('Store is not initialized!');
        }

        if (!window.navigator || !window.navigator.storage) {
            throw new Error('StorageManager browser API unavailable');
        }

        return window.navigator.storage
            .estimate()
            .then((value) => ({
                bytesUsed: value.usage ?? 0,
                bytesRemaining: (value.quota ?? 0) - (value.usage ?? 0),
                usageDetails: (value as StorageEstimate & {usageDetails?: Record<string, number>}).usageDetails,
            }))
            .catch((error) => {
                throw new Error(`Unable to estimate web storage quota. Original error: ${error}`);
            });
    },
};

export default provider;
