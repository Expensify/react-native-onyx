import _ from 'underscore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Str from 'expensify-common/lib/str';
import lodashMerge from 'lodash/merge';
import {registerLogger, logInfo, logAlert} from './Logger';
import cache from './OnyxCache';

// Keeps track of the last connectionID that was used so we can keep incrementing it
let lastConnectionID = 0;

// Holds a mapping of all the react components that want their state subscribed to a store key
const callbackToStateMapping = {};

// Stores all of the keys that Onyx can use. Must be defined in init().
let onyxKeys = {};

// Holds a list of keys that have been directly subscribed to or recently modified from least to most recent
let recentlyAccessedKeys = [];

// Holds a list of keys that are safe to remove when we reach max storage. If a key does not match with
// whatever appears in this list it will NEVER be a candidate for eviction.
let evictionAllowList = [];

// Holds a map of keys and connectionID arrays whose keys will never be automatically evicted as
// long as we have at least one subscriber that returns false for the canEvict property.
const evictionBlocklist = {};

// Optional user-provided key value states set when Onyx initializes or clears
let defaultKeyStates = {};

/**
 * Get some data from the store
 *
 * @param {string} key
 * @returns {Promise<*>}
 */
function get(key) {
    // When we already have the value in cache - resolve right away
    if (cache.hasCacheForKey(key)) {
        return Promise.resolve(cache.getValue(key));
    }

    const taskName = `get:${key}`;

    // When a value retrieving task for this key is still running hook to it
    if (cache.hasPendingTask(taskName)) {
        return cache.getTaskPromise(taskName);
    }

    // Otherwise retrieve the value from storage and capture a promise to aid concurrent usages
    const promise = AsyncStorage.getItem(key)
        .then((val) => {
            const parsed = val && JSON.parse(val);
            cache.set(key, parsed);
            return parsed;
        })
        .catch(err => logInfo(`Unable to get item from persistent storage. Key: ${key} Error: ${err}`));

    return cache.captureTask(taskName, promise);
}

/**
 * Returns current key names stored in persisted storage
 * @returns {Promise<string[]>}
 */
function getAllKeys() {
    // When we've already read stored keys, resolve right away
    const storedKeys = cache.getAllKeys();
    if (storedKeys.length > 0) {
        return Promise.resolve(storedKeys);
    }

    const taskName = 'getAllKeys';

    // When a value retrieving task for all keys is still running hook to it
    if (cache.hasPendingTask(taskName)) {
        return cache.getTaskPromise(taskName);
    }

    // Otherwise retrieve the keys from storage and capture a promise to aid concurrent usages
    const promise = AsyncStorage.getAllKeys()
        .then((keys) => {
            _.each(keys, key => cache.addKey(key));
            return keys;
        });

    return cache.captureTask(taskName, promise);
}

/**
 * Checks to see if the a subscriber's supplied key
 * is associated with a collection of keys.
 *
 * @param {String} key
 * @returns {Boolean}
 */
function isCollectionKey(key) {
    return _.contains(_.values(onyxKeys.COLLECTION), key);
}

/**
 * Find the collection a collection item belongs to
 * or return null if them item is not a part of a collection
 * @param {string} key
 * @returns {string|null}
 */
function getCollectionKeyForItem(key) {
    return _.chain(onyxKeys.COLLECTION)
        .values()
        .find(name => key.startsWith(name))
        .value();
}

/**
 * Checks to see if a given key matches with the
 * configured key of our connected subscriber
 *
 * @param {String} configKey
 * @param {String} key
 * @return {Boolean}
 */
function isKeyMatch(configKey, key) {
    return isCollectionKey(configKey)
        ? Str.startsWith(key, configKey)
        : configKey === key;
}

/**
 * Checks to see if this key has been flagged as
 * safe for removal.
 *
 * @param {String} testKey
 * @returns {Boolean}
 */
function isSafeEvictionKey(testKey) {
    return _.some(evictionAllowList, key => isKeyMatch(key, testKey));
}

/**
 * Remove a key from the recently accessed key list.
 *
 * @param {String} key
 */
