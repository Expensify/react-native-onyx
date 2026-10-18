import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';

import * as Logger from './Logger';
import cache from './OnyxCache';
import OnyxKeys from './OnyxKeys';
import Storage from './storage';

/**
 * Listener fired when an exact key's value changes.
 */
type Listener<TKey extends OnyxKey = OnyxKey> = (value: OnyxValue<TKey>, key: TKey) => void;

/**
 * Generic listener, without specific types for the keys or values.
 * This way a single Map can hold listeners for every key type.
 */
type GenericListener = (value: unknown, key: OnyxKey) => void;

/**
 * A collection's notifications held during a batch. `previous` keeps a member's value from before the batch,
 * so delivery can skip member subscribers whose value ended up unchanged. A member held without a previous
 * value always notifies.
 */
type HeldCollection = {
    members: Set<OnyxKey>;
    previous: Record<OnyxKey, unknown>;
};

const reportedCacheMisses = new Set<OnyxKey>();

function reportCacheMissIfStorageHasValue(key: OnyxKey): void {
    if (OnyxKeys.isRamOnlyKey(key) || !cache.getAllKeys().has(key) || cache.hasNullishStorageKey(key)) {
        return;
    }

    const reportKey = OnyxKeys.getCollectionKey(key) ?? key;
    if (reportedCacheMisses.has(reportKey)) {
        return;
    }
    reportedCacheMisses.add(reportKey);

    Storage.getItem(key)
        .then((value) => {
            if (value === undefined || value === null) {
                return;
            }

            Logger.logHmmm(`Cache held no value for a key storage still has: ${reportKey}`);
        })
        .catch((error: unknown) => {
            Logger.logInfo(`Could not check storage for a suspected cache miss on ${reportKey}. Error: ${String(error)}`);
        });
}

/**
 * OnyxSubscriptionManager is a registry for Onyx subscriptions.
 * Subscriptions are stored in `keyListeners`, a flat map keyed by OnyxKey.
 * Subscribers are notified on a per-key basis:
 *    - `notifyKey` for individual keys or collection members
 *    - `notifyCollection` for batch updates to collections
 */
class OnyxSubscriptionManager {
    private keyListeners: Map<OnyxKey, Set<GenericListener>>;

    private batchDepth = 0;

    private heldKeys = new Set<OnyxKey>();

    private heldCollections = new Map<CollectionKeyBase, HeldCollection>();

    constructor() {
        this.keyListeners = new Map();
    }

    /**
     * Returns the frozen collection object for collection
     * keys, the cached value for single keys, or `undefined` if not in cache.
     */
    getState<TKey extends OnyxKey>(key: TKey): OnyxValue<TKey> {
        if (OnyxKeys.isCollectionKey(key)) {
            return cache.getCollectionData(key) as OnyxValue<TKey>;
        }

        const value = cache.get(key) as OnyxValue<TKey>;
        if (value === undefined) {
            reportCacheMissIfStorageHasValue(key);
        }

        return value;
    }

    /**
     * Subscribe to an exact key. For a collection root key this is "collection mode": the
     * listener fires with the frozen collection object whenever any member changes. For a
     * collection member key or a regular key, the listener fires when that key's value changes.
     *
     * Returns an unsubscribe function.
     */
    subscribe<TKey extends OnyxKey>(key: TKey, listener: Listener<TKey>): () => void {
        let listeners = this.keyListeners.get(key);
        if (!listeners) {
            listeners = new Set();
            this.keyListeners.set(key, listeners);
        }

        listeners.add(listener as GenericListener);

        return () => {
            const set = this.keyListeners.get(key);
            if (!set) {
                return;
            }

            set.delete(listener as GenericListener);

            if (set.size === 0) {
                this.keyListeners.delete(key);
            }
        };
    }

