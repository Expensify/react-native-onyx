/**
 * On native we can leave almost everything to AsyncStorage but files.
 * Before files are saved in our key/value storage they should first be copied to
 * our "local space" (App Documents) so that they're not lost - image pickers and document
 * pickers would move files to cache which can be cleared before we've uploaded them
 *
 * We don't actually save the file to our key/value store but only the reference to it
 */

import Storage from './providers/AsyncStorage';
import FileHandler from './providers/NativeFileHandler';

const nativeStorage = {
    ...Storage,

    /**
     * On native we copy the file locally and return a reference to the new file
     * This allows us to stringify and save the reference in our regular storage
     * e.g. as part of a persisted request or an optimistic report action
     * @param {{ uri: string, name: string }} file
     * @returns {Promise<{uri: string, name: string, type: string}>}
     */
    prepareFile(file) {
        return FileHandler.storeLocally(file);
    }
};

export default nativeStorage;