function removeLastAccessedKey(key) {
    recentlyAccessedKeys = _.without(recentlyAccessedKeys, key);
}

/**
 * Add a key to the list of recently accessed keys. The least
 * recently accessed key should be at the head and the most
 * recently accessed key at the tail.
 *
 * @param {String} key
 */
function addLastAccessedKey(key) {
    // Only specific keys belong in this list since we cannot remove an entire collection.
    if (isCollectionKey(key) || !isSafeEvictionKey(key)) {
        return;
    }

    removeLastAccessedKey(key);
    recentlyAccessedKeys.push(key);
}

/**
 * Removes a key previously added to this list
 * which will enable it to be deleted again.
 *
 * @param {String} key
 * @param {Number} connectionID
 */
function removeFromEvictionBlockList(key, connectionID) {
    evictionBlocklist[key] = _.without(evictionBlocklist[key] || [], connectionID);

    // Remove the key if there are no more subscribers
    if (evictionBlocklist[key].length === 0) {
        delete evictionBlocklist[key];
    }
}

/**
 * Keys added to this list can never be deleted.
 *
 * @param {String} key
 * @param {Number} connectionID
 */
function addToEvictionBlockList(key, connectionID) {
    removeFromEvictionBlockList(key, connectionID);

    if (!evictionBlocklist[key]) {
        evictionBlocklist[key] = [];
    }

    evictionBlocklist[key].push(connectionID);
}

/**
 * Take all the keys that are safe to evict and add them to
 * the recently accessed list when initializing the app. This
 * enables keys that have not recently been accessed to be
 * removed.
 */
function addAllSafeEvictionKeysToRecentlyAccessedList() {
    getAllKeys()
        .then((keys) => {
            _.each(evictionAllowList, (safeEvictionKey) => {
                _.each(keys, (key) => {
                    if (isKeyMatch(safeEvictionKey, key)) {
                        addLastAccessedKey(key);
                    }
                });
            });
        });
}

/**
 * When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks
 *
 * @param {String} collectionKey
 * @param {Object} collection
 */
function keysChanged(collectionKey, collection) {
    // Find all subscribers that were added with connect() and trigger the callback or setState() with the new data
    _.each(callbackToStateMapping, (subscriber) => {
        if (!subscriber) {
            return;
        }

        const isSubscribedToCollectionKey = isKeyMatch(subscriber.key, collectionKey)
            && isCollectionKey(subscriber.key);
        const isSubscribedToCollectionMemberKey = subscriber.key.startsWith(collectionKey);

        if (isSubscribedToCollectionKey) {
            if (_.isFunction(subscriber.callback)) {
                _.each(collection, (data, dataKey) => {
                    subscriber.callback(data, dataKey);
                });
            } else if (subscriber.withOnyxInstance) {
                subscriber.withOnyxInstance.setState((prevState) => {
                    const finalCollection = _.clone(prevState[subscriber.statePropertyName] || {});
                    _.each(collection, (data, dataKey) => {
                        if (finalCollection[dataKey]) {
                            lodashMerge(finalCollection[dataKey], data);
                        } else {
                            finalCollection[dataKey] = data;
                        }
                    });

                    return {
                        [subscriber.statePropertyName]: finalCollection,
                    };
                });
            }
        } else if (isSubscribedToCollectionMemberKey) {
            const dataFromCollection = collection[subscriber.key];

            // If `dataFromCollection` happens to not exist, then return early so that there are no unnecessary
            // re-renderings of the component
            if (_.isUndefined(dataFromCollection)) {
                return;
            }

            subscriber.withOnyxInstance.setState(prevState => ({
                [subscriber.statePropertyName]: _.isObject(dataFromCollection)
                    ? {
                        ...prevState[subscriber.statePropertyName],
                        ...dataFromCollection,
                    }
                    : dataFromCollection,
            }));
        }
    });
}

/**
 * When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks
 *
 * @param {string} key
 * @param {mixed} data
 */
