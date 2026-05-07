/**
 * The InstancesSync object provides data-changed events across browser tabs.
 *
 * This implementation listens on the unified `onyx-sync` BroadcastChannel for
 * value-bearing messages from the storage worker. When another tab's worker
 * persists changes, it broadcasts the values directly, so this tab can update
 * its cache without re-reading from storage.
 *
 * For merge operations, the raw patch is broadcast and applied against the
 * local cache using fastMerge. If the key is not in cache, we fall back to
 * reading from the storage provider.
 *
 * The InstanceSync also retains its sending capabilities (setItem, multiSet, etc.)
 * for the IDB fallback path. When the worker handles broadcasting (the normal
 * case), these send methods are skipped by storage/index.ts.
 */
import type {OnyxKey} from '../../types';
import cache from '../../OnyxCache';
import utils from '../../utils';
import NoopProvider from '../providers/NoopProvider';
import type {StorageKeyList, OnStorageKeyChanged} from '../providers/types';
import type StorageProvider from '../providers/types';

const SYNC_CHANNEL_NAME = 'onyx-sync';

/**
 * Legacy channel for key-only messages from the IDB fallback path.
 * Once IDB is moved to a worker, this can be removed.
 */
const LEGACY_CHANNEL_NAME = 'onyx-instance-sync';

let syncChannel: BroadcastChannel | null = null;
let legacyChannel: BroadcastChannel | null = null;
let storage: StorageProvider<unknown> = NoopProvider;

/**
 * Broadcast a single key change to other tabs (legacy IDB fallback path).
 */
function raiseStorageSyncEvent(onyxKey: OnyxKey) {
    legacyChannel?.postMessage({type: 'keyChanged', key: onyxKey});
}

/**
 * Broadcast multiple key changes to other tabs in a single message (legacy IDB fallback path).
 */
function raiseStorageSyncManyKeysEvent(onyxKeys: StorageKeyList) {
    if (onyxKeys.length === 0) return;
    legacyChannel?.postMessage({type: 'keysChanged', keys: onyxKeys});
}

const InstanceSync = {
    shouldBeUsed: true,

    /**
     * Initialize the BroadcastChannel listeners for cross-tab synchronization.
     *
     * Two channels are set up:
     * 1. `onyx-sync` - Value-bearing messages from the unified worker. This is
     *    the primary sync path for both SQLite and IDB (since both now run in
     *    the worker). Messages carry actual values/patches, avoiding re-reads.
     * 2. `onyx-instance-sync` - Legacy key-only messages. Retained as fallback
     *    for any edge cases. Will be removed once fully migrated.
     *
     * @param onStorageKeyChanged - Callback invoked when another tab changes a key
     * @param store - The storage provider to read updated values from (fallback only)
     */
    init: (onStorageKeyChanged: OnStorageKeyChanged, store: StorageProvider<unknown>) => {
        storage = store;

        // Close any existing channels before creating new ones
        if (syncChannel) {
            syncChannel.close();
        }
        if (legacyChannel) {
            legacyChannel.close();
        }

        // --- Primary channel: value-bearing messages from the worker ---
        syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
        syncChannel.onmessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data) return;

            if (data.type === 'set' && Array.isArray(data.pairs)) {
                // SET: full values included, no storage reads needed
                for (const [key, value] of data.pairs) {
                    onStorageKeyChanged(key, value);
                }
            } else if (data.type === 'merge' && Array.isArray(data.pairs)) {
                // MERGE: raw patch included, apply fastMerge against cache
                for (const [key, patch] of data.pairs) {
                    const cachedValue = cache.get(key);
                    if (cachedValue !== undefined) {
                        // Fast path: merge against cached value
                        const mergedValue = utils.fastMerge(cachedValue as Record<string, unknown>, patch as Record<string, unknown>, {
                            shouldRemoveNestedNulls: true,
                            objectRemovalMode: 'replace',
                        }).result;
                        onStorageKeyChanged(key, mergedValue);
                    } else {
                        // Slow path: key not in cache, read from storage then apply merge
                        storage.getItem(key).then((storedValue) => {
                            if (storedValue !== null && storedValue !== undefined) {
                                const mergedValue = utils.fastMerge(storedValue as Record<string, unknown>, patch as Record<string, unknown>, {
                                    shouldRemoveNestedNulls: true,
                                    objectRemovalMode: 'replace',
                                }).result;
                                onStorageKeyChanged(key, mergedValue);
                            } else {
                                // No stored value either -- treat the patch as the full value
                                onStorageKeyChanged(key, patch);
                            }
                        });
                    }
                }
            } else if (data.type === 'remove' && Array.isArray(data.keys)) {
                // REMOVE: notify with null value
                for (const key of data.keys) {
                    onStorageKeyChanged(key, null);
                }
            } else if (data.type === 'clear') {
                // CLEAR: notify all cached keys with null
                const allCachedKeys = cache.getAllKeys();
                for (const key of allCachedKeys) {
                    onStorageKeyChanged(key, null);
                }
            }
        };

        // --- Legacy channel: key-only messages (IDB fallback) ---
        legacyChannel = new BroadcastChannel(LEGACY_CHANNEL_NAME);
        legacyChannel.onmessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data) return;

            if (data.type === 'keyChanged' && data.key) {
                storage.getItem(data.key).then((value) => onStorageKeyChanged(data.key, value));
            } else if (data.type === 'keysChanged' && Array.isArray(data.keys)) {
                for (const key of data.keys) {
                    storage.getItem(key).then((value) => onStorageKeyChanged(key, value));
                }
            } else if (data.type === 'clear' && Array.isArray(data.keys)) {
                for (const key of data.keys) {
                    storage.getItem(key).then((value) => onStorageKeyChanged(key, value));
                }
            }
        };
    },

    setItem: raiseStorageSyncEvent,
    removeItem: raiseStorageSyncEvent,
    removeItems: raiseStorageSyncManyKeysEvent,
    multiMerge: raiseStorageSyncManyKeysEvent,
    multiSet: raiseStorageSyncManyKeysEvent,
    mergeItem: raiseStorageSyncEvent,

    clear: (clearImplementation: () => Promise<void>) => {
        let allKeys: StorageKeyList;

        // The keys must be retrieved before storage is cleared or else the list of keys would be empty
        return storage
            .getAllKeys()
            .then((keys: StorageKeyList) => {
                allKeys = keys;
            })
            .then(() => clearImplementation())
            .then(() => {
                // Now that storage is cleared, broadcast the clear event with all affected keys
                legacyChannel?.postMessage({type: 'clear', keys: allKeys});
            });
    },
};

export default InstanceSync;
