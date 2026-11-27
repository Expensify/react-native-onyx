import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';

import * as Logger from './Logger';
import cache from './OnyxCache';
import OnyxKeys from './OnyxKeys';
import Storage from './storage';

/** Signals that a subscriber should re-read its snapshot. */
type Listener = () => void;

type Subscription = {
    /** Moves the subscription to `deps`, adding and removing only the keys that differ. */
    updateDeps: (deps: readonly OnyxKey[]) => void;
    unsubscribe: () => void;
};

const reportedCacheMisses = new Set<OnyxKey>();

function reportCacheMissIfStorageHasValue(key: OnyxKey): void {
    if (!cache.getAllKeys().has(key) || OnyxKeys.isRamOnlyKey(key) || cache.hasNullishStorageKey(key) || cache.hasRemovedInOtherInstanceKey(key)) {
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
 * Indexes snapshot listeners by dependency key. A collection key is a dependency on all its members.
 */
class OnyxSubscriptionManager {
    private listenersByDep = new Map<OnyxKey, Set<Listener>>();

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

    /** Subscribe to one or more dependencies, with one signal per dispatch. */
    subscribe(deps: OnyxKey | readonly OnyxKey[], listener: Listener): Subscription {
        // Give each subscription its own identity, even when callers share a callback.
        const entry = () => listener();
        let currentDeps: readonly OnyxKey[] | Set<OnyxKey> | null = typeof deps === 'string' ? [deps] : new Set(deps);
        for (const dep of currentDeps) {
            this.addListener(dep, entry);
        }

        return {
            updateDeps: (nextDeps) => {
                if (!currentDeps) {
                    return;
                }
                const previous = currentDeps instanceof Set ? currentDeps : new Set(currentDeps);
                const next = new Set(nextDeps);
                for (const dep of previous) {
                    if (!next.has(dep)) {
                        this.removeListener(dep, entry);
                    }
                }
                for (const dep of next) {
                    if (!previous.has(dep)) {
                        this.addListener(dep, entry);
                    }
                }
                currentDeps = next;
            },
            unsubscribe: () => {
                if (!currentDeps) {
                    return;
                }
                for (const dep of currentDeps) {
                    this.removeListener(dep, entry);
                }
                currentDeps = null;
            },
        };
    }

    /** Signal the key and, for a member write, its parent collection. */
    notifyKey(key: OnyxKey): void {
        if (this.listenersByDep.size === 0) {
            return;
        }
        const collectionKey = OnyxKeys.getCollectionKey(key);
        const hasParentListeners = collectionKey !== undefined && collectionKey !== key && this.listenersByDep.has(collectionKey);
        if (!hasParentListeners) {
            this.dispatch(key);
        } else if (this.listenersByDep.has(key)) {
            this.dispatch(key, [collectionKey]);
        } else {
            this.dispatch(collectionKey);
        }
    }

    /** Signal the collection and members not known to have kept their previous reference. */
    notifyCollection<TKey extends CollectionKeyBase>(
        collectionKey: TKey,
        partialCollection: OnyxCollection<KeyValueMapping[TKey]>,
        partialPreviousCollection?: OnyxCollection<KeyValueMapping[TKey]>,
    ): void {
        if (this.listenersByDep.size === 0) {
            return;
        }
        const changedKeys = Object.keys(partialCollection ?? {});
        if (changedKeys.length === 0) {
            return;
        }
        let firstDep: OnyxKey | undefined = this.listenersByDep.has(collectionKey) ? collectionKey : undefined;
        let otherDeps: OnyxKey[] | undefined;
        for (const memberKey of changedKeys) {
            if (memberKey === collectionKey || !this.listenersByDep.has(memberKey)) {
                continue;
            }
            // Without a previous entry, undefined may mean a removal rather than a no-op.
            if (partialPreviousCollection && Object.prototype.hasOwnProperty.call(partialPreviousCollection, memberKey) && cache.get(memberKey) === partialPreviousCollection[memberKey]) {
                continue;
            }
            if (firstDep === undefined) {
                firstDep = memberKey;
            } else {
                (otherDeps ??= []).push(memberKey);
            }
        }
        if (firstDep !== undefined) {
            this.dispatch(firstDep, otherDeps);
        }
    }

    /**
     * Wipe all subscriptions. Used by tests and `Onyx.clear()` follow-on.
     */
    clearAll(): void {
        this.listenersByDep.clear();
        this.resetCacheMissReports();
    }

    resetCacheMissReports(): void {
        reportedCacheMisses.clear();
    }

    /**
     * True if there are any subscribers for the given key (exact or parent collection).
     */
    hasListenersForKey(key: OnyxKey): boolean {
        if (this.listenersByDep.has(key)) {
            return true;
        }

        const collectionKey = OnyxKeys.getCollectionKey(key);
        return collectionKey !== undefined && collectionKey !== key && this.listenersByDep.has(collectionKey);
    }

    private addListener(dep: OnyxKey, listener: Listener): void {
        let set = this.listenersByDep.get(dep);
        if (!set) {
            set = new Set();
            this.listenersByDep.set(dep, set);
        }
        set.add(listener);
    }

    private removeListener(dep: OnyxKey, listener: Listener): void {
        const set = this.listenersByDep.get(dep);
        if (!set?.delete(listener)) {
            return;
        }
        if (set.size === 0) {
            this.listenersByDep.delete(dep);
        }
    }

    private dispatch(firstDep: OnyxKey, otherDeps?: readonly OnyxKey[]): void {
        // A single bucket is already deduplicated by its Set.
        if (!otherDeps) {
            this.fireListeners(firstDep);
            return;
        }
        const fired = new Set<Listener>();
        this.fireListeners(firstDep, fired);
        for (const dep of otherDeps) {
            this.fireListeners(dep, fired);
        }
    }

    private fireListeners(dep: OnyxKey, fired?: Set<Listener>): void {
        const listeners = this.listenersByDep.get(dep);
        if (!listeners) {
            return;
        }

        // Copy first: a `Set` would also visit listeners subscribed during this loop.
        for (const listener of [...listeners]) {
            if (fired?.has(listener)) {
                continue;
            }
            fired?.add(listener);
            this.safeInvoke(listener, dep);
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
export type {Subscription};
