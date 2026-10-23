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

/** Listener fired when any of a state listener's declared dependency keys changes. Used by `useOnyxState`. */
type StateListenerCallback = () => void;

type StateListenerEntry = {
    listener: StateListenerCallback;
    deps: Set<OnyxKey>;
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
 * OnyxSubscriptionManager is a registry for Onyx subscriptions, backed by two indexes:
 *    - keyListeners:        exact-key listeners, keyed by OnyxKey (a single key, a collection object,
 *                           or a collection member). Notified via `notifyKey`/`notifyCollection`.
 *    - stateListenersByDep: listeners that re-evaluate when any of their declared dependency keys
 *                           change, indexed by dep key. Used by `useOnyxState`.
 */
class OnyxSubscriptionManager {
    private keyListeners: Map<OnyxKey, Set<GenericListener>>;

    private stateListenersByDep: Map<OnyxKey, Set<StateListenerEntry>>;

    constructor() {
        this.keyListeners = new Map();
        this.stateListenersByDep = new Map();
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
     * Subscribe to state-tree changes. The listener fires when any of the declared dependency keys
     * changes. A collection key counts as a single dep: any member change fires it. Used by `useOnyxState`.
     *
     * Returns an unsubscribe function.
     */
    subscribeState(listener: StateListenerCallback, deps: readonly OnyxKey[]): () => void {
        const entry: StateListenerEntry = {listener, deps: new Set(deps)};
        for (const dep of entry.deps) {
            let set = this.stateListenersByDep.get(dep);
            if (!set) {
                set = new Set();
                this.stateListenersByDep.set(dep, set);
            }
            set.add(entry);
        }

        return () => {
            for (const dep of entry.deps) {
                const set = this.stateListenersByDep.get(dep);
                if (!set) {
                    continue;
                }
                set.delete(entry);
                if (set.size === 0) {
                    this.stateListenersByDep.delete(dep);
                }
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
     *   3. State listeners whose deps include `key` or its collection key.
     */
    notifyKey<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>): void {
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

        // 3. State listeners, fired at most once even when both the member and its collection key match.
        const fired = new Set<StateListenerEntry>();
        this.fireStateListenersForDep(key, fired);
        if (isCollectionMemberWrite) {
            this.fireStateListenersForDep(collectionKey, fired);
        }
    }

    /**
     * Notify of a collection-level batch update.
     *
     * Dispatch:
     *   1. keyListeners.get(collectionKey): fires once with the new collection object.
     *   2. keyListeners.get(memberKey): fires per changed member whose value differs from
     *      the previous, preserving ref-equality on unchanged members.
     *   3. State listeners affected by the collection key or any changed member key, each fired at most once.
     */
    notifyCollection<TKey extends CollectionKeyBase>(
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

        // 3. State listeners, each affected entry fired at most once across the collection and its members.
        const fired = new Set<StateListenerEntry>();
        this.fireStateListenersForDep(collectionKey, fired);
        for (const memberKey of changedKeys) {
            this.fireStateListenersForDep(memberKey, fired);
        }
    }

    /**
     * Wipe all subscriptions. Used by tests and `Onyx.clear()` follow-on.
     */
    clearAll(): void {
        this.keyListeners.clear();
        this.stateListenersByDep.clear();
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

    /** Fires each state listener registered on `depKey`, skipping any already fired this dispatch. */
    private fireStateListenersForDep(depKey: OnyxKey, alreadyFired: Set<StateListenerEntry>): void {
        const set = this.stateListenersByDep.get(depKey);
        if (!set || set.size === 0) {
            return;
        }

        for (const entry of [...set]) {
            if (alreadyFired.has(entry)) {
                continue;
            }
            alreadyFired.add(entry);
            this.safeInvoke(entry.listener, depKey);
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
export type {Listener, StateListenerCallback};
