/* eslint-disable no-continue */
import {deepEqual} from 'fast-equals';
import _ from 'underscore';
import * as Logger from './Logger';
import cache from './OnyxCache';
import * as Str from './Str';
import * as PerformanceUtils from './PerformanceUtils';
import Storage from './storage';
import utils from './utils';
import unstable_batchedUpdates from './batch';
import DevTools from './DevTools';

// Method constants
const METHOD = {
    SET: 'set',
    MERGE: 'merge',
    MERGE_COLLECTION: 'mergecollection',
    MULTI_SET: 'multiset',
    CLEAR: 'clear',
};

// Key/value store of Onyx key and arrays of values to merge
const mergeQueue = {};
const mergeQueuePromise = {};

// Holds a mapping of all the react components that want their state subscribed to a store key
const callbackToStateMapping = {};

// Keeps a copy of the values of the onyx collection keys as a map for faster lookups
let onyxCollectionKeyMap = new Map();

// Holds a mapping of the connected key to the connectionID for faster lookups
const onyxKeyToConnectionIDs = new Map();

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

let batchUpdatesPromise = null;
let batchUpdatesQueue = [];

/**
 * Getter - returns the merge queue.
 *
 * @returns {Object} The callback to state mapping.
 */
function getMergeQueue() {
    return mergeQueue;
}

/**
 * Getter - returns the merge queue promise.
 *
 * @returns {Object} The callback to state mapping.
 */
function getMergeQueuePromise() {
    return mergeQueuePromise;
}

/**
 * Getter - returns the callback to state mapping.
 *
 * @returns {Object} The callback to state mapping.
 */
function getCallbackToStateMapping() {
    return callbackToStateMapping;
}

/**
 * Getter - returns the default key states.
 *
 * @returns {Object} The callback to state mapping.
 */
function getDefaultKeyStates() {
    return defaultKeyStates;
}

/**
 * Sets the initial values for the Onyx store
 *
 * @param {Object} keys - `ONYXKEYS` constants object from Onyx.init()
 * @param {Object} initialKeyStates - initial data to set when `init()` and `clear()` are called
 * @param {Array<String>} safeEvictionKeys - This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal.
 */
function initStoreValues(keys, initialKeyStates, safeEvictionKeys) {
    // We need the value of the collection keys later for checking if a
    // key is a collection. We store it in a map for faster lookup.
    const collectionValues = _.values(keys.COLLECTION);
    onyxCollectionKeyMap = _.reduce(
        collectionValues,
        (acc, val) => {
            acc.set(val, true);
            return acc;
        },
        new Map(),
    );

    // Set our default key states to use when initializing and clearing Onyx data
    defaultKeyStates = initialKeyStates;

    DevTools.initState(initialKeyStates);

    // Let Onyx know about which keys are safe to evict
    evictionAllowList = safeEvictionKeys;
}

/**
 * Sends an action to DevTools extension
 *
 * @param {string} method - Onyx method from METHOD
 * @param {string} key - Onyx key that was changed
 * @param {any} value - contains the change that was made by the method
 * @param {any} mergedValue - (optional) value that was written in the storage after a merge method was executed.
 */
function sendActionToDevTools(method, key, value, mergedValue = undefined) {
    DevTools.registerAction(utils.formatActionName(method, key), value, key ? {[key]: mergedValue || value} : value);
}

/**
 * We are batching together onyx updates. This helps with use cases where we schedule onyx updates after each other.
 * This happens for example in the Onyx.update function, where we process API responses that might contain a lot of
 * update operations. Instead of calling the subscribers for each update operation, we batch them together which will
 * cause react to schedule the updates at once instead of after each other. This is mainly a performance optimization.
 * @returns {Promise}
 */
function maybeFlushBatchUpdates() {
    if (batchUpdatesPromise) {
        return batchUpdatesPromise;
    }

    batchUpdatesPromise = new Promise((resolve) => {
        /* We use (setTimeout, 0) here which should be called once native module calls are flushed (usually at the end of the frame)
         * We may investigate if (setTimeout, 1) (which in React Native is equal to requestAnimationFrame) works even better
         * then the batch will be flushed on next frame.
         */
        setTimeout(() => {
            const updatesCopy = batchUpdatesQueue;
            batchUpdatesQueue = [];
            batchUpdatesPromise = null;
            unstable_batchedUpdates(() => {
                updatesCopy.forEach((applyUpdates) => {
                    applyUpdates();
                });
            });

            resolve();
        }, 0);
    });
    return batchUpdatesPromise;
}

function batchUpdates(updates) {
    batchUpdatesQueue.push(updates);
    return maybeFlushBatchUpdates();
}

