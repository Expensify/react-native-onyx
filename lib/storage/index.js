/**
 * On Web and Desktop it's enough to leave everything to localforage
 */

import Storage from './providers/LocalForage';

const webStorage = {
    ...Storage,

    /**
     * Storage synchronization mechanism keeping all opened tabs in sync
     * @param {object} config
     * @param {function(key: string, data: any)} config.keyChanged
     */
    synchronizeInstances(config) {
        const SYNC_ONYX = 'SYNC_ONYX';

        // Override `setItem` to raise storage events that we can intercept in other tabs
        this.setItem = (key, value) => Storage.setItem(key, value)
            .then(() => {
                /** We make a temp write to storage just to raise the storage event (below)
                 * then remove the "dummy" value.
                 * Listeners would receive everything they need to read the new value from the DB */
                global.localStorage.setItem(SYNC_ONYX, key);
                global.localStorage.removeItem(SYNC_ONYX);
            });

        // This event will be triggered on tabs other than the current tab
        global.addEventListener('storage', (event) => {
            if (!event.newValue) {
                return;
            }

            // Notify any listeners in case an Onyx key did change
            if (event.key === SYNC_ONYX) {
                Storage.getItem(event.newValue)
                    .then(value => config.keyChanged(event.newValue, value));
            }
        });
    },

    /**
     * On web we just return the passed file
     * We don't need to do anything as we can just save the File to LocalForage
     * @param {File} file
     * @returns {File}
     */
    prepareFile(file) {
        // Todo: we can add some size considerations here and abort if necessary
        return file;
    }
};

export default webStorage;
