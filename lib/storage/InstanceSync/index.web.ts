/**
 * The InstancesSync object provides data-changed events like the ones that exist
 * when using LocalStorage APIs in the browser. These events are great because multiple tabs can listen for when
 * data changes and then stay up-to-date with everything happening in Onyx.
 */
import type {OnyxKey} from '../../types';
import NoopProvider from '../providers/NoopProvider';
import type {StorageKeyList, OnStorageKeysChanged} from '../providers/types';
import type StorageProvider from '../providers/types';

const SYNC_ONYX = 'SYNC_ONYX';

/**
 * Parses the SYNC_ONYX storage event value.
 * The payload is a JSON array of the changed keys (a batch). I fall backs to treating the raw
 * value as a single key for backwards compatibility with the previous one-key-per-event format.
 */
function parseSyncOnyxStorageEventValue(value: string): StorageKeyList {
    let onyxKeys: StorageKeyList;
    try {
        const parsed = JSON.parse(value) as StorageKeyList | string;
        onyxKeys = Array.isArray(parsed) ? parsed : [value];
    } catch {
        onyxKeys = [value];
    }

    return onyxKeys;
}

/**
 * Raise a single cross-tab event for a batch of changed keys. Sending them together (instead of one
 * event per key) preserves the write's batch boundary across tabs, so the receiving tab can notify
 * collection subscribers once for the whole batch — matching the local mergeCollection behavior —
 * instead of re-delivering the whole collection once per member (which is O(N^2) and can crash the tab).
 */
function raiseStorageSyncManyKeysEvent(onyxKeys: StorageKeyList) {
    if (onyxKeys.length === 0) {
        return;
    }
    global.localStorage.setItem(SYNC_ONYX, JSON.stringify(onyxKeys));
    global.localStorage.removeItem(SYNC_ONYX);
}

/**
 * Raise an event through `localStorage` to let other tabs know a single key changed.
 *
 * This intentionally emits the raw key (the legacy, pre-batching format) rather than a JSON array, so a
 * tab still running the previous bundle during a deploy keeps receiving single-key updates (a new message,
 * a pin, a rename, etc.). Only multi-key writes use the batched JSON-array format; the receiver here
 * understands both. The mixed-version gap is therefore limited to bulk collection writes, which resolve on reload.
 */
function raiseStorageSyncEvent(onyxKey: OnyxKey) {
    global.localStorage.setItem(SYNC_ONYX, onyxKey);
    global.localStorage.removeItem(SYNC_ONYX);
}

let storage = NoopProvider;

const InstanceSync = {
    shouldBeUsed: true,
    /**
     * @param {Function} onStorageKeysChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    init: (onStorageKeysChanged: OnStorageKeysChanged, store: StorageProvider<unknown>) => {
        storage = store;

        // This listener will only be triggered by events coming from other tabs
        global.addEventListener('storage', (event) => {
            // Ignore events that don't originate from the SYNC_ONYX logic
            if (event.key !== SYNC_ONYX || !event.newValue) {
                return;
            }

            const onyxKeys = parseSyncOnyxStorageEventValue(event.newValue);

            storage.multiGet(onyxKeys).then((pairs) => onStorageKeysChanged(pairs));
        });
    },
    setItem: raiseStorageSyncEvent,
    removeItem: raiseStorageSyncEvent,
    removeItems: raiseStorageSyncManyKeysEvent,
    multiMerge: raiseStorageSyncManyKeysEvent,
    multiSet: raiseStorageSyncManyKeysEvent,
    mergeItem: raiseStorageSyncEvent,
    clear: (clearImplementation: () => void) => {
        let allKeys: StorageKeyList;

        // The keys must be retrieved before storage is cleared or else the list of keys would be empty
        return storage
            .getAllKeys()
            .then((keys: StorageKeyList) => {
                allKeys = keys;
            })
            .then(() => clearImplementation())
            .then(() => {
                // Now that storage is cleared, the storage sync event can happen which is a more atomic action
                // for other browser tabs
                raiseStorageSyncManyKeysEvent(allKeys);
            });
    },
};

export default InstanceSync;