/**
 * Uses a selector function to return a simplified version of sourceData
 * @param {Mixed} sourceData
 * @param {Function} selector Function that takes sourceData and returns a simplified version of it
 * @param {Object} [withOnyxInstanceState]
 * @returns {Mixed}
 */
const getSubsetOfData = (sourceData, selector, withOnyxInstanceState) => selector(sourceData, withOnyxInstanceState);

/**
 * Takes a collection of items (eg. {testKey_1:{a:'a'}, testKey_2:{b:'b'}})
 * and runs it through a reducer function to return a subset of the data according to a selector.
 * The resulting collection will only contain items that are returned by the selector.
 * @param {Object} collection
 * @param {String|Function} selector (see method docs for getSubsetOfData() for full details)
 * @param {Object} [withOnyxInstanceState]
 * @returns {Object}
 */
const reduceCollectionWithSelector = (collection, selector, withOnyxInstanceState) =>
    _.reduce(
        collection,
        (finalCollection, item, key) => {
            // eslint-disable-next-line no-param-reassign
            finalCollection[key] = getSubsetOfData(item, selector, withOnyxInstanceState);

            return finalCollection;
        },
        {},
    );

/**
 * Get some data from the store
 *
 * @private
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
    const promise = Storage.getItem(key)
        .then((val) => {
            cache.set(key, val);
            return val;
        })
        .catch((err) => Logger.logInfo(`Unable to get item from persistent storage. Key: ${key} Error: ${err}`));

    return cache.captureTask(taskName, promise);
}

/**
 * Returns current key names stored in persisted storage
 * @private
 * @returns {Promise<Set<Key>>}
 */
