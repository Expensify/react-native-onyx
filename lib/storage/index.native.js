/**
 * On native we can leave almost everything to AsyncStorage but should
 * handle files. When we see that a file is saved we should move it to our "local space" (App Documents)
 * so that it's not lost - image pickers and document pickers would move files to cache which
 * can be cleared before we've uploaded them
 */

import _ from 'underscore';

import lodashSet from 'lodash/set';

import BaseStorage from './providers/AsyncStorage';
import FileHandler from './providers/NativeFileHandler';

/**
 * We override the saving methods of storage handler and check for files, when the
 * saved data contains a file we keep a copy in our "local space"
 */
class NativeStorage extends BaseStorage {
    constructor() {
        super();
        this.fs = new FileHandler();
    }

    setItem(key, value) {
        return this.storeAnyFilesLocally(key, value)
            .then(valueToWrite => super.setItem(key, valueToWrite));
    }

    /**
     * @private
     * Traverse an object and store any files locally
     * We check object values and follow recursively for any files
     * If we find files we first store them locally and then update values with the local path
     * @param {string} key
     * @param {object} obj
     * @returns {Promise<object>} the input object with file references updated and copied locally
     */
    storeAnyFilesLocally(key, obj) {
        const writeFileTasks = [];
        const updates = {[key]: obj};

        const recurse = (objPath, nextValue) => {
            if (this.fs.isFile(nextValue)) {
                // Only copy files that are not yet copied locally
                if (!this.fs.isAvailableLocally(nextValue)) {
                    const task = this.fs.storeLocally(nextValue)
                        .then((savedFile) => {
                            lodashSet(updates, objPath, savedFile);
                        });

                    writeFileTasks.push(task);
                }
            } else if (_.isObject(nextValue)) {
                // Otherwise check nested keys
                Object.keys(nextValue)
                    .forEach(nestedKey => recurse([...objPath, nestedKey], nextValue[nestedKey]));
            }
        };

        recurse([key], obj);

        if (writeFileTasks.length > 0) {
            return Promise.all(writeFileTasks)
                .then(() => {
                    // The object is changed when the top level key was a file
                    if (obj !== updates[key]) {
                        return updates[key];
                    }

                    return obj;
                });
        }

        return Promise.resolve(obj);
    }
}

const instance = new NativeStorage();

export default instance;
