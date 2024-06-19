"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMockStore = exports.mockSet = exports.mockStore = void 0;
const underscore_1 = __importDefault(require("underscore"));
const utils_1 = __importDefault(require("../../utils"));
// eslint-disable-next-line import/no-mutable-exports
let store = {};
exports.mockStore = store;
const setInternal = (key, value) => {
    store[key] = value;
    return Promise.resolve(value);
};
const isJestRunning = typeof jest !== 'undefined';
const set = isJestRunning ? jest.fn(setInternal) : setInternal;
exports.mockSet = set;
const provider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'MemoryOnlyProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        // do nothing
    },
    /**
     * Get the value of a given key or return `null` if it's not available in memory
     */
    getItem(key) {
        const value = store[key];
        return Promise.resolve(value === undefined ? null : value);
    },
    /**
     * Get multiple key-value pairs for the give array of keys in a batch.
     */
    multiGet(keys) {
        const getPromises = underscore_1.default.map(keys, (key) => new Promise((resolve) => {
            this.getItem(key).then((value) => resolve([key, value]));
        }));
        return Promise.all(getPromises);
    },
    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem(key, value) {
        set(key, value);
        return Promise.resolve();
    },
    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet(pairs) {
        const setPromises = underscore_1.default.map(pairs, ([key, value]) => this.setItem(key, value));
        return Promise.all(setPromises).then(() => undefined);
    },
    /**
     * Merging an existing value with a new one
     */
    mergeItem(key, _deltaChanges, preMergedValue) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly
        return this.setItem(key, preMergedValue);
    },
    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge(pairs) {
        underscore_1.default.forEach(pairs, ([key, value]) => {
            const existingValue = store[key];
            const newValue = utils_1.default.fastMerge(existingValue, value);
            set(key, newValue);
        });
        return Promise.resolve([]);
    },
    /**
     * Remove given key and it's value from memory
     */
    removeItem(key) {
        delete store[key];
        return Promise.resolve();
    },
    /**
     * Remove given keys and their values from memory
     */
    removeItems(keys) {
        underscore_1.default.each(keys, (key) => {
            delete store[key];
        });
        return Promise.resolve();
    },
    /**
     * Clear everything from memory
     */
    clear() {
        exports.mockStore = store = {};
        return Promise.resolve();
    },
    /**
     * Returns all keys available in memory
     */
    getAllKeys() {
        return Promise.resolve(underscore_1.default.keys(store));
    },
    /**
     * Gets the total bytes of the store.
     * `bytesRemaining` will always be `Number.POSITIVE_INFINITY` since we don't have a hard limit on memory.
     */
    getDatabaseSize() {
        return Promise.resolve({ bytesRemaining: Number.POSITIVE_INFINITY, bytesUsed: 0 });
    },
};
const setMockStore = (data) => {
    exports.mockStore = store = data;
};
exports.setMockStore = setMockStore;
exports.default = provider;
