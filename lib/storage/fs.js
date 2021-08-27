/**
 * The web and desktop FS handler
 * On web we don't have access to the underlying file system so we use the
 * Cache API to save Files
 */

const CACHE_KEY = 'expensify_user_files';
const LOCAL_PATH = `${global.location.origin}/${CACHE_KEY}/`;

class WebFileHandler {
    /**
     * Create a local copy of a file
     * @param {File} file
     * @returns {Promise<File>}
     */
    storeLocally(file) {
        // We can also make this work with Blobs eg `|| file instanceof Blob`
        const isSupported = file instanceof File;

        if (!isSupported) {
            // eslint-disable-next-line no-undef
            if (__DEV__) {
                throw new Error('Unsupported file param');
            }

            return Promise.resolve(file);
        }

        return global.caches.open(CACHE_KEY)
            .then((cache) => {
                /**
                 * Only Response objects can be put into cache
                 * But we can take advantage of dealing with Request/Responses
                 * and respond from cache for the given destination
                 * */
                const localRef = this.getLocalRef(file);
                const response = new Response(file);
                cache.put(localRef, response);

                return file;
            });
    }

    /**
     * On Web (and Desktop) we cannot reference local file paths directly from cache
     * we need to identify such entries and make them available again by reading
     * the file from cache
     * E.g. if the browser is closed and re-opened and `uri` created with `URL.createObjectURL`
     * become invalid, but we can recreated them using the file from cache
     * @param {{ name: string, type: string }} file
     * @returns {Promise<File|undefined>} Undefined will be returned if we don't have such file stored locally
     */
    getFileFromCache(file) {
        // When we've already got a File instance we don't need to retrieved again from cache
        if (file instanceof File) {
            Promise.resolve(file);
        }

        return global.caches.open(CACHE_KEY)
            .then((cache) => {
                const localRef = this.getLocalRef(file);
                return cache.match(localRef);
            })
            .then(response => response && response.blob())
            .then(blob => blob && new File([blob], file.name, file.type));
    }

    /**
     * A list of all the files we have locally
     * @return {Promise<string[]>}
     */
    getLocalFileList() {
        return global.caches.open(CACHE_KEY)
            .then(cache => cache.keys());
    }

    /**
     * Remove the file from cache
     * @param {{ name: string }} file
     * @return {Promise<any> | PromiseLike<any>}
     */
    deleteLocally(file) {
        return global.caches.open(CACHE_KEY)
            .then((cache) => {
                const localRef = this.getLocalRef(file);
                return cache.delete(localRef);
            });
    }

    /**
     * @private
     * @param {{ name: string }} file
     * @return {string}
     */
    getLocalRef(file) {
        return `${LOCAL_PATH}${file.name}`;
    }
}
const instance = new WebFileHandler();

export default instance;