function getAllKeys() {
    // When we've already read stored keys, resolve right away
    const storedKeys = cache.getAllKeys();
    if (storedKeys.size > 0) {
        return Promise.resolve(storedKeys);
    }

    const taskName = 'getAllKeys';

    // When a value retrieving task for all keys is still running hook to it
    if (cache.hasPendingTask(taskName)) {
        return cache.getTaskPromise(taskName);
    }

    // Otherwise retrieve the keys from storage and capture a promise to aid concurrent usages
    const promise = Storage.getAllKeys().then((keys) => {
        cache.setAllKeys(keys);
        // return the updated set of keys
        return cache.getAllKeys();
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
    return onyxCollectionKeyMap.has(key);
}

/**
 * @param {String} collectionKey
 * @param {String} key
 * @returns {Boolean}
 */
function isCollectionMemberKey(collectionKey, key) {
    return Str.startsWith(key, collectionKey) && key.length > collectionKey.length;
}

/**
 * Splits a collection member key into the collection key part and the ID part.
 * @param {String} key - The collection member key to split.
 * @returns {Array<String>} A tuple where the first element is the collection part and the second element is the ID part.
 */
function splitCollectionMemberKey(key) {
    const underscoreIndex = key.indexOf('_');

    if (underscoreIndex === -1) {
        throw new Error(`Invalid ${key} key provided, only collection keys are allowed.`);
    }

    return [key.substring(0, underscoreIndex + 1), key.substring(underscoreIndex + 1)];
}

/**
 * Checks to see if a provided key is the exact configured key of our connected subscriber
 * or if the provided key is a collection member key (in case our configured key is a "collection key")
 *
 * @private
 * @param {String} configKey
 * @param {String} key
 * @return {Boolean}
 */
function isKeyMatch(configKey, key) {
    return isCollectionKey(configKey) ? Str.startsWith(key, configKey) : configKey === key;
}

/**
 * Checks to see if this key has been flagged as
 * safe for removal.
 *
 * @private
 * @param {String} testKey
 * @returns {Boolean}
 */
function isSafeEvictionKey(testKey) {
    return _.some(evictionAllowList, (key) => isKeyMatch(key, testKey));
}

function storeKeyByConnections(key, connectionID) {
    if (!onyxKeyToConnectionIDs.has(key)) {
        onyxKeyToConnectionIDs.set(key, []);
    }
    onyxKeyToConnectionIDs.get(key).push(connectionID);
}

function deleteKeyByConnections(connectionID) {
    const subscriber = callbackToStateMapping[connectionID];

    if (subscriber && onyxKeyToConnectionIDs.has(subscriber.key)) {
        onyxKeyToConnectionIDs.set(subscriber.key, _.without(onyxKeyToConnectionIDs.get(subscriber.key), connectionID));
    }
}

/**
 * Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
 * If the requested key is a collection, it will return an object with all the collection members.
 *
 * @param {String} key
 * @param {Object} mapping
 * @returns {Mixed}
 */
function tryGetCachedValue(key, mapping = {}) {
    let val = cache.getValue(key);

    if (isCollectionKey(key)) {
        const allCacheKeys = cache.getAllKeys();

        // It is possible we haven't loaded all keys yet so we do not know if the
        // collection actually exists.
        if (allCacheKeys.size === 0) {
            return;
        }

        const matchingKeys = [];
        allCacheKeys.forEach((k) => {
            if (!k.startsWith(key)) {
                return;
            }
            matchingKeys.push(k);
        });

        const values = _.reduce(
            matchingKeys,
            (finalObject, matchedKey) => {
                const cachedValue = cache.getValue(matchedKey);
                if (cachedValue) {
                    // This is permissible because we're in the process of constructing the final object in a reduce function.
                    // eslint-disable-next-line no-param-reassign
                    finalObject[matchedKey] = cachedValue;
                }
                return finalObject;
            },
            {},
        );

        val = values;
    }

    if (mapping.selector) {
        const state = mapping.withOnyxInstance ? mapping.withOnyxInstance.state : undefined;
        if (isCollectionKey(key)) {
            return reduceCollectionWithSelector(val, mapping.selector, state);
        }
        return getSubsetOfData(val, mapping.selector, state);
    }

    return val;
}

/**
 * Remove a key from the recently accessed key list.
 *
 * @private
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
 * @private
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
 * @private
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
 * @private
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

function getPureKey(key) {
    if (!key) {
        return '';
    }
    return key.replace(/\d+/g, '');
}

/**
 * Take all the keys that are safe to evict and add them to
 * the recently accessed list when initializing the app. This
 * enables keys that have not recently been accessed to be
 * removed.
 *
 * @private
 * @returns {Promise}
 */
function addAllSafeEvictionKeysToRecentlyAccessedList() {
    return getAllKeys().then((keys) => {
        _.each(evictionAllowList, (safeEvictionKey) => {
            keys.forEach((key) => {
                if (!isKeyMatch(safeEvictionKey, key)) {
                    return;
                }
                addLastAccessedKey(key);
            });
        });
    });
}

/**
 * @private
 * @param {String} collectionKey
 * @returns {Object}
 */
function getCachedCollection(collectionKey) {
    const collectionMemberKeys = [];
    cache.getAllKeys().forEach((storedKey) => {
        if (!isCollectionMemberKey(collectionKey, storedKey)) {
            return;
        }
        collectionMemberKeys.push(storedKey);
    });
    return _.reduce(
        collectionMemberKeys,
        (prev, curr) => {
            const cachedValue = cache.getValue(curr);
            if (!cachedValue) {
                return prev;
            }

            // eslint-disable-next-line no-param-reassign
            prev[curr] = cachedValue;
            return prev;
        },
        {},
    );
}

/**
 * When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks
 *
 * @private
 * @param {String} collectionKey
 * @param {Object} partialCollection - a partial collection of grouped member keys
 * @param {boolean} [notifyRegularSubscibers=true]
 * @param {boolean} [notifyWithOnyxSubscibers=true]
 */
function keysChanged(collectionKey, partialCollection, notifyRegularSubscibers = true, notifyWithOnyxSubscibers = true) {
    // We are iterating over all subscribers similar to keyChanged(). However, we are looking for subscribers who are subscribing to either a collection key or
    // individual collection key member for the collection that is being updated. It is important to note that the collection parameter cane be a PARTIAL collection
    // and does not represent all of the combined keys and values for a collection key. It is just the "new" data that was merged in via mergeCollection().
    const stateMappingKeys = onyxKeyToConnectionIDs.get(collectionKey);

    // If the key was not found in the mapping then we can skip notifying subscribers
    if (!stateMappingKeys) {
        return;
    }
    for (let i = 0; i < stateMappingKeys.length; i++) {
        const subscriber = callbackToStateMapping[stateMappingKeys[i]];
        if (!subscriber) {
            continue;
        }

        // Skip iteration if we do not have a collection key or a collection member key on this subscriber
        if (!Str.startsWith(subscriber.key, collectionKey)) {
            continue;
        }

        /**
         * e.g. Onyx.connect({key: ONYXKEYS.COLLECTION.REPORT, callback: ...});
         */
        const isSubscribedToCollectionKey = subscriber.key === collectionKey;

        /**
         * e.g. Onyx.connect({key: `${ONYXKEYS.COLLECTION.REPORT}{reportID}`, callback: ...});
         */
        const isSubscribedToCollectionMemberKey = isCollectionMemberKey(collectionKey, subscriber.key);

        // We prepare the "cached collection" which is the entire collection + the new partial data that
        // was merged in via mergeCollection().
        const cachedCollection = getCachedCollection(collectionKey);

        // Regular Onyx.connect() subscriber found.
        if (_.isFunction(subscriber.callback)) {
            if (!notifyRegularSubscibers) {
                continue;
            }

            // If they are subscribed to the collection key and using waitForCollectionCallback then we'll
            // send the whole cached collection.
            if (isSubscribedToCollectionKey) {
                if (subscriber.waitForCollectionCallback) {
                    subscriber.callback(cachedCollection);
                    continue;
                }

                // If they are not using waitForCollectionCallback then we notify the subscriber with
                // the new merged data but only for any keys in the partial collection.
                const dataKeys = _.keys(partialCollection);
                for (let j = 0; j < dataKeys.length; j++) {
                    const dataKey = dataKeys[j];
                    subscriber.callback(cachedCollection[dataKey], dataKey);
                }
                continue;
            }

            // And if the subscriber is specifically only tracking a particular collection member key then we will
            // notify them with the cached data for that key only.
            if (isSubscribedToCollectionMemberKey) {
                subscriber.callback(cachedCollection[subscriber.key], subscriber.key);
                continue;
            }

            continue;
        }

        // React component subscriber found.
        if (subscriber.withOnyxInstance) {
            if (!notifyWithOnyxSubscibers) {
                continue;
            }

            // We are subscribed to a collection key so we must update the data in state with the new
            // collection member key values from the partial update.
            if (isSubscribedToCollectionKey) {
                // If the subscriber has a selector, then the component's state must only be updated with the data
                // returned by the selector.
                if (subscriber.selector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const previousData = prevState[subscriber.statePropertyName];
                        const newData = reduceCollectionWithSelector(cachedCollection, subscriber.selector, subscriber.withOnyxInstance.state);

                        if (!deepEqual(previousData, newData)) {
                            return {
                                [subscriber.statePropertyName]: newData,
                            };
                        }
                        return null;
                    });
                    continue;
                }

                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const finalCollection = _.clone(prevState[subscriber.statePropertyName] || {});
                    const dataKeys = _.keys(partialCollection);
                    for (let j = 0; j < dataKeys.length; j++) {
                        const dataKey = dataKeys[j];
                        finalCollection[dataKey] = cachedCollection[dataKey];
                    }

                    PerformanceUtils.logSetStateCall(subscriber, prevState[subscriber.statePropertyName], finalCollection, 'keysChanged', collectionKey);
                    return {
                        [subscriber.statePropertyName]: finalCollection,
                    };
                });
                continue;
            }

            // If a React component is only interested in a single key then we can set the cached value directly to the state name.
            if (isSubscribedToCollectionMemberKey) {
                // However, we only want to update this subscriber if the partial data contains a change.
                // Otherwise, we would update them with a value they already have and trigger an unnecessary re-render.
                const dataFromCollection = partialCollection[subscriber.key];
                if (_.isUndefined(dataFromCollection)) {
                    continue;
                }

                // If the subscriber has a selector, then the component's state must only be updated with the data
                // returned by the selector and the state should only change when the subset of data changes from what
                // it was previously.
                if (subscriber.selector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const prevData = prevState[subscriber.statePropertyName];
                        const newData = getSubsetOfData(cachedCollection[subscriber.key], subscriber.selector, subscriber.withOnyxInstance.state);
                        if (!deepEqual(prevData, newData)) {
                            PerformanceUtils.logSetStateCall(subscriber, prevData, newData, 'keysChanged', collectionKey);
                            return {
                                [subscriber.statePropertyName]: newData,
                            };
                        }

                        return null;
                    });
                    continue;
                }

                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const data = cachedCollection[subscriber.key];
                    const previousData = prevState[subscriber.statePropertyName];

                    // Avoids triggering unnecessary re-renders when feeding empty objects
                    if (utils.isEmptyObject(data) && utils.isEmptyObject(previousData)) {
                        return null;
                    }
                    if (data === previousData) {
                        return null;
                    }

                    PerformanceUtils.logSetStateCall(subscriber, previousData, data, 'keysChanged', collectionKey);
                    return {
                        [subscriber.statePropertyName]: data,
                    };
                });
            }
        }
    }
}

