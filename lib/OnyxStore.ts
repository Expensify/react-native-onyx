import cache from './OnyxCache';
import OnyxKeys from './OnyxKeys';
import * as Logger from './Logger';
import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';

/**
 * Listener fired when an exact key's value changes. For collection root keys this is the
 * snapshot-mode listener: receives the frozen collection snapshot every time a member changes.
 */
type KeyListener<TKey extends OnyxKey = OnyxKey> = (value: OnyxValue<TKey>, key: TKey) => void;

/**
 * Listener fired once per changed member when any member of a collection changes.
 * Replaces today's "collection key without waitForCollectionCallback" delivery mode.
 */
type MemberListener = (value: OnyxValue<OnyxKey>, memberKey: OnyxKey) => void;

/**
 * Listener fired when any of a state-listener's declared dep keys changes.
 */
type StateListenerCallback = () => void;

type StateListenerEntry = {
    listener: StateListenerCallback;
    deps: Set<OnyxKey>;
};

/**
 * `OnyxStore` is the listener registry that replaces `OnyxConnectionManager`,
 * `OnyxSnapshotCache`, and the subscriber-half of `OnyxUtils`. It owns three
 * indexes:
 *
 *   keyListeners       — listeners on an exact key (single key, collection root
 *                        in snapshot mode, or a specific collection member).
 *   memberListeners    — listeners on "any member of this collection" — fires
 *                        once per changed member, not once per collection change.
 *   stateListeners(ByDep) — listeners that re-evaluate when any of their declared
 *                        deps change. Indexed by dep key for O(1) lookup in notify().
 *
 * Write paths call `notifyKey()` (single key write) or `notifyCollection()`
 * (batch collection update from `mergeCollection`/`setCollection`/`clear`).
 */
class OnyxStore {
    private keyListeners: Map<OnyxKey, Set<KeyListener>>;

    private memberListeners: Map<CollectionKeyBase, Set<MemberListener>>;

    private stateListeners: Set<StateListenerEntry>;

    private stateListenersByDep: Map<OnyxKey, Set<StateListenerEntry>>;

    constructor() {
        this.keyListeners = new Map();
        this.memberListeners = new Map();
        this.stateListeners = new Set();
        this.stateListenersByDep = new Map();
    }

    /**
     * Sync, cache-only read. Returns the frozen collection snapshot for collection
     * keys, the cached value for single keys, or `undefined` if not in cache.
     */
    getState<TKey extends OnyxKey>(key: TKey): OnyxValue<TKey> {
        if (OnyxKeys.isCollectionKey(key)) {
            return cache.getCollectionData(key) as OnyxValue<TKey>;
        }
        return cache.get(key) as OnyxValue<TKey>;
    }

    /**
     * Subscribe to an exact key. For collection root keys this is "snapshot mode" —
     * the listener fires with the frozen collection snapshot whenever any member
     * changes. For collection member keys or regular keys, the listener fires when
     * that specific key's value changes.
     *
     * Returns an unsubscribe function.
     */
    subscribe<TKey extends OnyxKey>(key: TKey, listener: KeyListener<TKey>): () => void {
        let listeners = this.keyListeners.get(key);
        if (!listeners) {
            listeners = new Set();
            this.keyListeners.set(key, listeners);
        }
        listeners.add(listener as unknown as KeyListener);
        return () => {
            const set = this.keyListeners.get(key);
            if (!set) {
                return;
            }
            set.delete(listener as unknown as KeyListener);
            if (set.size === 0) {
                this.keyListeners.delete(key);
            }
        };
    }

    /**
     * Subscribe to per-member changes on a collection. The listener fires once per
     * changed member, with `(memberValue, memberKey)`. Replaces today's "collection
     * key without waitForCollectionCallback" delivery mode.
     *
     * Returns an unsubscribe function.
     */
    subscribeMembers<TKey extends CollectionKeyBase>(collectionKey: TKey, listener: MemberListener): () => void {
        let listeners = this.memberListeners.get(collectionKey);
        if (!listeners) {
            listeners = new Set();
            this.memberListeners.set(collectionKey, listeners);
        }
        listeners.add(listener);
        return () => {
            const set = this.memberListeners.get(collectionKey);
            if (!set) {
                return;
            }
            set.delete(listener);
            if (set.size === 0) {
                this.memberListeners.delete(collectionKey);
            }
        };
    }

