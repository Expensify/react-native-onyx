"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Logger = __importStar(require("../Logger"));
const platforms_1 = __importDefault(require("./platforms"));
const InstanceSync_1 = __importDefault(require("./InstanceSync"));
const MemoryOnlyProvider_1 = __importDefault(require("./providers/MemoryOnlyProvider"));
let provider = platforms_1.default;
let shouldKeepInstancesSync = false;
let finishInitalization;
const initPromise = new Promise((resolve) => {
    finishInitalization = resolve;
});
/**
 * Degrade performance by removing the storage provider and only using cache
 */
function degradePerformance(error) {
    Logger.logHmmm(`Error while using ${provider.name}. Falling back to only using cache and dropping storage.\n Error: ${error.message}\n Stack: ${error.stack}\n Cause: ${error.cause}`);
    console.error(error);
    provider = MemoryOnlyProvider_1.default;
}
/**
 * Runs a piece of code and degrades performance if certain errors are thrown
 */
function tryOrDegradePerformance(fn, waitForInitialization = true) {
    return new Promise((resolve, reject) => {
        const promise = waitForInitialization ? initPromise : Promise.resolve();
        promise.then(() => {
            try {
                resolve(fn());
            }
            catch (error) {
                // Test for known critical errors that the storage provider throws, e.g. when storage is full
                if (error instanceof Error) {
                    // IndexedDB error when storage is full (https://github.com/Expensify/App/issues/29403)
                    if (error.message.includes('Internal error opening backing store for indexedDB.open')) {
                        degradePerformance(error);
                    }
                    // catch the error if DB connection can not be established/DB can not be created
                    if (error.message.includes('IDBKeyVal store could not be created')) {
                        degradePerformance(error);
                    }
                }
                reject(error);
            }
        });
    });
}
const Storage = {
    /**
     * Returns the storage provider currently in use
     */
    getStorageProvider() {
        return provider;
    },
    /**
     * Initializes all providers in the list of storage providers
     * and enables fallback providers if necessary
     */
    init() {
        tryOrDegradePerformance(provider.init, false).finally(() => {
            finishInitalization();
        });
    },
    /**
     * Get the value of a given key or return `null` if it's not available
     */
    getItem: (key) => tryOrDegradePerformance(() => provider.getItem(key)),
    /**
     * Get multiple key-value pairs for the give array of keys in a batch
     */
    multiGet: (keys) => tryOrDegradePerformance(() => provider.multiGet(keys)),
    /**
     * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
     */
    setItem: (key, value) => tryOrDegradePerformance(() => {
        const promise = provider.setItem(key, value);
        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync_1.default.setItem(key));
        }
        return promise;
    }),
    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet: (pairs) => tryOrDegradePerformance(() => {
        const promise = provider.multiSet(pairs);
        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync_1.default.multiSet(pairs.map((pair) => pair[0])));
        }
        return promise;
    }),
    /**
     * Merging an existing value with a new one
     */
    mergeItem: (key, deltaChanges, preMergedValue, shouldSetValue = false) => tryOrDegradePerformance(() => {
        const promise = provider.mergeItem(key, deltaChanges, preMergedValue, shouldSetValue);
        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync_1.default.mergeItem(key));
        }
        return promise;
    }),
    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge: (pairs) => tryOrDegradePerformance(() => {
        const promise = provider.multiMerge(pairs);
        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync_1.default.multiMerge(pairs.map((pair) => pair[0])));
        }
        return promise;
    }),
    /**
     * Removes given key and its value
     */
    removeItem: (key) => tryOrDegradePerformance(() => {
        const promise = provider.removeItem(key);
        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync_1.default.removeItem(key));
        }
        return promise;
    }),
    /**
     * Remove given keys and their values
     */
    removeItems: (keys) => tryOrDegradePerformance(() => {
        const promise = provider.removeItems(keys);
        if (shouldKeepInstancesSync) {
            return promise.then(() => InstanceSync_1.default.removeItems(keys));
        }
        return promise;
    }),
    /**
     * Clears everything
     */
    clear: () => tryOrDegradePerformance(() => {
        if (shouldKeepInstancesSync) {
            return InstanceSync_1.default.clear(() => provider.clear());
        }
        return provider.clear();
    }),
    /**
     * Returns all available keys
     */
    getAllKeys: () => tryOrDegradePerformance(() => provider.getAllKeys()),
    /**
     * Gets the total bytes of the store
     */
    getDatabaseSize: () => tryOrDegradePerformance(() => provider.getDatabaseSize()),
    /**
     * @param onStorageKeyChanged - Storage synchronization mechanism keeping all opened tabs in sync (web only)
     */
    keepInstancesSync(onStorageKeyChanged) {
        // If InstanceSync shouldn't be used, it means we're on a native platform and we don't need to keep instances in sync
        if (!InstanceSync_1.default.shouldBeUsed)
            return;
        shouldKeepInstancesSync = true;
        InstanceSync_1.default.init(onStorageKeyChanged, this);
    },
};
exports.default = Storage;