function keyChanged(key, data) {
    // Add or remove this key from the recentlyAccessedKeys lists
    if (!_.isNull(data)) {
        addLastAccessedKey(key);
    } else {
        removeLastAccessedKey(key);
    }

    // Find all subscribers that were added with connect() and trigger the callback or setState() with the new data
    _.each(callbackToStateMapping, (subscriber) => {
        if (subscriber && isKeyMatch(subscriber.key, key)) {
            if (_.isFunction(subscriber.callback)) {
                subscriber.callback(data, key);
            }

            if (!subscriber.withOnyxInstance) {
                return;
            }

            // Check if we are subscribing to a collection key and add this item as a collection
            if (isCollectionKey(subscriber.key)) {
                subscriber.withOnyxInstance.setState((prevState) => {
                    const collection = _.clone(prevState[subscriber.statePropertyName] || {});
                    collection[key] = data;
                    return {
                        [subscriber.statePropertyName]: collection,
                    };
                });
            } else {
                subscriber.withOnyxInstance.setState({
                    [subscriber.statePropertyName]: data,
                });
            }
        }
    });
}

/**
 * Sends the data obtained from the keys to the connection. It either:
 *     - sets state on the withOnyxInstances
 *     - triggers the callback function
 *
 * @param {object} config
 * @param {object} [config.withOnyxInstance]
 * @param {string} [config.statePropertyName]
 * @param {function} [config.callback]
 * @param {*|null} val
 * @param {String} key
 */
function sendDataToConnection(config, val, key) {
    if (config.withOnyxInstance) {
        config.withOnyxInstance.setState({
            [config.statePropertyName]: val,
        });
    } else if (_.isFunction(config.callback)) {
        config.callback(val, key);
    }
}

/**
 * Subscribes a react component's state directly to a store key
 *
 * @param {object} mapping the mapping information to connect Onyx to the components state
 * @param {string} mapping.key
 * @param {string} mapping.statePropertyName the name of the property in the state to connect the data to
 * @param {object} [mapping.withOnyxInstance] whose setState() method will be called with any changed data
 *      This is used by React components to connect to Onyx
 * @param {object} [mapping.callback] a method that will be called with changed data
 *      This is used by any non-React code to connect to Onyx
 * @param {boolean} [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
 *  component
 * @returns {number} an ID to use when calling disconnect
 */
function connect(mapping) {
    const connectionID = lastConnectionID++;
    callbackToStateMapping[connectionID] = mapping;

    if (mapping.initWithStoredValues === false) {
        return connectionID;
    }

    // Check to see if this key is flagged as a safe eviction key and add it to the recentlyAccessedKeys list
    if (mapping.withOnyxInstance && !isCollectionKey(mapping.key) && isSafeEvictionKey(mapping.key)) {
        // All React components subscribing to a key flagged as a safe eviction
        // key must implement the canEvict property.
        if (_.isUndefined(mapping.canEvict)) {
            // eslint-disable-next-line max-len
            throw new Error(`Cannot subscribe to safe eviction key '${mapping.key}' without providing a canEvict value.`);
        }
        addLastAccessedKey(mapping.key);
    }

    getAllKeys()
        .then((keys) => {
            // Find all the keys matched by the config key
            const matchingKeys = _.filter(keys, key => isKeyMatch(mapping.key, key));

            // If the key being connected to does not exist, initialize the value with null
            if (matchingKeys.length === 0) {
                sendDataToConnection(mapping, null);
                return;
            }

            // When using a callback subscriber we will trigger the callback
            // for each key we find. It's up to the subscriber to know whether
            // to expect a single key or multiple keys in the case of a collection.
            // React components are an exception since we'll want to send their
            // initial data as a single object when using collection keys.
            if (mapping.withOnyxInstance && isCollectionKey(mapping.key)) {
                Promise.all(_.map(matchingKeys, key => get(key)))
                    .then(values => _.reduce(values, (finalObject, value, i) => ({
                        ...finalObject,
                        [matchingKeys[i]]: value,
                    }), {}))
                    .then(val => sendDataToConnection(mapping, val));
            } else {
                _.each(matchingKeys, (key) => {
                    get(key).then(val => sendDataToConnection(mapping, val, key));
                });
            }
        });

    return connectionID;
}

