/**
 * This file is here to wrap IDBKeyVal with a layer that provides data-changed events like the ones that exist
 * when using LocalStorage APIs in the browser. These events are great because multiple tabs can listen for when
 * data changes and then stay up-to-date with everything happening in Onyx.
 */
import _ from 'underscore';
import Storage from './providers/IDBKeyVal';

const SYNC_ONYX = 'SYNC_ONYX';

/**
 * Raise an event thorough `localStorage` to let other tabs know a value changed
 * @param {String} onyxKey
 */
function raiseStorageSyncEvent(onyxKey) {
    global.localStorage.setItem(SYNC_ONYX, onyxKey);
    global.localStorage.removeItem(SYNC_ONYX, onyxKey);
}

function raiseStorageSyncManyKeysEvent(onyxKeys) {
    _.each(onyxKeys, (onyxKey) => {
        raiseStorageSyncEvent(onyxKey);
    });
}

const webStorage = {
    ...Storage,

    /**
     * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    keepInstancesSync(onStorageKeyChanged) {
        // Override set, remove and clear to raise storage events that we intercept in other tabs
        this.setItem = (key, value) => Storage.setItem(key, value).then(() => raiseStorageSyncEvent(key));

        this.removeItem = (key) => Storage.removeItem(key).then(() => raiseStorageSyncEvent(key));

        this.removeItems = (keys) => Storage.removeItems(keys).then(() => raiseStorageSyncManyKeysEvent(keys));

        this.mergeItem = (key, batchedChanges, modifiedData) => Storage.mergeItem(key, batchedChanges, modifiedData).then(() => raiseStorageSyncEvent(key));

        // If we just call Storage.clear other tabs will have no idea which keys were available previously
        // so that they can call keysChanged for them. That's why we iterate over every key and raise a storage sync
        // event for each one
        this.clear = () => {
            let allKeys;

            // The keys must be retrieved before storage is cleared or else the list of keys would be empty
            return Storage.getAllKeys()
                .then((keys) => {
                    allKeys = keys;
                })
                .then(() => Storage.clear())
                .then(() => {
                    // Now that storage is cleared, the storage sync event can happen which is a more atomic action
                    // for other browser tabs
                    _.each(allKeys, raiseStorageSyncEvent);
                });
        };

        // This listener will only be triggered by events coming from other tabs
        global.addEventListener('storage', (event) => {
            // Ignore events that don't originate from the SYNC_ONYX logic
            if (event.key !== SYNC_ONYX || !event.newValue) {
                return;
            }

            const onyxKey = event.newValue;
            Storage.getItem(onyxKey).then((value) => onStorageKeyChanged(onyxKey, value));
        });
    },
};

export default webStorage;
