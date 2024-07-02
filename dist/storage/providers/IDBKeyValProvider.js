"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const idb_keyval_1 = require("idb-keyval");
const utils_1 = __importDefault(require("../../utils"));
// We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
// which might not be available in certain environments that load the bundle (e.g. electron main process).
let idbKeyValStore;
const provider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'IDBKeyValProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        const newIdbKeyValStore = (0, idb_keyval_1.createStore)('OnyxDB', 'keyvaluepairs');
        if (newIdbKeyValStore == null)
            throw Error('IDBKeyVal store could not be created');
        idbKeyValStore = newIdbKeyValStore;
    },
    setItem: (key, value) => {
        if (value === null) {
            provider.removeItem(key);
        }
        return (0, idb_keyval_1.set)(key, value, idbKeyValStore);
    },
    multiGet: (keysParam) => (0, idb_keyval_1.getMany)(keysParam, idbKeyValStore).then((values) => values.map((value, index) => [keysParam[index], value])),
    multiMerge: (pairs) => idbKeyValStore('readwrite', (store) => {
        // Note: we are using the manual store transaction here, to fit the read and update
        // of the items in one transaction to achieve best performance.
        const getValues = Promise.all(pairs.map(([key]) => (0, idb_keyval_1.promisifyRequest)(store.get(key))));
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
                const newValue = utils_1.default.fastMerge(prev, value);
                return (0, idb_keyval_1.promisifyRequest)(store.put(newValue, key));
            });
            return Promise.all(upsertMany);
        });
    }),
    mergeItem(key, _deltaChanges, preMergedValue) {
        // Since Onyx also merged the existing value with the changes, we can just set the value directly
        return provider.setItem(key, preMergedValue);
    },
    multiSet: (pairs) => {
        const pairsWithoutNull = pairs.filter(([key, value]) => {
            if (value === null) {
                provider.removeItem(key);
                return false;
            }
            return true;
        });
        return (0, idb_keyval_1.setMany)(pairsWithoutNull, idbKeyValStore);
    },
    clear: () => (0, idb_keyval_1.clear)(idbKeyValStore),
    getAllKeys: () => (0, idb_keyval_1.keys)(idbKeyValStore),
    getItem: (key) => (0, idb_keyval_1.get)(key, idbKeyValStore)
        // idb-keyval returns undefined for missing items, but this needs to return null so that idb-keyval does the same thing as SQLiteStorage.
        .then((val) => (val === undefined ? null : val)),
    removeItem: (key) => (0, idb_keyval_1.del)(key, idbKeyValStore),
    removeItems: (keysParam) => (0, idb_keyval_1.delMany)(keysParam, idbKeyValStore),
    getDatabaseSize() {
        if (!window.navigator || !window.navigator.storage) {
            throw new Error('StorageManager browser API unavailable');
        }
        return window.navigator.storage
            .estimate()
            .then((value) => {
            var _a, _b, _c;
            return ({
                bytesUsed: (_a = value.usage) !== null && _a !== void 0 ? _a : 0,
                bytesRemaining: ((_b = value.quota) !== null && _b !== void 0 ? _b : 0) - ((_c = value.usage) !== null && _c !== void 0 ? _c : 0),
            });
        })
            .catch((error) => {
            throw new Error(`Unable to estimate web storage quota. Original error: ${error}`);
        });
    },
};
exports.default = provider;