/**
 * Remove cache items that are no longer connected through Onyx
 * @param {string} key
 */
function cleanCache(key) {
    const hasRemainingConnections = _.some(callbackToStateMapping, {key});

    // When the key is still used in other places don't remove it from cache
    if (hasRemainingConnections) {
        return;
    }

    // When this is a collection - also recursively remove any unused individual items
    if (isCollectionKey(key)) {
        cache.drop(key);

        getAllKeys().then(cachedKeys => _.chain(cachedKeys)
            .filter(name => name.startsWith(key))
            .forEach(cleanCache));

        return;
    }

    // When this is a collection item - check if the collection is still used
    const collectionKey = getCollectionKeyForItem(key);
    if (collectionKey) {
        // When there's an active subscription for a collection don't remove the item
        const hasRemainingConnectionsForCollection = _.some(callbackToStateMapping, {key: collectionKey});
        if (hasRemainingConnectionsForCollection) {
            return;
        }
    }

    // Otherwise remove the value from cache
    cache.drop(key);
}

/**
 * Remove the listener for a react component
 *
 * @param {Number} connectionID
 * @param {String} [keyToRemoveFromEvictionBlocklist]
 */
function disconnect(connectionID, keyToRemoveFromEvictionBlocklist) {
    if (!callbackToStateMapping[connectionID]) {
        return;
    }

    // Remove this key from the eviction block list as we are no longer
    // subscribing to it and it should be safe to delete again
    if (keyToRemoveFromEvictionBlocklist) {
        removeFromEvictionBlockList(keyToRemoveFromEvictionBlocklist, connectionID);
    }

    const key = callbackToStateMapping[connectionID].key;
    delete callbackToStateMapping[connectionID];

    // When the last subscriber disconnects, drop cache as well
    cleanCache(key);
}

/**
 * Remove a key from Onyx and update the subscribers
 *
 * @param {String} key
 * @return {Promise}
 */
function remove(key) {
    // Cache the fact that the value was removed
    cache.set(key, null);

    // Optimistically inform subscribers on the next tick
    Promise.resolve().then(() => keyChanged(key, null));

    return AsyncStorage.removeItem(key);
}

/**
 * If we fail to set or merge we must handle this by
 * evicting some data from Onyx and then retrying to do
 * whatever it is we attempted to do.
 *
 * @param {Error} error
 * @param {Function} ionMethod
 * @param  {...any} args
 * @return {Promise}
 */
function evictStorageAndRetry(error, ionMethod, ...args) {
    // Find the first key that we can remove that has no subscribers in our blocklist
    const keyForRemoval = _.find(recentlyAccessedKeys, key => !evictionBlocklist[key]);

    if (!keyForRemoval) {
        logAlert('Out of storage. But found no acceptable keys to remove.');
        throw error;
    }

    // Remove the least recently viewed key that is not currently being accessed and retry.
    logInfo(`Out of storage. Evicting least recently accessed key (${keyForRemoval}) and retrying.`);
    return remove(keyForRemoval)
        .then(() => ionMethod(...args));
}

/**
 * Write a value to our store with the given key
 *
 * @param {string} key
 * @param {mixed} val
 * @returns {Promise}
 */
function set(key, val) {
    // Adds the key to cache when it's not available
    cache.set(key, val);

    // Optimistically inform subscribers on the next tick
    Promise.resolve().then(() => keyChanged(key, val));

    // Write the thing to persistent storage, which will trigger a storage event for any other tabs open on this domain
    return AsyncStorage.setItem(key, JSON.stringify(val))
        .catch(error => evictStorageAndRetry(error, set, key, val));
}

/**
 * AsyncStorage expects array like: [["@MyApp_user", "value_1"], ["@MyApp_key", "value_2"]]
 * This method transforms an object like {'@MyApp_user': 'myUserValue', '@MyApp_key': 'myKeyValue'}
 * to an array of key-value pairs in the above format
 * @param {Record<string, *>} data
 * @return {Array<[string, string]>} an array of stringified key - value pairs
 */
