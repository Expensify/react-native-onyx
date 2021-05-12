/**
 * Internal Onyx method that are not exposed through the public API
 */

import AsyncStorage from '@react-native-community/async-storage';
import {logInfo} from './Logger';

/**
 * Get some data from the store
 *
 * @param {string} key
 * @returns {Promise<*>}
 */
function get(key) {
    return AsyncStorage.getItem(key)
        .then(val => JSON.parse(val))
        .catch(err => logInfo(`Unable to get item from persistent storage. Key: ${key} Error: ${err}`));
}

/**
 * Write a value to our store with the given key
 *
 * @param {string} key
 * @param {mixed} val
 * @returns {Promise}
 */
function set(key, val) {
    // Write the thing to persistent storage, which will trigger a storage event for any other tabs open on this domain
    return AsyncStorage.setItem(key, JSON.stringify(val));
}

/**
 * Returns current key names stored in persisted storage
 * @returns {Array<String>}
 */
function getAllKeys() {
    return AsyncStorage.getAllKeys();
}

const OnyxInternal = {
    get,
    getAllKeys,
    set,
};

export default OnyxInternal;
