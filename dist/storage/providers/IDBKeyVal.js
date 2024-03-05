"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const idb_keyval_1 = require("idb-keyval");
const utils_1 = __importDefault(require("../../utils"));
// We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
// which might not be available in certain environments that load the bundle (e.g. electron main process).
let customStoreInstance;
function getCustomStore() {
    if (!customStoreInstance) {
        customStoreInstance = (0, idb_keyval_1.createStore)('OnyxDB', 'keyvaluepairs');
    }
    return customStoreInstance;
}
const provider = {
    setItem: (key, value) => (0, idb_keyval_1.set)(key, value, getCustomStore()),
    multiGet: (keysParam) => (0, idb_keyval_1.getMany)(keysParam, getCustomStore()).then((values) => values.map((value, index) => [keysParam[index], value])),
    multiMerge: (pairs) => getCustomStore()('readwrite', (store) => {
        // Note: we are using the manual store transaction here, to fit the read and update
        // of the items in one transaction to achieve best performance.
        const getValues = Promise.all(pairs.map(([key]) => (0, idb_keyval_1.promisifyRequest)(store.get(key))));
        return getValues.then((values) => {
            const upsertMany = pairs.map(([key, value], index) => {
                const prev = values[index];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const newValue = utils_1.default.fastMerge(prev, value);
                return (0, idb_keyval_1.promisifyRequest)(store.put(newValue, key));
            });
            return Promise.all(upsertMany);
        });
    }),
    mergeItem(key, _changes, modifiedData) {
        // Since Onyx also merged the existing value with the changes, we can just set the value directly
        return provider.setItem(key, modifiedData);
    },
    multiSet: (pairs) => (0, idb_keyval_1.setMany)(pairs, getCustomStore()),
    clear: () => (0, idb_keyval_1.clear)(getCustomStore()),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setMemoryOnlyKeys: () => { },
    getAllKeys: () => (0, idb_keyval_1.keys)(getCustomStore()),
    getItem: (key) => (0, idb_keyval_1.get)(key, getCustomStore())
        // idb-keyval returns undefined for missing items, but this needs to return null so that idb-keyval does the same thing as SQLiteStorage.
        .then((val) => (val === undefined ? null : val)),
    removeItem: (key) => (0, idb_keyval_1.del)(key, getCustomStore()),
    removeItems: (keysParam) => (0, idb_keyval_1.delMany)(keysParam, getCustomStore()),
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