function prepareKeyValuePairsForStorage(data) {
    return _.keys(data).map(key => [key, JSON.stringify(data[key])]);
}

/**
 * Sets multiple keys and values. Example
 * Onyx.multiSet({'key1': 'a', 'key2': 'b'});
 *
 * @param {object} data
 * @returns {Promise}
 */
function multiSet(data) {
    const keyValuePairs = prepareKeyValuePairsForStorage(data);

    _.each(data, (val, key) => {
        // Update cache and optimistically inform subscribers on the next tick
        cache.set(key, val);
        Promise.resolve().then(() => keyChanged(key, val));
    });

    return AsyncStorage.multiSet(keyValuePairs)
        .catch(error => evictStorageAndRetry(error, multiSet, data));
}

// Key/value store of Onyx key and arrays of values to merge
const mergeQueue = {};

/**
 * Given an Onyx key and value this method will combine all queued
 * value updates and return a single value. Merge attempts are
 * batched. They must occur after a single call to get() so we
 * can avoid race conditions.
 *
 * @param {String} key
 * @param {*} data
 *
 * @returns {*}
 */
function applyMerge(key, data) {
    const mergeValues = mergeQueue[key];
    if (_.isArray(data) || _.every(mergeValues, _.isArray)) {
        // Array values will always just concatenate
        // more items onto the end of the array
        return _.reduce(mergeValues, (modifiedData, mergeValue) => [
            ...modifiedData,
            ...mergeValue,
        ], data || []);
    }

    if (_.isObject(data) || _.every(mergeValues, _.isObject)) {
        // Object values are merged one after the other
        return _.reduce(mergeValues, (modifiedData, mergeValue) => {
            const newData = lodashMerge({}, modifiedData, mergeValue);

            // We will also delete any object keys that are undefined or null.
            // Deleting keys is not supported by AsyncStorage so we do it this way.
            // Remove all first level keys that are explicitly set to null.
            return _.omit(newData, (value, finalObjectKey) => _.isNull(mergeValue[finalObjectKey]));
        }, data || {});
    }

    // If we have anything else we can't merge it so we'll
    // simply return the last value that was queued
    return _.last(mergeValues);
}

/**
 * Merge a new value into an existing value at a key
 *
 * @param {string} key
 * @param {*} val
 * @returns {Promise}
 */
function merge(key, val) {
    if (mergeQueue[key]) {
        mergeQueue[key].push(val);
        return Promise.resolve();
    }

    mergeQueue[key] = [val];
    return get(key)
        .then((data) => {
            const modifiedData = applyMerge(key, data);

            // Clean up the write queue so we
            // don't apply these changes again
            delete mergeQueue[key];
            return set(key, modifiedData);
        });
}

/**
 * Merge user provided default key value pairs.
 */
function initializeWithDefaultKeyStates() {
    _.each(defaultKeyStates, (state, key) => merge(key, state));
}

/**
 * Clear out all the data in the store
 *
 * @returns {Promise<void>}
 */
function clear() {
    return getAllKeys()
        .then((keys) => {
            _.each(keys, (key) => {
                keyChanged(key, null);
                cache.set(key, null);
            });
        })
        .then(AsyncStorage.clear)
        .then(initializeWithDefaultKeyStates);
}

/**
 * Merges a collection based on their keys
 *
 * @param {String} collectionKey
 * @param {Object} collection
 * @returns {Promise}
 */