/**
 * When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks
 *
 * @example
 * keyChanged(key, value, subscriber => subscriber.initWithStoredValues === false)
 *
 * @private
 * @param {String} key
 * @param {*} data
 * @param {*} prevData
 * @param {Function} [canUpdateSubscriber] only subscribers that pass this truth test will be updated
 * @param {boolean} [notifyRegularSubscibers=true]
 * @param {boolean} [notifyWithOnyxSubscibers=true]
 */
function keyChanged(key, data, prevData, canUpdateSubscriber = () => true, notifyRegularSubscibers = true, notifyWithOnyxSubscibers = true) {
    // Add or remove this key from the recentlyAccessedKeys lists
    if (!_.isNull(data)) {
        addLastAccessedKey(key);
    } else {
        removeLastAccessedKey(key);
    }

    // We are iterating over all subscribers to see if they are interested in the key that has just changed. If the subscriber's  key is a collection key then we will
    // notify them if the key that changed is a collection member. Or if it is a regular key notify them when there is an exact match. Depending on whether the subscriber
    // was connected via withOnyx we will call setState() directly on the withOnyx instance. If it is a regular connection we will pass the data to the provided callback.
    let stateMappingKeys = onyxKeyToConnectionIDs.get(key);

    if (!stateMappingKeys) {
        // Getting the collection key from the specific key 'cos only collection keys were stored in the mapping.
        stateMappingKeys = onyxKeyToConnectionIDs.get(getPureKey(key));
        if (!stateMappingKeys) {
            return;
        }
    }

    for (let i = 0; i < stateMappingKeys.length; i++) {
        const subscriber = callbackToStateMapping[stateMappingKeys[i]];
        if (!subscriber || !isKeyMatch(subscriber.key, key) || !canUpdateSubscriber(subscriber)) {
            continue;
        }

        // Subscriber is a regular call to connect() and provided a callback
        if (_.isFunction(subscriber.callback)) {
            if (!notifyRegularSubscibers) {
                continue;
            }
            if (isCollectionKey(subscriber.key) && subscriber.waitForCollectionCallback) {
                const cachedCollection = getCachedCollection(subscriber.key);
                cachedCollection[key] = data;
                subscriber.callback(cachedCollection);
                continue;
            }

            subscriber.callback(data, key);
            continue;
        }

        // Subscriber connected via withOnyx() HOC
        if (subscriber.withOnyxInstance) {
            if (!notifyWithOnyxSubscibers) {
                continue;
            }

            // Check if we are subscribing to a collection key and overwrite the collection member key value in state
            if (isCollectionKey(subscriber.key)) {
                // If the subscriber has a selector, then the consumer of this data must only be given the data
                // returned by the selector and only when the selected data has changed.
                if (subscriber.selector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const prevWithOnyxData = prevState[subscriber.statePropertyName];
                        const newWithOnyxData = {
                            [key]: getSubsetOfData(data, subscriber.selector, subscriber.withOnyxInstance.state),
                        };
                        const prevDataWithNewData = {
                            ...prevWithOnyxData,
                            ...newWithOnyxData,
                        };
                        if (!deepEqual(prevWithOnyxData, prevDataWithNewData)) {
                            PerformanceUtils.logSetStateCall(subscriber, prevWithOnyxData, newWithOnyxData, 'keyChanged', key);
                            return {
                                [subscriber.statePropertyName]: prevDataWithNewData,
                            };
                        }
                        return null;
                    });
                    continue;
                }

                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const collection = prevState[subscriber.statePropertyName] || {};
                    const newCollection = {
                        ...collection,
                        [key]: data,
                    };
                    PerformanceUtils.logSetStateCall(subscriber, collection, newCollection, 'keyChanged', key);
                    return {
                        [subscriber.statePropertyName]: newCollection,
                    };
                });
                continue;
            }

            // If the subscriber has a selector, then the component's state must only be updated with the data
            // returned by the selector and only if the selected data has changed.
            if (subscriber.selector) {
                subscriber.withOnyxInstance.setStateProxy(() => {
                    const previousValue = getSubsetOfData(prevData, subscriber.selector, subscriber.withOnyxInstance.state);
                    const newValue = getSubsetOfData(data, subscriber.selector, subscriber.withOnyxInstance.state);

                    if (!deepEqual(previousValue, newValue)) {
                        return {
                            [subscriber.statePropertyName]: newValue,
                        };
                    }
                    return null;
                });
                continue;
            }

            // If we did not match on a collection key then we just set the new data to the state property
            subscriber.withOnyxInstance.setStateProxy((prevState) => {
                const prevWithOnyxData = prevState[subscriber.statePropertyName];

                // Avoids triggering unnecessary re-renders when feeding empty objects
                if (utils.isEmptyObject(data) && utils.isEmptyObject(prevWithOnyxData)) {
                    return null;
                }
                if (prevWithOnyxData === data) {
                    return null;
                }

                PerformanceUtils.logSetStateCall(subscriber, prevData, data, 'keyChanged', key);
                return {
                    [subscriber.statePropertyName]: data,
                };
            });
            continue;
        }

        console.error('Warning: Found a matching subscriber to a key that changed, but no callback or withOnyxInstance could be found.');
    }
}

