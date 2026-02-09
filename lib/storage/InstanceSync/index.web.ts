/**
 * The InstancesSync object provides data-changed events across browser tabs.
 *
 * This implementation uses BroadcastChannel for cross-tab communication,
 * replacing the previous localStorage-based approach. BroadcastChannel is
 * more reliable, supports structured data, and doesn't pollute localStorage.
 *
 * Note: When using the SQLiteProvider (web), cross-tab sync is also handled
 * at the worker/provider level via BroadcastChannel. This InstanceSync layer
 * serves as a fallback for IDBKeyValProvider and as the storage-layer
 * integration point that the storage/index.ts module calls.
 */
import type {OnyxKey} from '../../types';
import NoopProvider from '../providers/NoopProvider';
import type {StorageKeyList, OnStorageKeyChanged} from '../providers/types';
import type StorageProvider from '../providers/types';

const CHANNEL_NAME = 'onyx-instance-sync';

let channel: BroadcastChannel | null = null;
let storage: StorageProvider<unknown> = NoopProvider;

/**
 * Broadcast a single key change to other tabs.
 */
function raiseStorageSyncEvent(onyxKey: OnyxKey) {
    channel?.postMessage({type: 'keyChanged', key: onyxKey});
}

/**
 * Broadcast multiple key changes to other tabs in a single message.
 */
function raiseStorageSyncManyKeysEvent(onyxKeys: StorageKeyList) {
    if (onyxKeys.length === 0) return;
    channel?.postMessage({type: 'keysChanged', keys: onyxKeys});
}

const InstanceSync = {
    shouldBeUsed: true,

    /**
     * Initialize the BroadcastChannel listener for cross-tab synchronization.
     * @param onStorageKeyChanged - Callback invoked when another tab changes a key
     * @param store - The storage provider to read updated values from
     */
    init: (onStorageKeyChanged: OnStorageKeyChanged, store: StorageProvider<unknown>) => {
        storage = store;

        // Close any existing channel before creating a new one
        if (channel) {
            channel.close();
        }

        channel = new BroadcastChannel(CHANNEL_NAME);

        channel.onmessage = (event: MessageEvent) => {
            const data = event.data;
            if (!data) return;

            if (data.type === 'keyChanged' && data.key) {
                storage.getItem(data.key).then((value) => onStorageKeyChanged(data.key, value));
            } else if (data.type === 'keysChanged' && Array.isArray(data.keys)) {
                for (const key of data.keys) {
                    storage.getItem(key).then((value) => onStorageKeyChanged(key, value));
                }
            } else if (data.type === 'clear' && Array.isArray(data.keys)) {
                // When a clear happens, notify about all the keys that were cleared
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
                channel?.postMessage({type: 'clear', keys: allKeys});
            });
    },
};

export default InstanceSync;
