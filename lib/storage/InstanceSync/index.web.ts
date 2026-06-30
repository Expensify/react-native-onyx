/**
 * The InstancesSync object provides data-changed events like the ones that exist
 * when using LocalStorage APIs in the browser. These events are great because multiple tabs can listen for when
 * data changes and then stay up-to-date with everything happening in Onyx.
 */
import * as Logger from '../../Logger';
import type {OnyxKey} from '../../types';
import NoopProvider from '../providers/NoopProvider';
import type {StorageKeyList, OnStorageKeysChanged} from '../providers/types';
import type StorageProvider from '../providers/types';

const SYNC_ONYX = 'SYNC_ONYX';

// localStorage stores values as UTF-16 (~2 bytes/char). The per-origin quota isn't fixed by the spec —
// it's user-agent dependent and commonly ~5MB — so we keep each SYNC_ONYX payload conservatively small
// (and pair it with a try/catch in emitSyncEvent). This way a large key batch (e.g. Onyx.clear() on a
// heavy account, or a bulk import) is split across several events instead of throwing QuotaExceededError.
// See https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
const MAX_SYNC_PAYLOAD_LENGTH = 1_000_000;

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
 * Emit a single SYNC_ONYX storage event. Wrapped so a failed cross-tab signal
 * degrades gracefully — other tabs simply miss this update until their next organic sync/reload — instead
 * of throwing an uncaught rejection in the writing tab.
 */
function emitSyncEvent(value: string) {
    try {
        global.localStorage.setItem(SYNC_ONYX, value);
        global.localStorage.removeItem(SYNC_ONYX);
    } catch (error) {
        Logger.logAlert(`[InstanceSync] Failed to raise storage sync event: ${error}`);
    }
}

/**
 * Raise cross-tab event(s) for a batch of changed keys. Sending keys together (instead of one event per
 * key) preserves the write's batch boundary across tabs, so the receiving tab notifies collection
 * subscribers once for the whole batch — matching the local mergeCollection behavior — instead of
 * re-delivering the whole collection once per member (O(N^2), which can crash the tab). Large batches are
 * chunked so no single payload approaches the localStorage quota.
 */
function raiseStorageSyncManyKeysEvent(onyxKeys: StorageKeyList) {
    if (onyxKeys.length === 0) {
        return;
    }

    let chunk: StorageKeyList = [];
    let chunkLength = 2; // accounts for the surrounding `[]`
    for (const onyxKey of onyxKeys) {
        const keyLength = onyxKey.length + 3; // quotes + comma separator
        if (chunk.length > 0 && chunkLength + keyLength > MAX_SYNC_PAYLOAD_LENGTH) {
            emitSyncEvent(JSON.stringify(chunk));
            chunk = [];
            chunkLength = 2;
        }
        chunk.push(onyxKey);
        chunkLength += keyLength;
    }
    if (chunk.length > 0) {
        emitSyncEvent(JSON.stringify(chunk));
    }
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
    emitSyncEvent(onyxKey);
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
