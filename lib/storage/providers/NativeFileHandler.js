/**
 * The native FS handler
 * We storage images in our app's directory space, which does not require special
 * permission
 */

import {FileSystem} from 'react-native-unimodules';

const LOCAL_PATH = `${FileSystem.documentDirectory}onyx_files/`;

class NativeFileHandler {
    /**
     * Create a local copy of a file
     * @param {{ uri: string, name: string }} file
     * @returns {Promise<{uri: string, name: string}>} A reference to the file stored locally
     */
    storeLocally(file) {
        // Todo: perhaps check size here and abort if the size is larger than 20MB

        const destination = this.getLocalDestination(file);

        const copyTask = FileSystem
            .copyAsync({from: file.uri, to: destination})
            .then(() => ({...file, uri: destination}));

        // Todo: do something about the error, e.g. run eviction logic if it's due to lack of space
        copyTask.catch(console.error);

        // Todo: it might be best to move the checks mentioned here to the caller of the method
        // Because the requirements/logic will be the same for web

        return copyTask;
    }

    /**
     * A list of all the files we have locally
     * @returns {Promise<string[]>}
     */
    getLocalFileList() {
        // Todo: remove this
        FileSystem.getInfoAsync(LOCAL_PATH, {size: true})
            .then(result => console.debug('getInfoAsync: ', result));

        return FileSystem.readDirectoryAsync(LOCAL_PATH);
    }

    /**
     * Remove the file from the local FS
     * @param {string|{uri: string}} file - works with either a path or a file object
     * @return {Promise<void>}
     */
    deleteLocally(file) {
        return FileSystem.deleteAsync(file.uri || file, {idempotent: true});
    }

    /**
     * Check if the object is a File
     * @param {object} file
     * @returns {boolean}
     */
    isFile(file) {
        if (!file) {
            return false;
        }
        return Boolean(
            file.uri
            && file.name
            && file.type
        );
    }

    /**
     * Check if a file is already saved locally
     * @param {{ name: string, uri: string }} file
     * @returns {boolean}
     */
    isAvailableLocally(file) {
        const dest = this.getLocalDestination(file);
        return dest === file.uri;
    }

    /**
     * @private
     * @param {{ name: string }} file
     * @returns {string}
     */
    getLocalDestination(file) {
        return `${LOCAL_PATH}${file.name}`;
    }
}

export default NativeFileHandler;
