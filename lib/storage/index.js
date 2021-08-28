/**
 * On Web and Desktop it's enough to leave everything to localforage
 */

import Storage from './providers/LocalForage';

const webStorage = {
    ...Storage,

    /**
     * On web we just return the passed file
     * We don't need to do anything as we can just save the File to LocalForage
     * @param {File} file
     * @returns {Promise<File>}
     */
    prepareFile(file) {
        return Promise.resolve(file);
    }
};

export default webStorage;