    /**
     * Notify of a single-key write.
     *
     * Dispatch:
     *   1. keyListeners.get(key): exact-key subscribers (always fires).
     *   2. If key is a collection member, keyListeners.get(collectionKey): collection
     *      listeners for the parent collection.
     */
    notifyKey<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>): void {
        if (this.batchDepth === 0) {
            this.dispatchKey(key, value);
            return;
        }

        // A member write is held with its collection, so the collection's subscribers fire once for the batch.
        const collectionKey = OnyxKeys.getCollectionKey(key);
        if (collectionKey !== undefined && collectionKey !== key) {
            this.getHeldCollection(collectionKey).members.add(key);
            return;
        }
        this.heldKeys.add(key);
    }

    /**
     * Notify of a collection-level batch update.
     *
     * Dispatch:
     *   1. keyListeners.get(collectionKey): fires once with the new collection object.
     *   2. keyListeners.get(memberKey): fires per changed member whose value differs from
     *      the previous, preserving ref-equality on unchanged members.
     */
    notifyCollection<TKey extends CollectionKeyBase>(
        collectionKey: TKey,
        partialCollection: OnyxCollection<KeyValueMapping[TKey]>,
        partialPreviousCollection?: OnyxCollection<KeyValueMapping[TKey]>,
    ): void {
        if (this.batchDepth === 0) {
            this.dispatchCollection(collectionKey, partialCollection, partialPreviousCollection);
            return;
        }

        const heldCollection = this.getHeldCollection(collectionKey);
        for (const memberKey of Object.keys(partialCollection ?? {})) {
            if (heldCollection.members.has(memberKey)) {
                continue;
            }
            heldCollection.members.add(memberKey);
            if (partialPreviousCollection && Object.prototype.hasOwnProperty.call(partialPreviousCollection, memberKey)) {
                heldCollection.previous[memberKey] = partialPreviousCollection[memberKey];
            }
        }
    }

    /**
     * Runs `applyWrites` with notifications held back, then notifies every key it wrote, so no subscriber
     * sees the cache with only part of the writes applied. `applyWrites` must write the cache synchronously;
     * notifications from writes that settle later are delivered when they happen.
     *
     * Held notifications read the cache when they are delivered, so a subscriber that writes to another key of
     * the batch while being notified does not get overwritten by that key's older value.
     */
    batch<T>(applyWrites: () => T): T {
        this.batchDepth++;
        try {
            return applyWrites();
        } finally {
            this.batchDepth--;
            if (this.batchDepth === 0) {
                this.deliverHeldNotifications();
            }
        }
    }

    private dispatchKey<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>): void {
        // 1. Exact-key listeners
        const exact = this.keyListeners.get(key);
        if (exact && exact.size > 0) {
            for (const listener of [...exact]) {
                this.safeInvoke(() => listener(value, key), key);
            }
        }

        // 2. Collection-level routing. Only fires when the write is to a member key.
        // Direct writes to a collection root (e.g. `Onyx.merge(COLLECTION_KEY, ...)`) are an
        // unsupported anti-pattern; treat them as opaque single-key writes.
        const collectionKey = OnyxKeys.getCollectionKey(key);
        const isCollectionMemberWrite = collectionKey !== undefined && collectionKey !== key;
        if (isCollectionMemberWrite) {
            const collectionListeners = this.keyListeners.get(collectionKey);
            if (collectionListeners && collectionListeners.size > 0) {
                const collectionData = cache.getCollectionData(collectionKey);
                for (const listener of [...collectionListeners]) {
                    this.safeInvoke(() => listener(collectionData, collectionKey), collectionKey);
                }
            }
        }
    }

    private dispatchCollection<TKey extends CollectionKeyBase>(
        collectionKey: TKey,
        partialCollection: OnyxCollection<KeyValueMapping[TKey]>,
        partialPreviousCollection?: OnyxCollection<KeyValueMapping[TKey]>,
    ): void {
        const changedKeys = Object.keys(partialCollection ?? {});
        if (changedKeys.length === 0) {
            return;
        }
        // Read the merged collection once. `cache.getCollectionData()` returns the post-merge
        // frozen object, which is what listeners should see (not the raw `partialCollection`
        // input, which is just the delta and lacks fields preserved during merge).
        const collectionData = cache.getCollectionData(collectionKey);

        // 1. Collection listeners fire once with the new collection object.
        const collectionListeners = this.keyListeners.get(collectionKey);
        if (collectionListeners && collectionListeners.size > 0) {
            for (const listener of [...collectionListeners]) {
                this.safeInvoke(() => listener(collectionData, collectionKey), collectionKey);
            }
        }

        // 2. Exact-member subscribers fire per changed key (skip if ref unchanged vs previous).
        // Only treat a member as unchanged when `previous` actually carries it: when the
        // previous collection is omitted, a removed member reads `undefined` on both sides
        // and would otherwise be skipped even though it changed.
        for (const memberKey of changedKeys) {
            const value = collectionData?.[memberKey];
            const prev = partialPreviousCollection?.[memberKey];
            if (partialPreviousCollection && Object.prototype.hasOwnProperty.call(partialPreviousCollection, memberKey) && value === prev) {
                continue;
            }

            const exact = this.keyListeners.get(memberKey);
            if (!exact || exact.size === 0) {
                continue;
            }

            for (const listener of [...exact]) {
                this.safeInvoke(() => listener(value, memberKey), memberKey);
            }
        }
    }

    /**
     * Wipe all subscriptions. Used by tests and `Onyx.clear()` follow-on.
     */
    clearAll(): void {
        this.keyListeners.clear();
        this.heldKeys.clear();
        this.heldCollections.clear();
        this.resetCacheMissReports();
    }

    resetCacheMissReports(): void {
        reportedCacheMisses.clear();
    }

    /**
     * True if there are any subscribers for the given key (exact or parent collection).
     */
    hasListenersForKey(key: OnyxKey): boolean {
        if ((this.keyListeners.get(key)?.size ?? 0) > 0) {
            return true;
        }

        const collectionKey = OnyxKeys.getCollectionKey(key);
        if (collectionKey && collectionKey !== key && (this.keyListeners.get(collectionKey)?.size ?? 0) > 0) {
            return true;
        }

        return false;
    }

    private getHeldCollection(collectionKey: CollectionKeyBase): HeldCollection {
        let heldCollection = this.heldCollections.get(collectionKey);
        if (!heldCollection) {
            heldCollection = {members: new Set(), previous: {}};
            this.heldCollections.set(collectionKey, heldCollection);
        }
        return heldCollection;
    }

    private deliverHeldNotifications(): void {
        // Snapshot and reset first, so writes made by listeners during delivery notify on their own.
        const heldKeys = [...this.heldKeys];
        const heldCollections = [...this.heldCollections];
        this.heldKeys.clear();
        this.heldCollections.clear();

        for (const key of heldKeys) {
            this.dispatchKey(key, cache.get(key));
        }
        for (const [collectionKey, {members, previous}] of heldCollections) {
            const partialCollection = Object.fromEntries([...members].map((memberKey) => [memberKey, cache.get(memberKey)]));
            this.dispatchCollection(collectionKey, partialCollection, previous as OnyxCollection<KeyValueMapping[CollectionKeyBase]>);
        }
    }

    /**
     * Runs a listener, catching and logging any throw so one failing listener can't stop the rest.
     */
    private safeInvoke(fn: () => void, contextKey: OnyxKey): void {
        try {
            fn();
        } catch (error) {
            Logger.logAlert(`[OnyxSubscriptionManager] Listener threw an error for key '${contextKey}': ${error}`);
        }
    }
}

const onyxSubscriptionManager = new OnyxSubscriptionManager();

export default onyxSubscriptionManager;
export type {Listener};