/**
 * Sends the data obtained from the keys to the connection. It either:
 *     - sets state on the withOnyxInstances
 *     - triggers the callback function
 *
 * @private
 * @param {Object} mapping
 * @param {Object} [mapping.withOnyxInstance]
 * @param {String} [mapping.statePropertyName]
 * @param {Function} [mapping.callback]
 * @param {String} [mapping.selector]
 * @param {*|null} val
 * @param {String|undefined} matchedKey
 * @param {Boolean} isBatched
 */
function sendDataToConnection(mapping, val, matchedKey, isBatched) {
    // If the mapping no longer exists then we should not send any data.
    // This means our subscriber disconnected or withOnyx wrapped component unmounted.
    if (!callbackToStateMapping[mapping.connectionID]) {
        return;
    }

    if (mapping.withOnyxInstance) {
        let newData = val;

        // If the mapping has a selector, then the component's state must only be updated with the data
        // returned by the selector.
        if (mapping.selector) {
            if (isCollectionKey(mapping.key)) {
                newData = reduceCollectionWithSelector(val, mapping.selector, mapping.withOnyxInstance.state);
            } else {
                newData = getSubsetOfData(val, mapping.selector, mapping.withOnyxInstance.state);
            }
        }

        PerformanceUtils.logSetStateCall(mapping, null, newData, 'sendDataToConnection');
        if (isBatched) {
            batchUpdates(() => {
                mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData);
            });
        } else {
            mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData);
        }
        return;
    }

    if (_.isFunction(mapping.callback)) {
        mapping.callback(val, matchedKey);
    }
}

