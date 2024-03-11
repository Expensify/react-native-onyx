import type {UseStore} from 'idb-keyval';
import {set, keys, getMany, setMany, get, clear, del, delMany, createStore, promisifyRequest} from 'idb-keyval';
import utils from '../../utils';
import type StorageProvider from './types';
import type {OnyxValue} from '../../types';

// We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
// which might not be available in certain environments that load the bundle (e.g. electron main process).
let customStoreInstance: UseStore;
function getCustomStore(): UseStore {
    if (!customStoreInstance) {
        customStoreInstance = createStore('OnyxDB', 'keyvaluepairs');
    }
    return customStoreInstance;
}

const provider: StorageProvider = {
    setItem: (key, value) => set(key, value, getCustomStore()),
    multiGet: (keysParam) => getMany(keysParam, getCustomStore()).then((values) => values.map((value, index) => [keysParam[index], value])),
    multiMerge: (pairs) =>
        getCustomStore()('readwrite', (store) => {
            // Note: we are using the manual store transaction here, to fit the read and update
            // of the items in one transaction to achieve best performance.
            const getValues = Promise.all(pairs.map(([key]) => promisifyRequest<OnyxValue>(store.get(key))));

            return getValues.then((values) => {
                const upsertMany = pairs.map(([key, value], index) => {
                    const prev = values[index];
                    const newValue = utils.fastMerge(prev!, value!);
                    return promisifyRequest(store.put(newValue, key));
                });
                return Promise.all(upsertMany);
            });
        }),
    mergeItem(key, _changes, modifiedData) {
        // Since Onyx also merged the existing value with the changes, we can just set the value directly
        return provider.setItem(key, modifiedData);
    },
    multiSet: (pairs) => setMany(pairs, getCustomStore()),
    clear: () => clear(getCustomStore()),
    getAllKeys: () => keys(getCustomStore()),
    getItem: (key) =>
        get(key, getCustomStore())
            // idb-keyval returns undefined for missing items, but this needs to return null so that idb-keyval does the same thing as SQLiteStorage.
            .then((val) => (val === undefined ? null : val)),
    removeItem: (key) => del(key, getCustomStore()),
    removeItems: (keysParam) => delMany(keysParam, getCustomStore()),
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

export default provider;
