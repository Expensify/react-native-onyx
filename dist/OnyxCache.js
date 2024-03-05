"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fast_equals_1 = require("fast-equals");
const bindAll_1 = __importDefault(require("lodash/bindAll"));
const utils_1 = __importDefault(require("./utils"));
/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
class OnyxCache {
    constructor() {
        /** Maximum size of the keys store din cache */
        this.maxRecentKeysSize = 0;
        this.storageKeys = new Set();
        this.recentKeys = new Set();
        this.storageMap = {};
        this.pendingPromises = new Map();
        // bind all public methods to prevent problems with `this`
        (0, bindAll_1.default)(this, 'getAllKeys', 'getValue', 'hasCacheForKey', 'addKey', 'set', 'drop', 'merge', 'hasPendingTask', 'getTaskPromise', 'captureTask', 'removeLeastRecentlyUsedKeys', 'setRecentKeysLimit');
    }
    /** Get all the storage keys */
    getAllKeys() {
        return Array.from(this.storageKeys);
    }
    /**
     * Get a cached value from storage
     * @param [shouldReindexCache] – This is an LRU cache, and by default accessing a value will make it become last in line to be evicted. This flag can be used to skip that and just access the value directly without side-effects.
     */
    getValue(key, shouldReindexCache = true) {
        if (shouldReindexCache) {
            this.addToAccessedKeys(key);
        }
        return this.storageMap[key];
    }
    /** Check whether cache has data for the given key */
    hasCacheForKey(key) {
        return this.storageMap[key] !== undefined;
    }
    /** Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     */
    addKey(key) {
        this.storageKeys.add(key);
    }
    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     */
    set(key, value) {
        this.addKey(key);
        this.addToAccessedKeys(key);
        this.storageMap[key] = value;
        return value;
    }
    /** Forget the cached value for the given key */
    drop(key) {
        delete this.storageMap[key];
        this.storageKeys.delete(key);
        this.recentKeys.delete(key);
    }
    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param data - a map of (cache) key - values
     */
    merge(data) {
        if (typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('data passed to cache.merge() must be an Object of onyx key/value pairs');
        }
        this.storageMap = Object.assign({}, utils_1.default.fastMerge(this.storageMap, data, false));
        const storageKeys = this.getAllKeys();
        const mergedKeys = Object.keys(data);
        this.storageKeys = new Set([...storageKeys, ...mergedKeys]);
        mergedKeys.forEach((key) => this.addToAccessedKeys(key));
    }
    /**
     * Check whether the given task is already running
     * @param taskName - unique name given for the task
     */
    hasPendingTask(taskName) {
        return this.pendingPromises.get(taskName) !== undefined;
    }
    /**
     * Use this method to prevent concurrent calls for the same thing
     * Instead of calling the same task again use the existing promise
     * provided from this function
     * @param taskName - unique name given for the task
     */
    getTaskPromise(taskName) {
        return this.pendingPromises.get(taskName);
    }
    /**
     * Capture a promise for a given task so other caller can
     * hook up to the promise if it's still pending
     * @param taskName - unique name for the task
     */
    captureTask(taskName, promise) {
        const returnPromise = promise.finally(() => {
            this.pendingPromises.delete(taskName);
        });
        this.pendingPromises.set(taskName, returnPromise);
        return returnPromise;
    }
    /** Adds a key to the top of the recently accessed keys */
    addToAccessedKeys(key) {
        this.recentKeys.delete(key);
        this.recentKeys.add(key);
    }
    /** Remove keys that don't fall into the range of recently used keys */
    removeLeastRecentlyUsedKeys() {
        let numKeysToRemove = this.recentKeys.size - this.maxRecentKeysSize;
        if (numKeysToRemove <= 0) {
            return;
        }
        const iterator = this.recentKeys.values();
        const temp = [];
        while (numKeysToRemove > 0) {
            const value = iterator.next().value;
            temp.push(value);
            numKeysToRemove--;
        }
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < temp.length; ++i) {
            delete this.storageMap[temp[i]];
            this.recentKeys.delete(temp[i]);
        }
    }
    /** Set the recent keys list size */
    setRecentKeysLimit(limit) {
        this.maxRecentKeysSize = limit;
    }
    /** Check if the value has changed */
    hasValueChanged(key, value) {
        return !(0, fast_equals_1.deepEqual)(this.storageMap[key], value);
    }
}
const instance = new OnyxCache();
exports.default = instance;
