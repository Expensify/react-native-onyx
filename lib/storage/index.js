import Storage from './providers/LocalForage';

const webStorage = {
    ...Storage,

    /**
     * Storage synchronization mechanism keeping all opened tabs in sync
     * @param {function(key: String, data: *)} onStorageKeyChanged
     */
    keepInstancesSync(onStorageKeyChanged) {
        const SYNC_ONYX = 'SYNC_ONYX';

        // Override `setItem` to raise storage events that we intercept in other tabs
        this.setItem = (key, value) => Storage.setItem(key, value)
            .then(() => {
                // We raise an event thorough `localStorage` to let other tabs know a value changed
                global.localStorage.setItem(SYNC_ONYX, key);
                global.localStorage.removeItem(SYNC_ONYX);
            });

        // This listener will only be triggered by events coming from other tabs
        global.addEventListener('storage', (event) => {
            // Ignore events that don't originate from the SYNC_ONYX logic above
            if (event.key !== SYNC_ONYX || !event.newValue) {
                return;
            }

            const onyxKey = event.newValue;
            Storage.getItem(onyxKey)
                .then(value => onStorageKeyChanged(onyxKey, value));
        });
    },

    /**
     * @param {File} file
     * @returns {File}
     */
    prepareFile(file) {
        // Storing files in IndexedDB (localforage) doesn't require any preparation
        return file;
    }
};

export default webStorage;
