import type {UseStore} from 'idb-keyval';
import IDB from 'idb-keyval';
import utils from '../../../utils';
import type StorageProvider from '../types';
import type {OnyxKey, OnyxValue} from '../../../types';
import createStore from './createStore';

const DB_NAME = 'OnyxDB';
const STORE_NAME = 'keyvaluepairs';

const provider: StorageProvider<UseStore | undefined> = {
    // We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
    // which might not be available in certain environments that load the bundle (e.g. electron main process).
    store: undefined,
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'IDBKeyValProvider',
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

        return IDB.set(key, value, provider.store);
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

        return provider
            .store('readwrite', (store) => {
                // Note: we are using the manual store transaction here, to fit the read and update
                // of the items in one transaction to achieve best performance.
                const getValues = Promise.all(pairs.map(([key]) => IDB.promisifyRequest<OnyxValue<OnyxKey>>(store.get(key))));

                return getValues.then((values) => {
                    const pairsWithoutNull = pairs.filter(([key, value]) => {
                        if (value === null) {
                            provider.removeItem(key);
                            return false;
                        }

                        return true;
                    });

                    const upsertMany = pairsWithoutNull.map(([key, value], index) => {
                        const prev = values[index];
                        const newValue = utils.fastMerge(prev as Record<string, unknown>, value as Record<string, unknown>, {
                            shouldRemoveNestedNulls: true,
                            objectRemovalMode: 'replace',
                        }).result;

                        return IDB.promisifyRequest(store.put(newValue, key));
                    });
                    return Promise.all(upsertMany);
                });
            })
            .then(() => undefined);
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
            pairs.forEach(([key, value]) => {
                if (value === null) {
                    store.delete(key);
                } else {
                    store.put(value, key);
                }
            });

            return IDB.promisifyRequest(store.transaction);
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

        return IDB.del(key, provider.store);
    },
    removeItems(keysParam) {
        if (!provider.store) {
            throw new Error('Store not initialized!');
        }

        return IDB.delMany(keysParam, provider.store);
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
            }))
            .catch((error) => {
                throw new Error(`Unable to estimate web storage quota. Original error: ${error}`);
            });
    },
};

export default provider;
