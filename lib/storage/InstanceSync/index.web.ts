/**
 * The InstancesSync object provides data-changed events like the ones that exist
 * when using LocalStorage APIs in the browser. These events are great because multiple tabs can listen for when
 * data changes and then stay up-to-date with everything happening in Onyx.
 */
import type {OnyxKey} from '../../types';
import NoopProvider from '../providers/NoopProvider';
import type {KeyList, OnStorageKeyChanged} from '../providers/types';
import StorageProvider from '../providers/types';

const SYNC_ONYX = 'SYNC_ONYX';

/**
 * Raise an event through `localStorage` to let other tabs know a value changed
 * @param {String} onyxKey
 */
function raiseStorageSyncEvent(onyxKey: OnyxKey) {
    global.localStorage.setItem(SYNC_ONYX, onyxKey);
    global.localStorage.removeItem(SYNC_ONYX);
}

function raiseStorageSyncManyKeysEvent(onyxKeys: KeyList) {
    onyxKeys.forEach((onyxKey) => {
        raiseStorageSyncEvent(onyxKey);
    });
}

let storage = NoopProvider;

const InstanceSync = {
    /**
     * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    init: (onStorageKeyChanged: OnStorageKeyChanged, store: StorageProvider) => {
        storage = store;

        // This listener will only be triggered by events coming from other tabs
        global.addEventListener('storage', (event) => {
            // Ignore events that don't originate from the SYNC_ONYX logic
            if (event.key !== SYNC_ONYX || !event.newValue) {
                return;
            }

            const onyxKey = event.newValue;

            storage.getItem(onyxKey).then((value) => onStorageKeyChanged(onyxKey, value));
        });
    },
    setItem: raiseStorageSyncEvent,
    removeItem: raiseStorageSyncEvent,
    removeItems: raiseStorageSyncManyKeysEvent,
    mergeItem: raiseStorageSyncEvent,
    clear: (clearImplementation: () => void) => {
        let allKeys: KeyList;

        // The keys must be retrieved before storage is cleared or else the list of keys would be empty
        return storage
            .getAllKeys()
            .then((keys: KeyList) => {
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
