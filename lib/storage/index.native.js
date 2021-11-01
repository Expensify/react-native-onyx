/**
 * On native we can leave almost everything to AsyncStorage, but files need to be prepared.
 * Before files are saved in our key/value storage they should first be copied to
 * our "local space" (App Documents) so that they're not lost - image pickers and document
 * pickers would move files to cache which can be cleared before we've uploaded them
 *
 * We don't actually save the file to our key/value store but only the reference to it
 */

import Storage from './providers/AsyncStorage';
import FileHandler from './providers/NativeFileHandler';
import {logAlert} from '../Logger';

const nativeStorage = {
    ...Storage,

    /**
     * On native it's a no-op because it's not possible to have multiple instances of Onyx (e.g. multiple tabs)
     */
    synchronizeInstances() {},

    /**
     * Prepares a file so that it can be referenced in Onyx key/value storage
     * @param {{uri: String, name: String, type: String}} file
     * @returns {{uri: String, name: String, type: String}}
     */
    prepareFile(file) {
        // Create result optimistically so the method can called as sync method
        const uri = FileHandler.getLocalDestination(file);
        const optimisticResult = {...file, uri};

        FileHandler.storeLocally(file)
            .catch((error) => {
                logAlert(`Failed to store file locally: ${error.message}`);
                throw error;
            });

        return optimisticResult;
    }
};

export default nativeStorage;
