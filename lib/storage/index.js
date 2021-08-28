/**
 * On Web and Desktop it's enough to leave everything to localforage
 */

import Storage from './providers/LocalForage';

/**
 * @implements {StorageProvider}
 */
class WebStorage extends Storage {
    /**
     * On web we just return the passed file
     * We don't need to do anything as we can just save the File to LocalForage
     * @param {File} file
     * @returns {Promise<File>}
     */
    storeFileLocally(file) {
        return Promise.resolve(file);
    }
}

const instance = new WebStorage();

export default instance;