/**
 * We check to see if this key is flagged as safe for eviction and add it to the recentlyAccessedKeys list so that when we
 * run out of storage the least recently accessed key can be removed.
 *
 * @private
 * @param {Object} mapping
 */
function addKeyToRecentlyAccessedIfNeeded(mapping) {
    if (!isSafeEvictionKey(mapping.key)) {
        return;
    }

    // Try to free some cache whenever we connect to a safe eviction key
    cache.removeLeastRecentlyUsedKeys();

    if (mapping.withOnyxInstance && !isCollectionKey(mapping.key)) {
        // All React components subscribing to a key flagged as a safe eviction key must implement the canEvict property.
        if (_.isUndefined(mapping.canEvict)) {
            throw new Error(`Cannot subscribe to safe eviction key '${mapping.key}' without providing a canEvict value.`);
        }

        addLastAccessedKey(mapping.key);
    }
}

/**
 * Gets the data for a given an array of matching keys, combines them into an object, and sends the result back to the subscriber.
 *
 * @private
 * @param {Array} matchingKeys
 * @param {Object} mapping
 */
function getCollectionDataAndSendAsObject(matchingKeys, mapping) {
    // Keys that are not in the cache
    const missingKeys = [];
    // Tasks that are pending
    const pendingTasks = [];
    // Keys for the tasks that are pending
    const pendingKeys = [];

    // We are going to combine all the data from the matching keys into a single object
    const data = {};

    /**
     * We are going to iterate over all the matching keys and check if we have the data in the cache.
     * If we do then we add it to the data object. If we do not then we check if there is a pending task
     * for the key. If there is then we add the promise to the pendingTasks array and the key to the pendingKeys
     * array. If there is no pending task then we add the key to the missingKeys array.
     *
     * These missingKeys will be later to use to multiGet the data from the storage.
     */
    matchingKeys.forEach((key) => {
        const cacheValue = cache.getValue(key);
        if (cacheValue) {
            data[key] = cacheValue;
            return;
        }

        const pendingKey = `get:${key}`;
        if (cache.hasPendingTask(pendingKey)) {
            pendingTasks.push(cache.getTaskPromise(pendingKey));
            pendingKeys.push(key);
        } else {
            missingKeys.push(key);
        }
    });

    Promise.all(pendingTasks)
        // We are going to wait for all the pending tasks to resolve and then add the data to the data object.
        .then((values) => {
            values.forEach((value, index) => {
                data[pendingKeys[index]] = value;
            });

            return Promise.resolve();
        })
        // We are going to get the missing keys using multiGet from the storage.
        .then(() => {
            if (missingKeys.length === 0) {
                return Promise.resolve();
            }
            return Storage.multiGet(missingKeys);
        })
        // We are going to add the data from the missing keys to the data object and also merge it to the cache.
        .then((values) => {
            if (!values || values.length === 0) {
                return Promise.resolve();
            }

            // temp object is used to merge the missing data into the cache
            const temp = {};
            values.forEach((value) => {
                data[value[0]] = value[1];
                temp[value[0]] = value[1];
            });
            cache.merge(temp);
            return Promise.resolve();
        })
        // We are going to send the data to the subscriber.
        .finally(() => {
            sendDataToConnection(mapping, data, undefined, true);
        });
}

