import _ from 'underscore';
import Storage from './providers/LocalForage';

const SYNC_ONYX = 'SYNC_ONYX';

/**
 * Raise an event thorough `localStorage` to let other tabs know a value changed
 * @param {String} onyxKey
 */
function raiseStorageSyncEvent(onyxKey) {
    global.localStorage.setItem(SYNC_ONYX, onyxKey);
    global.localStorage.removeItem(SYNC_ONYX, onyxKey);
}

const webStorage = {
    ...Storage,

    /**
     * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
     */
    keepInstancesSync(onStorageKeyChanged) {
        // Override set, remove and clear to raise storage events that we intercept in other tabs
        this.setItem = (key, value) => Storage.setItem(key, value)
            .then(() => raiseStorageSyncEvent(key));

        this.removeItem = key => Storage.removeItem(key)
            .then(() => raiseStorageSyncEvent(key));

        // If we just call Storage.clear other tabs will have no idea which keys were available previously
        // so that they can call keysChanged for them. That's why we iterate over every key that doesn't need to be
        // preserved and raise a storage sync event for them
        this.clear = keyValuesToPreserve => Storage.getAllKeys()
            .then((allKeys) => {
                const keysToPreserve = _.map(keyValuesToPreserve, keyValueToPreserve => keyValueToPreserve[0]);
                return _.filter(allKeys, key => !_.contains(keysToPreserve, key));
            })
            .then(keysToRemove => _.map(keysToRemove, key => raiseStorageSyncEvent(key)))

            // Clear out everything from storage and then set
            .then(() => Storage.clear())
            .then(() => Storage.multiSet(keyValuesToPreserve));

        // This listener will only be triggered by events coming from other tabs
        global.addEventListener('storage', (event) => {
            // Ignore events that don't originate from the SYNC_ONYX logic
            if (event.key !== SYNC_ONYX || !event.newValue) {
                return;
            }

            const onyxKey = event.newValue;
            Storage.getItem(onyxKey)
                .then(value => onStorageKeyChanged(onyxKey, value));
        });
    },
};

export default webStorage;
