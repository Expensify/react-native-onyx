/**
 * The native FS handler
 * We store files in our app's directory space, which does not require special
 * permission
 */

import {FileSystem} from 'react-native-unimodules';
import {logAlert} from '../../Logger';

const LOCAL_PATH = `${FileSystem.documentDirectory}.onyx_files/`;

// Create our storage folder
FileSystem.getInfoAsync(LOCAL_PATH)
    .then((info) => {
        if (info.exists) {
            return;
        }

        FileSystem.makeDirectoryAsync(LOCAL_PATH)
            .catch(error => logAlert(`Failed to create app storage dir: ${error.message}`));
    });

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
     * Information about all the files we store locally
     * @returns {Promise<{size: number, sizeMB: number, files: string[]}>}
     */
    storageDirStats() {
        return Promise.all([
            FileSystem.getInfoAsync(LOCAL_PATH, {size: true}),
            FileSystem.readDirectoryAsync(LOCAL_PATH),
        ])
            .then(([dirInfo, fileNames]) => ({
                ...dirInfo,
                sizeMB: dirInfo.size * (1024 ** 2),
                files: fileNames.map(name => ({
                    name,
                    uri: getLocalDestination({name}),
                }))
            }));
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