/**
 * Schedules an update that will be appended to the macro task queue (so it doesn't update the subscribers immediately).
 *
 * @example
 * scheduleSubscriberUpdate(key, value, subscriber => subscriber.initWithStoredValues === false)
 *
 * @param {String} key
 * @param {*} value
 * @param {*} prevValue
 * @param {Function} [canUpdateSubscriber] only subscribers that pass this truth test will be updated
 * @returns {Promise}
 */
function scheduleSubscriberUpdate(key, value, prevValue, canUpdateSubscriber = () => true) {
    const promise = Promise.resolve().then(() => keyChanged(key, value, prevValue, canUpdateSubscriber, true, false));
    batchUpdates(() => keyChanged(key, value, prevValue, canUpdateSubscriber, false, true));
    return Promise.all([maybeFlushBatchUpdates(), promise]);
}

/**
 * This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
 * so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
 * subscriber callbacks receive the data in a different format than they normally expect and it breaks code.
 *
 * @param {String} key
 * @param {*} value
 * @returns {Promise}
 */
function scheduleNotifyCollectionSubscribers(key, value) {
    const promise = Promise.resolve().then(() => keysChanged(key, value, true, false));
    batchUpdates(() => keysChanged(key, value, false, true));
    return Promise.all([maybeFlushBatchUpdates(), promise]);
}

/**
 * Remove a key from Onyx and update the subscribers
 *
 * @private
 * @param {String} key
 * @return {Promise}
 */
function remove(key) {
    const prevValue = cache.getValue(key, false);
    cache.drop(key);
    scheduleSubscriberUpdate(key, null, prevValue);
    return Storage.removeItem(key);
}

/**
 * @private
 * @returns {Promise<void>}
 */
function reportStorageQuota() {
    return Storage.getDatabaseSize()
        .then(({bytesUsed, bytesRemaining}) => {
            Logger.logInfo(`Storage Quota Check -- bytesUsed: ${bytesUsed} bytesRemaining: ${bytesRemaining}`);
        })
        .catch((dbSizeError) => {
            Logger.logAlert(`Unable to get database size. Error: ${dbSizeError}`);
        });
}

/**
 * If we fail to set or merge we must handle this by
 * evicting some data from Onyx and then retrying to do
 * whatever it is we attempted to do.
 *
 * @private
 * @param {Error} error
 * @param {Function} onyxMethod
 * @param  {...any} args
 * @return {Promise}
 */
function evictStorageAndRetry(error, onyxMethod, ...args) {
    Logger.logInfo(`Failed to save to storage. Error: ${error}. onyxMethod: ${onyxMethod.name}`);

    if (error && Str.startsWith(error.message, "Failed to execute 'put' on 'IDBObjectStore'")) {
        Logger.logAlert('Attempted to set invalid data set in Onyx. Please ensure all data is serializable.');
        throw error;
    }

    // Find the first key that we can remove that has no subscribers in our blocklist
    const keyForRemoval = _.find(recentlyAccessedKeys, (key) => !evictionBlocklist[key]);
    if (!keyForRemoval) {
        // If we have no acceptable keys to remove then we are possibly trying to save mission critical data. If this is the case,
        // then we should stop retrying as there is not much the user can do to fix this. Instead of getting them stuck in an infinite loop we
        // will allow this write to be skipped.
        Logger.logAlert('Out of storage. But found no acceptable keys to remove.');
        return reportStorageQuota();
    }

    // Remove the least recently viewed key that is not currently being accessed and retry.
    Logger.logInfo(`Out of storage. Evicting least recently accessed key (${keyForRemoval}) and retrying.`);
    reportStorageQuota();
    return remove(keyForRemoval).then(() => onyxMethod(...args));
}

/**
 * Notifys subscribers and writes current value to cache
 *
 * @param {String} key
 * @param {*} value
 * @param {String} method
 * @param {Boolean} hasChanged
 * @param {Boolean} wasRemoved
 * @returns {Promise}
 */
