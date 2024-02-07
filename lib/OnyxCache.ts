import {deepEqual} from 'fast-equals';
import utils from './utils';

type StorageMap = Record<string, unknown>;

/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
class OnyxCache {
    private storageKeys: Set<string>;

    private recentKeys: Set<string>;

    private storageMap: StorageMap;

    private pendingPromises: Map<string, Promise<unknown>>;

    private maxRecentKeysSize = 0;

    constructor() {
        this.storageKeys = new Set();
        this.recentKeys = new Set();
        this.storageMap = {};
        this.pendingPromises = new Map();
    }

    getAllKeys(): string[] {
        return Array.from(this.storageKeys);
    }

    getValue(key: string, shouldReindexCache = true): unknown {
        if (shouldReindexCache) {
            this.addToAccessedKeys(key);
        }
        return this.storageMap[key];
    }

    hasCacheForKey(key: string): boolean {
        return this.storageMap[key] !== undefined;
    }

    addKey(key: string): void {
        this.storageKeys.add(key);
    }

    set(key: string, value: unknown): unknown {
        this.addKey(key);
        this.addToAccessedKeys(key);
        this.storageMap[key] = value;

        return value;
    }

    drop(key: string): void {
        delete this.storageMap[key];
        this.storageKeys.delete(key);
        this.recentKeys.delete(key);
    }

    merge(data: StorageMap): void {
        if (typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('data passed to cache.merge() must be an Object of onyx key/value pairs');
        }

        this.storageMap = {...utils.fastMerge(this.storageMap, data, false)};

        const storageKeys = this.getAllKeys();
        const mergedKeys = Object.keys(data);
        this.storageKeys = new Set([...storageKeys, ...mergedKeys]);
        mergedKeys.forEach((key) => this.addToAccessedKeys(key));
    }

    hasPendingTask(taskName: string): boolean {
        return this.pendingPromises.get(taskName) !== undefined;
    }

    getTaskPromise(taskName: string): Promise<unknown> | undefined {
        return this.pendingPromises.get(taskName);
    }

    captureTask(taskName: string, promise: Promise<unknown>): Promise<unknown> {
        const returnPromise = promise.finally(() => {
            this.pendingPromises.delete(taskName);
        });

        this.pendingPromises.set(taskName, returnPromise);

        return returnPromise;
    }

    private addToAccessedKeys(key: string): void {
        this.recentKeys.delete(key);
        this.recentKeys.add(key);
    }

    removeLeastRecentlyUsedKeys(): void {
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

    setRecentKeysLimit(limit: number): void {
        this.maxRecentKeysSize = limit;
    }

    hasValueChanged(key: string, value: unknown): boolean {
        return !deepEqual(this.storageMap[key], value);
    }
}

const instance = new OnyxCache();

export default instance;
