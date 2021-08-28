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
     * @param {{uri: string, name: string, type: string}} file
     * @returns {{uri: string, name: string, type: string}}
     */
    prepareFile(file) {
        // Todo: perhaps check size here and abort if the size is larger than 20MB

        // Create result optimistically so the method can called as sync method
        const uri = FileHandler.getLocalDestination(file);
        const optimisticResult = {...file, uri};

        // Todo: do something about the error, e.g. run eviction logic if it's due to lack of space
        FileHandler.storeLocally(file)
            .catch(console.error);

        return optimisticResult;
    }
};

export default nativeStorage;
