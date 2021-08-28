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
     * @returns {File}
     */
    prepareFile(file) {
        // Todo: we can add some size considerations here and abort if necessary
        return file;
    }
};

export default webStorage;
