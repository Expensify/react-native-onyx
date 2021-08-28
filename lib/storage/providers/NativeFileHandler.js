/**
 * The native FS handler
 * We storage images in our app's directory space, which does not require special
 * permission
 */

import {FileSystem} from 'react-native-unimodules';

const LOCAL_PATH = `${FileSystem.documentDirectory}onyx_files/`;

/**
 * @param {{name: string}} file
 * @returns {string}
 */
function getLocalDestination(file) {
    return `${LOCAL_PATH}${file.name}`;
}

const fileHandler = {
    /**
     * Create a local copy of a file
     * @param {{uri: string, name: string}} file
     * @returns {Promise<{uri: string, name: string, type: string}>} A reference to the file stored locally
     */
    storeLocally(file) {
        const destination = getLocalDestination(file);

        return FileSystem
            .copyAsync({from: file.uri, to: destination})
            .then(() => ({...file, uri: destination}));
    },

    /**
     * A list of all the files we have locally
     * @returns {Promise<string[]>}
     */
    getLocalFileList() {
        // Todo: remove this
        FileSystem.getInfoAsync(LOCAL_PATH, {size: true})
            .then(result => console.debug('getInfoAsync: ', result));

        return FileSystem.readDirectoryAsync(LOCAL_PATH);
    },

    /**
     * Remove the file from the local FS
     * @param {string|{uri: string}} file - works with either a path or a file object
     * @return {Promise<void>}
     */
    deleteLocally(file) {
        return FileSystem.deleteAsync(file.uri || file, {idempotent: true});
    },

    getLocalDestination,
};

export default fileHandler;
