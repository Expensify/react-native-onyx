/* eslint-disable no-continue */
import {deepEqual} from 'fast-equals';
import _ from 'underscore';
import * as Logger from './Logger';
import cache from './OnyxCache';
import * as Str from './Str';
import createDeferredTask from './createDeferredTask';
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

// Keeps track of the last connectionID that was used so we can keep incrementing it
let lastConnectionID = 0;

// Holds a mapping of all the react components that want their state subscribed to a store key
const callbackToStateMapping = {};

// Keeps a copy of the values of the onyx collection keys as a map for faster lookups
let onyxCollectionKeyMap = new Map();

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

// Connections can be made before `Onyx.init`. They would wait for this task before resolving
const deferredInitTask = createDeferredTask();

let batchUpdatesPromise = null;
let batchUpdatesQueue = [];

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
    const promise = Storage.getAllKeys().then((keys) => {
        cache.setAllKeys(keys);
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
        if (allCacheKeys.length === 0) {
            return;
        }
        const matchingKeys = _.filter(allCacheKeys, (k) => k.startsWith(key));
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
            _.each(keys, (key) => {
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
    const collectionMemberKeys = _.filter(cache.getAllKeys(), (storedKey) => isCollectionMemberKey(collectionKey, storedKey));

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
    const stateMappingKeys = _.keys(callbackToStateMapping);
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
    const stateMappingKeys = _.keys(callbackToStateMapping);
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
 * Subscribes a react component's state directly to a store key
 *
 * @example
 * const connectionID = Onyx.connect({
 *     key: ONYXKEYS.SESSION,
 *     callback: onSessionChange,
 * });
 *
 * @param {Object} mapping the mapping information to connect Onyx to the components state
 * @param {String} mapping.key ONYXKEY to subscribe to
 * @param {String} [mapping.statePropertyName] the name of the property in the state to connect the data to
 * @param {Object} [mapping.withOnyxInstance] whose setState() method will be called with any changed data
 *      This is used by React components to connect to Onyx
 * @param {Function} [mapping.callback] a method that will be called with changed data
 *      This is used by any non-React code to connect to Onyx
 * @param {Boolean} [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
 *  component
 * @param {Boolean} [mapping.waitForCollectionCallback] If set to true, it will return the entire collection to the callback as a single object
 * @param {Function} [mapping.selector] THIS PARAM IS ONLY USED WITH withOnyx(). If included, this will be used to subscribe to a subset of an Onyx key's data.
 *       The sourceData and withOnyx state are passed to the selector and should return the simplified data. Using this setting on `withOnyx` can have very positive
 *       performance benefits because the component will only re-render when the subset of data changes. Otherwise, any change of data on any property would normally
 *       cause the component to re-render (and that can be expensive from a performance standpoint).
 * @param {String | Number | Boolean | Object} [mapping.initialValue] THIS PARAM IS ONLY USED WITH withOnyx().
 * If included, this will be passed to the component so that something can be rendered while data is being fetched from the DB.
 * Note that it will not cause the component to have the loading prop set to true. |
 * @returns {Number} an ID to use when calling disconnect
 */
function connect(mapping) {
    const connectionID = lastConnectionID++;
    callbackToStateMapping[connectionID] = mapping;
    callbackToStateMapping[connectionID].connectionID = connectionID;

    if (mapping.initWithStoredValues === false) {
        return connectionID;
    }

    // Commit connection only after init passes
    deferredInitTask.promise
        .then(() => addKeyToRecentlyAccessedIfNeeded(mapping))
        .then(() => {
            // Performance improvement
            // If the mapping is connected to an onyx key that is not a collection
            // we can skip the call to getAllKeys() and return an array with a single item
            if (Boolean(mapping.key) && typeof mapping.key === 'string' && !mapping.key.endsWith('_') && cache.storageKeys.has(mapping.key)) {
                return [mapping.key];
            }
            return getAllKeys();
        })
        .then((keys) => {
            // We search all the keys in storage to see if any are a "match" for the subscriber we are connecting so that we
            // can send data back to the subscriber. Note that multiple keys can match as a subscriber could either be
            // subscribed to a "collection key" or a single key.
            const matchingKeys = _.filter(keys, (key) => isKeyMatch(mapping.key, key));

            // If the key being connected to does not exist we initialize the value with null. For subscribers that connected
            // directly via connect() they will simply get a null value sent to them without any information about which key matched
            // since there are none matched. In withOnyx() we wait for all connected keys to return a value before rendering the child
            // component. This null value will be filtered out so that the connected component can utilize defaultProps.
            if (matchingKeys.length === 0) {
                if (mapping.key && !isCollectionKey(mapping.key)) {
                    cache.set(mapping.key, null);
                }

                // Here we cannot use batching because the null value is expected to be set immediately for default props
                // or they will be undefined.
                sendDataToConnection(mapping, null, undefined, false);
                return;
            }

            // When using a callback subscriber we will either trigger the provided callback for each key we find or combine all values
            // into an object and just make a single call. The latter behavior is enabled by providing a waitForCollectionCallback key
            // combined with a subscription to a collection key.
            if (_.isFunction(mapping.callback)) {
                if (isCollectionKey(mapping.key)) {
                    if (mapping.waitForCollectionCallback) {
                        getCollectionDataAndSendAsObject(matchingKeys, mapping);
                        return;
                    }

                    // We did not opt into using waitForCollectionCallback mode so the callback is called for every matching key.
                    for (let i = 0; i < matchingKeys.length; i++) {
                        get(matchingKeys[i]).then((val) => sendDataToConnection(mapping, val, matchingKeys[i], true));
                    }
                    return;
                }

                // If we are not subscribed to a collection key then there's only a single key to send an update for.
                get(mapping.key).then((val) => sendDataToConnection(mapping, val, mapping.key, true));
                return;
            }

            // If we have a withOnyxInstance that means a React component has subscribed via the withOnyx() HOC and we need to
            // group collection key member data into an object.
            if (mapping.withOnyxInstance) {
                if (isCollectionKey(mapping.key)) {
                    getCollectionDataAndSendAsObject(matchingKeys, mapping);
                    return;
                }

                // If the subscriber is not using a collection key then we just send a single value back to the subscriber
                get(mapping.key).then((val) => sendDataToConnection(mapping, val, mapping.key, true));
                return;
            }

            console.error('Warning: Onyx.connect() was found without a callback or withOnyxInstance');
        });

    // The connectionID is returned back to the caller so that it can be used to clean up the connection when it's no longer needed
    // by calling Onyx.disconnect(connectionID).
    return connectionID;
}

/**
 * Remove the listener for a react component
 * @example
 * Onyx.disconnect(connectionID);
 *
 * @param {Number} connectionID unique id returned by call to Onyx.connect()
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

    delete callbackToStateMapping[connectionID];
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
 * Write a value to our store with the given key
 *
 * @param {String} key ONYXKEY to set
 * @param {*} value value to store
 *
 * @returns {Promise}
 */
function set(key, value) {
    // If the value is null, we remove the key from storage
    const {value: valueAfterRemoving, wasRemoved} = removeNullValues(key, value);

    if (hasPendingMergeForKey(key)) {
        delete mergeQueue[key];
    }

    const hasChanged = cache.hasValueChanged(key, valueAfterRemoving);

    // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
    const updatePromise = broadcastUpdate(key, valueAfterRemoving, 'set', hasChanged, wasRemoved);

    // If the value has not changed or the key got removed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
    if (!hasChanged || wasRemoved) {
        return updatePromise;
    }

    return Storage.setItem(key, valueAfterRemoving)
        .catch((error) => evictStorageAndRetry(error, set, key, valueAfterRemoving))
        .then(() => {
            sendActionToDevTools(METHOD.SET, key, valueAfterRemoving);
            return updatePromise;
        });
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
 * Sets multiple keys and values
 *
 * @example Onyx.multiSet({'key1': 'a', 'key2': 'b'});
 *
 * @param {Object} data object keyed by ONYXKEYS and the values to set
 * @returns {Promise}
 */
function multiSet(data) {
    const keyValuePairs = prepareKeyValuePairsForStorage(data);

    const updatePromises = _.map(keyValuePairs, ([key, value]) => {
        const prevValue = cache.getValue(key, false);

        // Update cache and optimistically inform subscribers on the next tick
        cache.set(key, value);
        return scheduleSubscriberUpdate(key, value, prevValue);
    });

    return Storage.multiSet(keyValuePairs)
        .catch((error) => evictStorageAndRetry(error, multiSet, data))
        .then(() => {
            sendActionToDevTools(METHOD.MULTI_SET, undefined, data);
            return Promise.all(updatePromises);
        });
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
 * Merge a new value into an existing value at a key.
 *
 * The types of values that can be merged are `Object` and `Array`. To set another type of value use `Onyx.set()`.
 * Values of type `Object` get merged with the old value, whilst for `Array`'s we simply replace the current value with the new one.
 *
 * Calls to `Onyx.merge()` are batched so that any calls performed in a single tick will stack in a queue and get
 * applied in the order they were called. Note: `Onyx.set()` calls do not work this way so use caution when mixing
 * `Onyx.merge()` and `Onyx.set()`.
 *
 * @example
 * Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Joe']); // -> ['Joe']
 * Onyx.merge(ONYXKEYS.EMPLOYEE_LIST, ['Jack']); // -> ['Joe', 'Jack']
 * Onyx.merge(ONYXKEYS.POLICY, {id: 1}); // -> {id: 1}
 * Onyx.merge(ONYXKEYS.POLICY, {name: 'My Workspace'}); // -> {id: 1, name: 'My Workspace'}
 *
 * @param {String} key ONYXKEYS key
 * @param {(Object|Array)} changes Object or Array value to merge
 * @returns {Promise}
 */
function merge(key, changes) {
    // Top-level undefined values are ignored
    // Therefore we need to prevent adding them to the merge queue
    if (_.isUndefined(changes)) {
        return mergeQueue[key] ? mergeQueuePromise[key] : Promise.resolve();
    }

    // Merge attempts are batched together. The delta should be applied after a single call to get() to prevent a race condition.
    // Using the initial value from storage in subsequent merge attempts will lead to an incorrect final merged value.
    if (mergeQueue[key]) {
        mergeQueue[key].push(changes);
        return mergeQueuePromise[key];
    }
    mergeQueue[key] = [changes];

    mergeQueuePromise[key] = get(key).then((existingValue) => {
        // Calls to Onyx.set after a merge will terminate the current merge process and clear the merge queue
        if (mergeQueue[key] == null) return;

        try {
            // We first only merge the changes, so we can provide these to the native implementation (SQLite uses only delta changes in "JSON_PATCH" to merge)
            // We don't want to remove null values from the "batchedChanges", because SQLite uses them to remove keys from storage natively.
            let batchedChanges = applyMerge(undefined, mergeQueue[key], false);

            // The presence of a `null` in the merge queue instructs us to drop the existing value.
            // In this case, we can't simply merge the batched changes with the existing value, because then the null in the merge queue would have no effect
            const shouldOverwriteExistingValue = _.includes(mergeQueue[key], null);

            // Clean up the write queue, so we don't apply these changes again
            delete mergeQueue[key];
            delete mergeQueuePromise[key];

            // If the batched changes equal null, we want to remove the key from storage, to reduce storage size
            const {wasRemoved} = removeNullValues(key, batchedChanges);

            // After that we merge the batched changes with the existing value
            // We can remove null values from the "modifiedData", because "null" implicates that the user wants to remove a value from storage.
            // The "modifiedData" will be directly "set" in storage instead of being merged
            const modifiedData = shouldOverwriteExistingValue ? batchedChanges : applyMerge(existingValue, [batchedChanges], true);

            // On native platforms we use SQLite which utilises JSON_PATCH to merge changes.
            // JSON_PATCH generally removes null values from the stored object.
            // When there is no existing value though, SQLite will just insert the changes as a new value and thus the null values won't be removed.
            // Therefore we need to remove null values from the `batchedChanges` which are sent to the SQLite, if no existing value is present.
            if (!existingValue) {
                batchedChanges = applyMerge(undefined, [batchedChanges], true);
            }

            const hasChanged = cache.hasValueChanged(key, modifiedData);

            // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
            const updatePromise = broadcastUpdate(key, modifiedData, 'merge', hasChanged, wasRemoved);

            // If the value has not changed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
            if (!hasChanged || wasRemoved) {
                return updatePromise;
            }

            return Storage.mergeItem(key, batchedChanges, modifiedData).then(() => {
                sendActionToDevTools(METHOD.MERGE, key, changes, modifiedData);
                return updatePromise;
            });
        } catch (error) {
            Logger.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
            return Promise.resolve();
        }
    });

    return mergeQueuePromise[key];
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

/**
 * Clear out all the data in the store
 *
 * Note that calling Onyx.clear() and then Onyx.set() on a key with a default
 * key state may store an unexpected value in Storage.
 *
 * E.g.
 * Onyx.clear();
 * Onyx.set(ONYXKEYS.DEFAULT_KEY, 'default');
 * Storage.getItem(ONYXKEYS.DEFAULT_KEY)
 *     .then((storedValue) => console.log(storedValue));
 * null is logged instead of the expected 'default'
 *
 * Onyx.set() might call Storage.setItem() before Onyx.clear() calls
 * Storage.setItem(). Use Onyx.merge() instead if possible. Onyx.merge() calls
 * Onyx.get(key) before calling Storage.setItem() via Onyx.set().
 * Storage.setItem() from Onyx.clear() will have already finished and the merged
 * value will be saved to storage after the default value.
 *
 * @param {Array} keysToPreserve is a list of ONYXKEYS that should not be cleared with the rest of the data
 * @returns {Promise<void>}
 */
function clear(keysToPreserve = []) {
    return getAllKeys().then((keys) => {
        const keysToBeClearedFromStorage = [];
        const keyValuesToResetAsCollection = {};
        const keyValuesToResetIndividually = {};

        // The only keys that should not be cleared are:
        // 1. Anything specifically passed in keysToPreserve (because some keys like language preferences, offline
        //      status, or activeClients need to remain in Onyx even when signed out)
        // 2. Any keys with a default state (because they need to remain in Onyx as their default, and setting them
        //      to null would cause unknown behavior)
        _.each(keys, (key) => {
            const isKeyToPreserve = _.contains(keysToPreserve, key);
            const isDefaultKey = _.has(defaultKeyStates, key);

            // If the key is being removed or reset to default:
            // 1. Update it in the cache
            // 2. Figure out whether it is a collection key or not,
            //      since collection key subscribers need to be updated differently
            if (!isKeyToPreserve) {
                const oldValue = cache.getValue(key);
                const newValue = _.get(defaultKeyStates, key, null);
                if (newValue !== oldValue) {
                    cache.set(key, newValue);
                    const collectionKey = key.substring(0, key.indexOf('_') + 1);
                    if (collectionKey) {
                        if (!keyValuesToResetAsCollection[collectionKey]) {
                            keyValuesToResetAsCollection[collectionKey] = {};
                        }
                        keyValuesToResetAsCollection[collectionKey][key] = newValue;
                    } else {
                        keyValuesToResetIndividually[key] = newValue;
                    }
                }
            }

            if (isKeyToPreserve || isDefaultKey) {
                return;
            }

            // If it isn't preserved and doesn't have a default, we'll remove it
            keysToBeClearedFromStorage.push(key);
        });

        const updatePromises = [];

        // Notify the subscribers for each key/value group so they can receive the new values
        _.each(keyValuesToResetIndividually, (value, key) => {
            updatePromises.push(scheduleSubscriberUpdate(key, value, cache.getValue(key, false)));
        });
        _.each(keyValuesToResetAsCollection, (value, key) => {
            updatePromises.push(scheduleNotifyCollectionSubscribers(key, value));
        });

        const defaultKeyValuePairs = _.pairs(_.omit(defaultKeyStates, keysToPreserve));

        // Remove only the items that we want cleared from storage, and reset others to default
        _.each(keysToBeClearedFromStorage, (key) => cache.drop(key));
        return Storage.removeItems(keysToBeClearedFromStorage)
            .then(() => Storage.multiSet(defaultKeyValuePairs))
            .then(() => {
                DevTools.clearState(keysToPreserve);
                return Promise.all(updatePromises);
            });
    });
}

/**
 * Merges a collection based on their keys
 *
 * @example
 *
 * Onyx.mergeCollection(ONYXKEYS.COLLECTION.REPORT, {
 *     [`${ONYXKEYS.COLLECTION.REPORT}1`]: report1,
 *     [`${ONYXKEYS.COLLECTION.REPORT}2`]: report2,
 * });
 *
 * @param {String} collectionKey e.g. `ONYXKEYS.COLLECTION.REPORT`
 * @param {Object} collection Object collection keyed by individual collection member keys and values
 * @returns {Promise}
 */
function mergeCollection(collectionKey, collection) {
    if (!_.isObject(collection) || _.isArray(collection) || _.isEmpty(collection)) {
        Logger.logInfo('mergeCollection() called with invalid or empty value. Skipping this update.');
        return Promise.resolve();
    }

    // Confirm all the collection keys belong to the same parent
    let hasCollectionKeyCheckFailed = false;
    _.each(collection, (_data, dataKey) => {
        if (isKeyMatch(collectionKey, dataKey)) {
            return;
        }

        if (process.env.NODE_ENV === 'development') {
            throw new Error(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
        }

        hasCollectionKeyCheckFailed = true;
        Logger.logAlert(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
    });

    // Gracefully handle bad mergeCollection updates so it doesn't block the merge queue
    if (hasCollectionKeyCheckFailed) {
        return Promise.resolve();
    }

    return getAllKeys().then((persistedKeys) => {
        // Split to keys that exist in storage and keys that don't
        const [existingKeys, newKeys] = _.chain(collection)
            .pick((value, key) => {
                if (_.isNull(value)) {
                    remove(key);
                    return false;
                }
                return true;
            })
            .keys()
            .partition((key) => persistedKeys.includes(key))
            .value();

        const existingKeyCollection = _.pick(collection, existingKeys);
        const newCollection = _.pick(collection, newKeys);
        const keyValuePairsForExistingCollection = prepareKeyValuePairsForStorage(existingKeyCollection);
        const keyValuePairsForNewCollection = prepareKeyValuePairsForStorage(newCollection);

        const promises = [];

        // New keys will be added via multiSet while existing keys will be updated using multiMerge
        // This is because setting a key that doesn't exist yet with multiMerge will throw errors
        if (keyValuePairsForExistingCollection.length > 0) {
            promises.push(Storage.multiMerge(keyValuePairsForExistingCollection));
        }

        if (keyValuePairsForNewCollection.length > 0) {
            promises.push(Storage.multiSet(keyValuePairsForNewCollection));
        }

        // Prefill cache if necessary by calling get() on any existing keys and then merge original data to cache
        // and update all subscribers
        const promiseUpdate = Promise.all(_.map(existingKeys, get)).then(() => {
            cache.merge(collection);
            return scheduleNotifyCollectionSubscribers(collectionKey, collection);
        });

        return Promise.all(promises)
            .catch((error) => evictStorageAndRetry(error, mergeCollection, collection))
            .then(() => {
                sendActionToDevTools(METHOD.MERGE_COLLECTION, undefined, collection);
                return promiseUpdate;
            });
    });
}

/**
 * Insert API responses and lifecycle data into Onyx
 *
 * @param {Array} data An array of objects with shape {onyxMethod: oneOf('set', 'merge', 'mergeCollection', 'multiSet', 'clear'), key: string, value: *}
 * @returns {Promise} resolves when all operations are complete
 */
function update(data) {
    // First, validate the Onyx object is in the format we expect
    _.each(data, ({onyxMethod, key, value}) => {
        if (!_.contains([METHOD.CLEAR, METHOD.SET, METHOD.MERGE, METHOD.MERGE_COLLECTION, METHOD.MULTI_SET], onyxMethod)) {
            throw new Error(`Invalid onyxMethod ${onyxMethod} in Onyx update.`);
        }
        if (onyxMethod === METHOD.MULTI_SET) {
            // For multiset, we just expect the value to be an object
            if (!_.isObject(value) || _.isArray(value) || _.isFunction(value)) {
                throw new Error('Invalid value provided in Onyx multiSet. Onyx multiSet value must be of type object.');
            }
        } else if (onyxMethod !== METHOD.CLEAR && !_.isString(key)) {
            throw new Error(`Invalid ${typeof key} key provided in Onyx update. Onyx key must be of type string.`);
        }
    });

    const promises = [];
    let clearPromise = Promise.resolve();

    _.each(data, ({onyxMethod, key, value}) => {
        switch (onyxMethod) {
            case METHOD.SET:
                promises.push(() => set(key, value));
                break;
            case METHOD.MERGE:
                promises.push(() => merge(key, value));
                break;
            case METHOD.MERGE_COLLECTION:
                promises.push(() => mergeCollection(key, value));
                break;
            case METHOD.MULTI_SET:
                promises.push(() => multiSet(value));
                break;
            case METHOD.CLEAR:
                clearPromise = clear();
                break;
            default:
                break;
        }
    });

    return clearPromise.then(() => Promise.all(_.map(promises, (p) => p())));
}

/**
 * Initialize the store with actions and listening for storage events
 *
 * @param {Object} [options={}] config object
 * @param {Object} [options.keys={}] `ONYXKEYS` constants object
 * @param {Object} [options.initialKeyStates={}] initial data to set when `init()` and `clear()` is called
 * @param {String[]} [options.safeEvictionKeys=[]] This is an array of keys
 * (individual or collection patterns) that when provided to Onyx are flagged
 * as "safe" for removal. Any components subscribing to these keys must also
 * implement a canEvict option. See the README for more info.
 * @param {Number} [options.maxCachedKeysCount=55] Sets how many recent keys should we try to keep in cache
 * Setting this to 0 would practically mean no cache
 * We try to free cache when we connect to a safe eviction key
 * @param {Boolean} [options.captureMetrics] Enables Onyx benchmarking and exposes the get/print/reset functions
 * @param {Boolean} [options.shouldSyncMultipleInstances] Auto synchronize storage events between multiple instances
 * of Onyx running in different tabs/windows. Defaults to true for platforms that support local storage (web/desktop)
 * @param {Boolean} [options.debugSetState] Enables debugging setState() calls to connected components.
 * @example
 * Onyx.init({
 *     keys: ONYXKEYS,
 *     initialKeyStates: {
 *         [ONYXKEYS.SESSION]: {loading: false},
 *     },
 * });
 */
function init({keys = {}, initialKeyStates = {}, safeEvictionKeys = [], maxCachedKeysCount = 1000, shouldSyncMultipleInstances = Boolean(global.localStorage), debugSetState = false} = {}) {
    if (debugSetState) {
        PerformanceUtils.setShouldDebugSetState(true);
    }

    if (maxCachedKeysCount > 0) {
        cache.setRecentKeysLimit(maxCachedKeysCount);
    }

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

    // Initialize all of our keys with data provided then give green light to any pending connections
    Promise.all([addAllSafeEvictionKeysToRecentlyAccessedList(), initializeWithDefaultKeyStates()]).then(deferredInitTask.resolve);

    if (shouldSyncMultipleInstances && _.isFunction(Storage.keepInstancesSync)) {
        Storage.keepInstancesSync((key, value) => {
            const prevValue = cache.getValue(key, false);
            cache.set(key, value);
            keyChanged(key, value, prevValue);
        });
    }
}

const Onyx = {
    connect,
    disconnect,
    set,
    multiSet,
    merge,
    mergeCollection,
    update,
    clear,
    getAllKeys,
    init,
    registerLogger: Logger.registerLogger,
    addToEvictionBlockList,
    removeFromEvictionBlockList,
    isSafeEvictionKey,
    METHOD,
    tryGetCachedValue,
    hasPendingMergeForKey,
    isCollectionKey,
    isCollectionMemberKey,
    splitCollectionMemberKey,
};

export default Onyx;