function mergeCollection(collectionKey, collection) {
    // Confirm all the collection keys belong to the same parent
    _.each(collection, (data, dataKey) => {
        if (!isKeyMatch(collectionKey, dataKey)) {
            // eslint-disable-next-line max-len
            throw new Error(`Provided collection does not have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
        }
    });

    return getAllKeys()
        .then((persistedKeys) => {
            // Split to keys that exist in storage and keys that don't
            const [existingKeys, newKeys] = _.chain(collection)
                .keys()
                .partition(key => persistedKeys.includes(key))
                .value();

            const existingKeyCollection = _.pick(collection, existingKeys);
            const newCollection = _.pick(collection, newKeys);
            const keyValuePairsForExistingCollection = prepareKeyValuePairsForStorage(existingKeyCollection);
            const keyValuePairsForNewCollection = prepareKeyValuePairsForStorage(newCollection);

            // New keys will be added via multiSet while existing keys will be updated using multiMerge
            // This is because setting a key that doesn't exist yet with multiMerge will throw errors
            const existingCollectionPromise = AsyncStorage.multiMerge(keyValuePairsForExistingCollection);
            const newCollectionPromise = AsyncStorage.multiSet(keyValuePairsForNewCollection);

            // Merge original data to cache
            cache.merge(collection);

            // Optimistically inform collection subscribers
            keysChanged(collectionKey, collection);

            return Promise.all([existingCollectionPromise, newCollectionPromise])
                .catch(error => evictStorageAndRetry(error, mergeCollection, collection));
        });
}

/**
 * Initialize the store with actions and listening for storage events
 *
 * @param {Object} [options]
 * @param {String[]} [options.safeEvictionKeys] This is an array of keys
 * (individual or collection patterns) that when provided to Onyx are flagged
 * as "safe" for removal. Any components subscribing to these keys must also
 * implement a canEvict option. See the README for more info.
 * @param {function} registerStorageEventListener a callback when a storage event happens.
 * This applies to web platforms where the local storage emits storage events
 * across all open tabs and allows Onyx to stay in sync across all open tabs.
 * @param {Boolean} [options.captureMetrics]
 */
function init({
    keys,
    initialKeyStates,
    safeEvictionKeys,
    registerStorageEventListener,
    captureMetrics = false,
}) {
    if (captureMetrics) {
        // The code here is only bundled and applied when the captureMetrics is set
        // eslint-disable-next-line no-use-before-define
        applyDecorators();
    }

    // Let Onyx know about all of our keys
    onyxKeys = keys;

    // Set our default key states to use when initializing and clearing Onyx data
    defaultKeyStates = initialKeyStates;

    // Let Onyx know about which keys are safe to evict
    evictionAllowList = safeEvictionKeys;
    addAllSafeEvictionKeysToRecentlyAccessedList();

    // Initialize all of our keys with data provided
    initializeWithDefaultKeyStates();

    // Update any key whose value changes in storage
    registerStorageEventListener((key, newValue) => {
        cache.set(key, newValue);
        keyChanged(key, newValue);
    });
}

const Onyx = {
    connect,
    disconnect,
    set,
    multiSet,
    merge,
    mergeCollection,
    clear,
    init,
    registerLogger,
    addToEvictionBlockList,
    removeFromEvictionBlockList,
    isSafeEvictionKey,
};

/**
 * Apply calls statistic decorators to benchmark Onyx
 */
function applyDecorators() {
    // We're requiring the script dynamically here so that it's only evaluated when decorators are used
    const decorate = require('./decorateWithMetrics');

    // Re-assign with decorated functions
    /* eslint-disable no-func-assign */
    get = decorate.decorateWithMetrics(get, 'Onyx:get');
    set = decorate.decorateWithMetrics(set, 'Onyx:set');
    multiSet = decorate.decorateWithMetrics(multiSet, 'Onyx:multiSet');
    clear = decorate.decorateWithMetrics(clear, 'Onyx:clear');
    merge = decorate.decorateWithMetrics(merge, 'Onyx:merge');
    mergeCollection = decorate.decorateWithMetrics(mergeCollection, 'Onyx:mergeCollection');
    getAllKeys = decorate.decorateWithMetrics(getAllKeys, 'Onyx:getAllKeys');
    /* eslint-enable */

    // Re-expose decorated methods
    Onyx.set = set;
    Onyx.multiSet = multiSet;
    Onyx.clear = clear;
    Onyx.merge = merge;
    Onyx.mergeCollection = mergeCollection;

    // Expose stats methods on Onyx
    Onyx.getMetrics = decorate.getMetrics;
    Onyx.resetMetrics = decorate.resetMetrics;
    Onyx.printMetrics = decorate.printMetrics;
}

export default Onyx;
