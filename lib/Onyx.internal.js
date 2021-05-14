/**
 * Internal Onyx method that are not exposed through the public API
 */

import AsyncStorage from '@react-native-community/async-storage';
import {logInfo} from './Logger';

/**
 * When a key change happens, search for any callbacks matching the regex pattern and trigger those callbacks
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

const OnyxInternal = {
    get,
};

export default OnyxInternal;