function broadcastUpdate(key, value, method, hasChanged, wasRemoved = false) {
    // Logging properties only since values could be sensitive things we don't want to log
    Logger.logInfo(`${method}() called for key: ${key}${_.isObject(value) ? ` properties: ${_.keys(value).join(',')}` : ''}`);
    const prevValue = cache.getValue(key, false);

    // Update subscribers if the cached value has changed, or when the subscriber specifically requires
    // all updates regardless of value changes (indicated by initWithStoredValues set to false).
    if (hasChanged && !wasRemoved) {
        cache.set(key, value);
    } else {
        cache.addToAccessedKeys(key);
    }

    return scheduleSubscriberUpdate(key, value, prevValue, (subscriber) => hasChanged || subscriber.initWithStoredValues === false);
}

/**
 * @param {String} key
 * @returns {Boolean}
 */
function hasPendingMergeForKey(key) {
    return Boolean(mergeQueue[key]);
}

/**
 * Removes a key from storage if the value is null.
 * Otherwise removes all nested null values in objects and returns the object
 * @param {String} key
 * @param {Mixed} value
 * @returns {Mixed} The value without null values and a boolean "wasRemoved", which indicates if the key got removed completely
 */
function removeNullValues(key, value) {
    if (_.isNull(value)) {
        remove(key);
        return {value, wasRemoved: true};
    }

    // We can remove all null values in an object by merging it with itself
    // utils.fastMerge recursively goes through the object and removes all null values
    // Passing two identical objects as source and target to fastMerge will not change it, but only remove the null values
    return {value: utils.removeNestedNullValues(value), wasRemoved: false};
}

/**
 * Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
 * This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
 * to an array of key-value pairs in the above format and removes key-value pairs that are being set to null
 * @private
 * @param {Record} data
 * @return {Array} an array of key - value pairs <[key, value]>
 */
function prepareKeyValuePairsForStorage(data) {
    const keyValuePairs = [];

    _.forEach(data, (value, key) => {
        const {value: valueAfterRemoving, wasRemoved} = removeNullValues(key, value);

        if (wasRemoved) return;

        keyValuePairs.push([key, valueAfterRemoving]);
    });

    return keyValuePairs;
}

/**
 * Merges an array of changes with an existing value
 *
 * @private
 * @param {*} existingValue
 * @param {Array<*>} changes Array of changes that should be applied to the existing value
 * @param {Boolean} shouldRemoveNullObjectValues
 * @returns {*}
 */
function applyMerge(existingValue, changes, shouldRemoveNullObjectValues) {
    const lastChange = _.last(changes);

    if (_.isArray(lastChange)) {
        return lastChange;
    }

    if (_.some(changes, _.isObject)) {
        // Object values are then merged one after the other
        return _.reduce(changes, (modifiedData, change) => utils.fastMerge(modifiedData, change, shouldRemoveNullObjectValues), existingValue || {});
    }

    // If we have anything else we can't merge it so we'll
    // simply return the last value that was queued
    return lastChange;
}

/**
 * Merge user provided default key value pairs.
 * @private
 * @returns {Promise}
 */
function initializeWithDefaultKeyStates() {
    return Storage.multiGet(_.keys(defaultKeyStates)).then((pairs) => {
        const existingDataAsObject = _.object(pairs);

        const merged = utils.fastMerge(existingDataAsObject, defaultKeyStates);
        cache.merge(merged);

        _.each(merged, (val, key) => keyChanged(key, val, existingDataAsObject));
    });
}

const OnyxUtils = {
    METHOD,
    getMergeQueue,
    getMergeQueuePromise,
    getCallbackToStateMapping,
    getDefaultKeyStates,
    initStoreValues,
    sendActionToDevTools,
    maybeFlushBatchUpdates,
    batchUpdates,
    get,
    getAllKeys,
    isCollectionKey,
    isCollectionMemberKey,
    splitCollectionMemberKey,
    isKeyMatch,
    isSafeEvictionKey,
    tryGetCachedValue,
    removeLastAccessedKey,
    addLastAccessedKey,
    removeFromEvictionBlockList,
    addToEvictionBlockList,
    addAllSafeEvictionKeysToRecentlyAccessedList,
    getCachedCollection,
    keysChanged,
    keyChanged,
    sendDataToConnection,
    addKeyToRecentlyAccessedIfNeeded,
    getCollectionDataAndSendAsObject,
    scheduleSubscriberUpdate,
    scheduleNotifyCollectionSubscribers,
    remove,
    reportStorageQuota,
    evictStorageAndRetry,
    broadcastUpdate,
    hasPendingMergeForKey,
    removeNullValues,
    prepareKeyValuePairsForStorage,
    applyMerge,
    initializeWithDefaultKeyStates,
    storeKeyByConnections,
    deleteKeyByConnections,
};

export default OnyxUtils;
