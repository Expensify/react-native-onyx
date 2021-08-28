/**
 * On native we can leave almost everything to AsyncStorage but should
 * handle files. When we see that a file is saved we should move it to our "local space" (App Documents)
 * so that it's not lost - image pickers and document pickers would move files to cache which
 * can be cleared before we've uploaded them
 */

import Storage from './providers/AsyncStorage';
import FileHandler from './providers/NativeFileHandler';

/**
 * @implements {StorageProvider}
 */
class NativeStorage extends Storage {
    constructor() {
        super();
        this.fs = new FileHandler();
        this.storeFileLocally = this.storeFileLocally.bind(this);
    }

    /**
     * On native we copy the file locally and return a reference to the new file
     * This allows us to stringify and save the reference in our regular storage
     * e.g. as part of a persisted request or an optimistic report action
     * @param {{ uri: string, name: string }} file
     * @returns {Promise<{uri: string, name: string, type: string}>}
     */
    storeFileLocally(file) {
        return this.fs.storeLocally(file);
    }
}

const instance = new NativeStorage();

export default instance;
