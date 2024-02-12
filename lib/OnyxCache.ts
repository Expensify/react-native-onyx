import {deepEqual} from 'fast-equals';
import bindAll from 'lodash/bindAll';
import type {Key, Value} from './storage/providers/types';
import utils from './utils';

type StorageMap = Record<Key, Value>;

/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
class OnyxCache {
    /** Cache of all the storage keys available in persistent storage */
    private storageKeys: Set<Key>;

    /** Unique list of keys maintained in access order (most recent at the end) */
    private recentKeys: Set<Key>;

    /** A map of cached values */
    private storageMap: StorageMap;

    /**
     * Captured pending tasks for already running storage methods
     * Using a map yields better performance on operations such a delete
     */
    private pendingPromises: Map<string, Promise<unknown>>;

    private maxRecentKeysSize = 0;

    constructor() {
        this.storageKeys = new Set();
        this.recentKeys = new Set();
        this.storageMap = {};
        this.pendingPromises = new Map();

        bindAll(
            this,
            'getAllKeys',
            'getValue',
            'hasCacheForKey',
            'addKey',
            'set',
            'drop',
            'merge',
            'hasPendingTask',
            'getTaskPromise',
            'captureTask',
            'removeLeastRecentlyUsedKeys',
            'setRecentKeysLimit',
        );
    }

    getAllKeys(): Key[] {
        return Array.from(this.storageKeys);
    }

    getValue(key: Key, shouldReindexCache = true): Value {
        if (shouldReindexCache) {
            this.addToAccessedKeys(key);
        }
        return this.storageMap[key];
    }

    hasCacheForKey(key: Key): boolean {
        return this.storageMap[key] !== undefined;
    }

    addKey(key: Key): void {
        this.storageKeys.add(key);
    }

    set(key: Key, value: Value): Value {
        this.addKey(key);
        this.addToAccessedKeys(key);
        this.storageMap[key] = value;

        return value;
    }

    drop(key: Key): void {
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

    private addToAccessedKeys(key: Key): void {
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

    hasValueChanged(key: Key, value: Value): boolean {
        return !deepEqual(this.storageMap[key], value);
    }
}

const instance = new OnyxCache();

export default instance;
