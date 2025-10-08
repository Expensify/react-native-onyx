import type {UseStore} from 'idb-keyval';
import {set, keys, getMany, setMany, get, clear, del, delMany, promisifyRequest} from 'idb-keyval';
import utils from '../../../utils';
import type StorageProvider from '../types';
import type {OnyxKey, OnyxValue} from '../../../types';
import createStore from './createStore';
import * as GlobalSettings from '../../../GlobalSettings';
import decorateWithMetrics from '../../../metrics';

// We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
// which might not be available in certain environments that load the bundle (e.g. electron main process).
let idbKeyValStore: UseStore;
const DB_NAME = 'OnyxDB';
const STORE_NAME = 'keyvaluepairs';

const provider: StorageProvider = {
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

        idbKeyValStore = newIdbKeyValStore;
    },

    setItem: (key, value) => {
        if (value === null) {
            provider.removeItem(key);
        }

        return set(key, value, idbKeyValStore);
    },
    multiGet: (keysParam) => getMany(keysParam, idbKeyValStore).then((values) => values.map((value, index) => [keysParam[index], value])),
    multiMerge: (pairs) =>
        idbKeyValStore('readwrite', (store) => {
            // Note: we are using the manual store transaction here, to fit the read and update
            // of the items in one transaction to achieve best performance.
            const getValues = Promise.all(pairs.map(([key]) => promisifyRequest<OnyxValue<OnyxKey>>(store.get(key))));

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

                    return promisifyRequest(store.put(newValue, key));
                });
                return Promise.all(upsertMany).then(() => undefined);
            });
        }),
    mergeItem(key, change) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly.
        return provider.multiMerge([[key, change]]);
    },
    multiSet: (pairs) => {
        const pairsWithoutNull = pairs.filter(([key, value]) => {
            if (value === null) {
                provider.removeItem(key);
                return false;
            }

            return true;
        }) as Array<[IDBValidKey, unknown]>;

        return setMany(pairsWithoutNull, idbKeyValStore);
    },
    clear: () => clear(idbKeyValStore),
    getAllKeys: () => keys(idbKeyValStore),
    getItem: (key) =>
        get(key, idbKeyValStore)
            // idb-keyval returns undefined for missing items, but this needs to return null so that idb-keyval does the same thing as SQLiteStorage.
            .then((val) => (val === undefined ? null : val)),
    removeItem: (key) => del(key, idbKeyValStore),
    removeItems: (keysParam) => delMany(keysParam, idbKeyValStore),
    getDatabaseSize() {
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

GlobalSettings.addGlobalSettingsChangeListener(({enablePerformanceMetrics}) => {
    if (!enablePerformanceMetrics) {
        return;
    }

    // Apply decorators
    provider.getItem = decorateWithMetrics(provider.getItem, 'IDBKeyValProvider.getItem');
    provider.multiGet = decorateWithMetrics(provider.multiGet, 'IDBKeyValProvider.multiGet');
    provider.setItem = decorateWithMetrics(provider.setItem, 'IDBKeyValProvider.setItem');
    provider.multiSet = decorateWithMetrics(provider.multiSet, 'IDBKeyValProvider.multiSet');
    provider.mergeItem = decorateWithMetrics(provider.mergeItem, 'IDBKeyValProvider.mergeItem');
    provider.multiMerge = decorateWithMetrics(provider.multiMerge, 'IDBKeyValProvider.multiMerge');
    provider.removeItem = decorateWithMetrics(provider.removeItem, 'IDBKeyValProvider.removeItem');
    provider.removeItems = decorateWithMetrics(provider.removeItems, 'IDBKeyValProvider.removeItems');
    provider.clear = decorateWithMetrics(provider.clear, 'IDBKeyValProvider.clear');
    provider.getAllKeys = decorateWithMetrics(provider.getAllKeys, 'IDBKeyValProvider.getAllKeys');
});

export default provider;
