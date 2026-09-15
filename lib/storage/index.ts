import * as Logger from '../Logger';

import PlatformStorage from './platforms';
import InstanceSync from './InstanceSync';
import MemoryOnlyProvider from './providers/MemoryOnlyProvider';
import {StorageErrorClass} from './errors';
import type StorageProvider from './providers/types';

let provider = PlatformStorage as StorageProvider<unknown>;

/**
 * The platform provider's classifier, kept separate from `provider` on purpose.
 *
 * `degradePerformance` swaps `provider` for `MemoryOnlyProvider`, whose classifier returns UNKNOWN for
 * everything. Classifying through `provider` would therefore erase the class of the very error that
 * caused the degrade, because the swap happens before the rejection reaches `OnyxUtils.retryOperation`.
 * Holding the original classifier keeps that error classifiable for its whole trip up the stack.
 */
const classifyStorageError = provider.classifyError;

let shouldKeepInstancesSync = false;
let finishInitalization: (value?: unknown) => void;
const initPromise = new Promise((resolve) => {
    finishInitalization = resolve;
});

type Storage = {
    getStorageProvider: () => StorageProvider<unknown>;
} & Omit<StorageProvider<unknown>, 'name' | 'store'>;

/**
 * Degrade performance by removing the storage provider and only using cache
 */
function degradePerformance(error: Error) {
    let causeMessage = '';
    if (error.cause instanceof Error) {
        causeMessage = error.cause.message;
    } else if (typeof error.cause === 'string') {
        causeMessage = error.cause;
    }
    Logger.logHmmm(`Error while using ${provider.name}. Falling back to only using cache and dropping storage.\n Error: ${error.message}\n Stack: ${error.stack}\n Cause: ${causeMessage}`);
    console.error(error);
    provider = MemoryOnlyProvider;
}

/**
 * Whether an error means the storage engine itself is unusable, which is what justifies dropping it.
 */
function shouldDegradeOn(error: unknown): error is Error {
    // catch the error if DB connection can not be established/DB can not be created
    return error instanceof Error && (error.message.includes('IDBKeyVal store could not be created') || classifyStorageError(error) === StorageErrorClass.UNAVAILABLE);
}

/**
 * Runs a piece of code and degrades performance if certain errors are thrown
 */
function tryOrDegradePerformance<T>(fn: () => Promise<T> | T, waitForInitialization = true): Promise<T> {
    const initialization = waitForInitialization ? initPromise : Promise.resolve();
    return initialization
        .then(() => fn())
        .catch((error: unknown) => {
            if (shouldDegradeOn(error)) {
                degradePerformance(error);
            }
            return Promise.reject(error);
        });
}

const storage: Storage = {
    /**
     * Returns the storage provider currently in use
     */
    getStorageProvider() {
        return provider;
    },

    /**
     * Classifies a write error using the platform provider's own classifier. Synchronous and pure —
     * never wrapped in tryOrDegradePerformance.
     */
    classifyError: (error) => classifyStorageError(error),

    /**
     * Initializes all providers in the list of storage providers
     * and enables fallback providers if necessary
     *
     * The result is consumed here rather than dropped: `tryOrDegradePerformance` re-rejects on purpose so
     * that the caller of a storage method sees its own failure, but nobody awaits `init`. Leaving that
     * rejection unconsumed would report an unhandled rejection — and fire the app's global rejection
     * handler — on every session where the engine is missing and the degrade to memory-only succeeded.
     */
    init() {
        tryOrDegradePerformance(provider.init, false).then(finishInitalization, (error: unknown) => {
            finishInitalization();
            // A degrade already logged itself. Anything else left no usable storage provider, so it
            // stays visible — but as a log, not as an unhandled rejection.
            if (!shouldDegradeOn(error)) {
                Logger.logAlert(`Storage initialization failed. Original error: ${error instanceof Error ? error.message : String(error)}`);
            }
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
    setItem: (key, value) =>
        tryOrDegradePerformance(() => {
            const promise = provider.setItem(key, value);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.setItem(key));
            }

            return promise;
        }),

    /**
     * Stores multiple key-value pairs in a batch
     */
    multiSet: (pairs) =>
        tryOrDegradePerformance(() => {
            const promise = provider.multiSet(pairs);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.multiSet(pairs.map((pair) => pair[0])));
            }

            return promise;
        }),

    /**
     * Merging an existing value with a new one
     */
    mergeItem: (key, change, replaceNullPatches) =>
        tryOrDegradePerformance(() => {
            const promise = provider.mergeItem(key, change, replaceNullPatches);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.mergeItem(key));
            }

            return promise;
        }),

    /**
     * Multiple merging of existing and new values in a batch
     * This function also removes all nested null values from an object.
     */
    multiMerge: (pairs) =>
        tryOrDegradePerformance(() => {
            const promise = provider.multiMerge(pairs);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.multiMerge(pairs.map((pair) => pair[0])));
            }

            return promise;
        }),

    /**
     * Removes given key and its value
     */
    removeItem: (key) =>
        tryOrDegradePerformance(() => {
            const promise = provider.removeItem(key);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItem(key));
            }

            return promise;
        }),

    /**
     * Remove given keys and their values
     */
    removeItems: (keys) =>
        tryOrDegradePerformance(() => {
            const promise = provider.removeItems(keys);

            if (shouldKeepInstancesSync) {
                return promise.then(() => InstanceSync.removeItems(keys));
            }

            return promise;
        }),

    /**
     * Clears everything
     */
    clear: () =>
        tryOrDegradePerformance(() => {
            if (shouldKeepInstancesSync) {
                return InstanceSync.clear(() => provider.clear());
            }

            return provider.clear();
        }),

    /**
     * Returns all available keys
     */
    getAllKeys: () => tryOrDegradePerformance(() => provider.getAllKeys()),

    /**
     * Returns all key-value pairs from storage in a single batch operation
     */
    getAll: () => tryOrDegradePerformance(() => provider.getAll()),

    /**
     * Gets the total bytes of the store
     */
    getDatabaseSize: () => tryOrDegradePerformance(() => provider.getDatabaseSize()),

    /**
     * @param onStorageKeysChanged - Storage synchronization mechanism keeping all opened tabs in sync (web only)
     */
    keepInstancesSync(onStorageKeysChanged) {
        // If InstanceSync shouldn't be used, it means we're on a native platform and we don't need to keep instances in sync
        if (!InstanceSync.shouldBeUsed) return;

        shouldKeepInstancesSync = true;
        InstanceSync.init(onStorageKeysChanged, this);
    },
};

export default storage;