    /**
     * Subscribe to state-tree changes. The listener fires when any of the declared
     * deps changes. Used by `useOnyxState`.
     *
     * Returns an unsubscribe function.
     */
    subscribeState(listener: StateListenerCallback, deps: readonly OnyxKey[]): () => void {
        const entry: StateListenerEntry = {listener, deps: new Set(deps)};
        this.stateListeners.add(entry);
        for (const dep of entry.deps) {
            let set = this.stateListenersByDep.get(dep);
            if (!set) {
                set = new Set();
                this.stateListenersByDep.set(dep, set);
            }
            set.add(entry);
        }
        return () => {
            this.stateListeners.delete(entry);
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
     *   1. keyListeners.get(key) — exact-key subscribers (always fires)
     *   2. If key is a collection member:
     *      2a. keyListeners.get(collectionKey) — snapshot subscribers (unless suppressed)
     *      2b. memberListeners.get(collectionKey) — per-member subscribers
     *   3. State listeners whose deps include `key` or its collection key.
     *
     * `options.suppressCollectionSnapshot` skips step 2a — used by collection-batch
     * write paths so each removed/changed member doesn't re-trigger the collection-level
     * snapshot listeners; the outer `notifyCollection()` fires those once.
     */
    notifyKey<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>, options?: {suppressCollectionSnapshot?: boolean}): void {
        // 1. Exact-key listeners
        const exact = this.keyListeners.get(key);
        if (exact && exact.size > 0) {
            for (const listener of exact) {
                this.safeInvoke(() => listener(value as OnyxValue<OnyxKey>, key), key);
            }
        }

        // 2. Collection-level routing if this key is a collection member.
        const collectionKey = OnyxKeys.getCollectionKey(key);
        const isCollectionMemberWrite = collectionKey !== undefined && collectionKey !== key;
        if (isCollectionMemberWrite) {
            if (!options?.suppressCollectionSnapshot) {
                const snapshotListeners = this.keyListeners.get(collectionKey);
                if (snapshotListeners && snapshotListeners.size > 0) {
                    const snapshot = cache.getCollectionData(collectionKey);
                    for (const listener of snapshotListeners) {
                        this.safeInvoke(() => listener(snapshot as OnyxValue<OnyxKey>, collectionKey), collectionKey);
                    }
                }
            }
            const members = this.memberListeners.get(collectionKey);
            if (members && members.size > 0) {
                for (const listener of members) {
                    this.safeInvoke(() => listener(value as OnyxValue<OnyxKey>, key), key);
                }
            }
        }

        // 3. State listeners
        const fired = new Set<StateListenerEntry>();
        this.fireStateListenersForDep(key, fired);
        if (isCollectionMemberWrite) {
            this.fireStateListenersForDep(collectionKey, fired);
        }
    }

    /**
     * Notify of a collection-level batch update. Used by `mergeCollection`,
     * `setCollection`, and `clear`'s collection path.
     *
     * Dispatch:
     *   1. keyListeners.get(collectionKey) — fires ONCE with the new snapshot.
     *   2. memberListeners.get(collectionKey) — fires once per changed member.
     *   3. keyListeners.get(memberKey) — fires per changed member where the value
     *      differs from the previous (for ref-equality on unchanged members).
     *   4. State listeners affected by the collection key OR any changed member key,
     *      each fired at most once.
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
        const previous = partialPreviousCollection ?? {};

        // Read the merged snapshot once; reuse for snapshot-mode AND for per-member reads.
        // `cache.getCollectionData()` returns the post-merge frozen object, which is what
        // listeners should see (not the raw `partialCollection` input, which is just the
        // delta and lacks fields preserved from the previous values during merge).
        const snapshot = cache.getCollectionData(collectionKey);

        // 1. Snapshot subscribers fire once with the new snapshot.
        const snapshotListeners = this.keyListeners.get(collectionKey);
        if (snapshotListeners && snapshotListeners.size > 0) {
            for (const listener of snapshotListeners) {
                this.safeInvoke(() => listener(snapshot as OnyxValue<OnyxKey>, collectionKey), collectionKey);
            }
        }

        // 2. Per-member subscribers fire once per changed member with the merged value.
        const members = this.memberListeners.get(collectionKey);
        if (members && members.size > 0) {
            for (const memberKey of changedKeys) {
                const value = snapshot?.[memberKey];
                for (const listener of members) {
                    this.safeInvoke(() => listener(value as OnyxValue<OnyxKey>, memberKey), memberKey);
                }
            }
        }

        // 3. Exact-member subscribers fire per changed key (skip if ref unchanged vs previous).
        for (const memberKey of changedKeys) {
            const value = snapshot?.[memberKey];
            const prev = previous[memberKey];
            if (value === prev) {
                continue;
            }
            const exact = this.keyListeners.get(memberKey);
            if (!exact || exact.size === 0) {
                continue;
            }
            for (const listener of exact) {
                this.safeInvoke(() => listener(value as OnyxValue<OnyxKey>, memberKey), memberKey);
            }
        }

        // 4. State listeners — each affected entry fires at most once.
        const fired = new Set<StateListenerEntry>();
        this.fireStateListenersForDep(collectionKey, fired);
        for (const memberKey of changedKeys) {
            this.fireStateListenersForDep(memberKey, fired);
        }
    }

    /** Wipe all subscriptions. Used by tests and `Onyx.clear()` follow-on. */
    clearAll(): void {
        this.keyListeners.clear();
        this.memberListeners.clear();
        this.stateListeners.clear();
        this.stateListenersByDep.clear();
    }

    /** True if there are any subscribers for the given key (exact or member). */
    hasListenersForKey(key: OnyxKey): boolean {
        if ((this.keyListeners.get(key)?.size ?? 0) > 0) {
            return true;
        }
        const collectionKey = OnyxKeys.getCollectionKey(key);
        if (collectionKey && collectionKey !== key) {
            if ((this.keyListeners.get(collectionKey)?.size ?? 0) > 0) {
                return true;
            }
            if ((this.memberListeners.get(collectionKey)?.size ?? 0) > 0) {
                return true;
            }
        }
        return false;
    }

    private fireStateListenersForDep(depKey: OnyxKey, alreadyFired: Set<StateListenerEntry>): void {
        const set = this.stateListenersByDep.get(depKey);
        if (!set || set.size === 0) {
            return;
        }
        for (const entry of set) {
            if (alreadyFired.has(entry)) {
                continue;
            }
            alreadyFired.add(entry);
            this.safeInvoke(entry.listener, depKey);
        }
    }

    private safeInvoke(fn: () => void, contextKey: OnyxKey): void {
        try {
            fn();
        } catch (error) {
            Logger.logAlert(`[OnyxStore] Listener threw an error for key '${contextKey}': ${error}`);
        }
    }
}

const onyxStore = new OnyxStore();

export default onyxStore;
export type {KeyListener, MemberListener, StateListenerCallback};
