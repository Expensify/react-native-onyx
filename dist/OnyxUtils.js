"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable no-continue */
const fast_equals_1 = require("fast-equals");
const clone_1 = __importDefault(require("lodash/clone"));
const DevTools_1 = __importDefault(require("./DevTools"));
const Logger = __importStar(require("./Logger"));
const OnyxCache_1 = __importDefault(require("./OnyxCache"));
const PerformanceUtils = __importStar(require("./PerformanceUtils"));
const Str = __importStar(require("./Str"));
const batch_1 = __importDefault(require("./batch"));
const storage_1 = __importDefault(require("./storage"));
const utils_1 = __importDefault(require("./utils"));
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
// Holds a mapping of all the React components that want their state subscribed to a store key
const callbackToStateMapping = {};
// Keeps a copy of the values of the onyx collection keys as a map for faster lookups
let onyxCollectionKeySet = new Set();
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
let snapshotKey = null;
function getSnapshotKey() {
    return snapshotKey;
}
/**
 * Getter - returns the merge queue.
 */
function getMergeQueue() {
    return mergeQueue;
}
/**
 * Getter - returns the merge queue promise.
 */
function getMergeQueuePromise() {
    return mergeQueuePromise;
}
/**
 * Getter - returns the callback to state mapping.
 */
function getCallbackToStateMapping() {
    return callbackToStateMapping;
}
/**
 * Getter - returns the default key states.
 */
function getDefaultKeyStates() {
    return defaultKeyStates;
}
/**
 * Sets the initial values for the Onyx store
 *
 * @param keys - `ONYXKEYS` constants object from Onyx.init()
 * @param initialKeyStates - initial data to set when `init()` and `clear()` are called
 * @param safeEvictionKeys - This is an array of keys (individual or collection patterns) that when provided to Onyx are flagged as "safe" for removal.
 */
function initStoreValues(keys, initialKeyStates, safeEvictionKeys) {
    var _a;
    // We need the value of the collection keys later for checking if a
    // key is a collection. We store it in a map for faster lookup.
    const collectionValues = Object.values((_a = keys.COLLECTION) !== null && _a !== void 0 ? _a : {});
    onyxCollectionKeySet = collectionValues.reduce((acc, val) => {
        acc.add(val);
        return acc;
    }, new Set());
    // Set our default key states to use when initializing and clearing Onyx data
    defaultKeyStates = initialKeyStates;
    DevTools_1.default.initState(initialKeyStates);
    // Let Onyx know about which keys are safe to evict
    evictionAllowList = safeEvictionKeys;
    if (typeof keys.COLLECTION === 'object' && typeof keys.COLLECTION.SNAPSHOT === 'string') {
        snapshotKey = keys.COLLECTION.SNAPSHOT;
    }
}
function sendActionToDevTools(method, key, value, mergedValue = undefined) {
    DevTools_1.default.registerAction(utils_1.default.formatActionName(method, key), value, key ? { [key]: mergedValue || value } : value);
}
/**
 * We are batching together onyx updates. This helps with use cases where we schedule onyx updates after each other.
 * This happens for example in the Onyx.update function, where we process API responses that might contain a lot of
 * update operations. Instead of calling the subscribers for each update operation, we batch them together which will
 * cause react to schedule the updates at once instead of after each other. This is mainly a performance optimization.
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
            (0, batch_1.default)(() => {
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
 * Takes a collection of items (eg. {testKey_1:{a:'a'}, testKey_2:{b:'b'}})
 * and runs it through a reducer function to return a subset of the data according to a selector.
 * The resulting collection will only contain items that are returned by the selector.
 */
function reduceCollectionWithSelector(collection, selector, withOnyxInstanceState) {
    return Object.entries(collection !== null && collection !== void 0 ? collection : {}).reduce((finalCollection, [key, item]) => {
        // eslint-disable-next-line no-param-reassign
        finalCollection[key] = selector(item, withOnyxInstanceState);
        return finalCollection;
    }, {});
}
/** Get some data from the store */
function get(key) {
    // When we already have the value in cache - resolve right away
    if (OnyxCache_1.default.hasCacheForKey(key)) {
        return Promise.resolve(OnyxCache_1.default.get(key));
    }
    const taskName = `get:${key}`;
    // When a value retrieving task for this key is still running hook to it
    if (OnyxCache_1.default.hasPendingTask(taskName)) {
        return OnyxCache_1.default.getTaskPromise(taskName);
    }
    // Otherwise retrieve the value from storage and capture a promise to aid concurrent usages
    const promise = storage_1.default.getItem(key)
        .then((val) => {
        if (val === undefined) {
            OnyxCache_1.default.addNullishStorageKey(key);
            return undefined;
        }
        OnyxCache_1.default.set(key, val);
        return val;
    })
        .catch((err) => Logger.logInfo(`Unable to get item from persistent storage. Key: ${key} Error: ${err}`));
    return OnyxCache_1.default.captureTask(taskName, promise);
}
/** Returns current key names stored in persisted storage */
function getAllKeys() {
    // When we've already read stored keys, resolve right away
    const cachedKeys = OnyxCache_1.default.getAllKeys();
    if (cachedKeys.size > 0) {
        return Promise.resolve(cachedKeys);
    }
    const taskName = 'getAllKeys';
    // When a value retrieving task for all keys is still running hook to it
    if (OnyxCache_1.default.hasPendingTask(taskName)) {
        return OnyxCache_1.default.getTaskPromise(taskName);
    }
    // Otherwise retrieve the keys from storage and capture a promise to aid concurrent usages
    const promise = storage_1.default.getAllKeys().then((keys) => {
        OnyxCache_1.default.setAllKeys(keys);
        // return the updated set of keys
        return OnyxCache_1.default.getAllKeys();
    });
    return OnyxCache_1.default.captureTask(taskName, promise);
}
/**
 * Returns set of all registered collection keys
 */
function getCollectionKeys() {
    return onyxCollectionKeySet;
}
/**
 * Checks to see if the subscriber's supplied key
 * is associated with a collection of keys.
 */
function isCollectionKey(key) {
    return onyxCollectionKeySet.has(key);
}
function isCollectionMemberKey(collectionKey, key) {
    return Str.startsWith(key, collectionKey) && key.length > collectionKey.length;
}
/**
 * Splits a collection member key into the collection key part and the ID part.
 * @param key - The collection member key to split.
 * @returns A tuple where the first element is the collection part and the second element is the ID part.
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
 */
function isKeyMatch(configKey, key) {
    return isCollectionKey(configKey) ? Str.startsWith(key, configKey) : configKey === key;
}
/** Checks to see if this key has been flagged as safe for removal. */
function isSafeEvictionKey(testKey) {
    return evictionAllowList.some((key) => isKeyMatch(key, testKey));
}
/**
 * Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
 * If the requested key is a collection, it will return an object with all the collection members.
 */
function tryGetCachedValue(key, mapping) {
    let val = OnyxCache_1.default.get(key);
    if (isCollectionKey(key)) {
        const allCacheKeys = OnyxCache_1.default.getAllKeys();
        // It is possible we haven't loaded all keys yet so we do not know if the
        // collection actually exists.
        if (allCacheKeys.size === 0) {
            return;
        }
        const values = {};
        allCacheKeys.forEach((cacheKey) => {
            if (!cacheKey.startsWith(key)) {
                return;
            }
            values[cacheKey] = OnyxCache_1.default.get(cacheKey);
        });
        val = values;
    }
    if (mapping === null || mapping === void 0 ? void 0 : mapping.selector) {
        const state = mapping.withOnyxInstance ? mapping.withOnyxInstance.state : undefined;
        if (isCollectionKey(key)) {
            return reduceCollectionWithSelector(val, mapping.selector, state);
        }
        return mapping.selector(val, state);
    }
    return val;
}
/**
 * Remove a key from the recently accessed key list.
 */
function removeLastAccessedKey(key) {
    recentlyAccessedKeys = recentlyAccessedKeys.filter((recentlyAccessedKey) => recentlyAccessedKey !== key);
}
/**
 * Add a key to the list of recently accessed keys. The least
 * recently accessed key should be at the head and the most
 * recently accessed key at the tail.
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
 */
function removeFromEvictionBlockList(key, connectionID) {
    var _a, _b, _c;
    evictionBlocklist[key] = (_b = (_a = evictionBlocklist[key]) === null || _a === void 0 ? void 0 : _a.filter((evictionKey) => evictionKey !== connectionID)) !== null && _b !== void 0 ? _b : [];
    // Remove the key if there are no more subscribers
    if (((_c = evictionBlocklist[key]) === null || _c === void 0 ? void 0 : _c.length) === 0) {
        delete evictionBlocklist[key];
    }
}
/** Keys added to this list can never be deleted. */
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
    return getAllKeys().then((keys) => {
        evictionAllowList.forEach((safeEvictionKey) => {
            keys.forEach((key) => {
                if (!isKeyMatch(safeEvictionKey, key)) {
                    return;
                }
                addLastAccessedKey(key);
            });
        });
    });
}
function getCachedCollection(collectionKey, collectionMemberKeys) {
    const allKeys = collectionMemberKeys || OnyxCache_1.default.getAllKeys();
    const collection = {};
    // forEach exists on both Set and Array
    allKeys.forEach((key) => {
        // If we don't have collectionMemberKeys array then we have to check whether a key is a collection member key.
        // Because in that case the keys will be coming from `cache.getAllKeys()` and we need to filter out the keys that
        // are not part of the collection.
        if (!collectionMemberKeys && !isCollectionMemberKey(collectionKey, key)) {
            return;
        }
        const cachedValue = OnyxCache_1.default.get(key);
        if (cachedValue === undefined && !OnyxCache_1.default.hasNullishStorageKey(key)) {
            return;
        }
        collection[key] = OnyxCache_1.default.get(key);
    });
    return collection;
}
/**
 * When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks
 */
function keysChanged(collectionKey, partialCollection, partialPreviousCollection, notifyRegularSubscibers = true, notifyWithOnyxSubscibers = true) {
    // We prepare the "cached collection" which is the entire collection + the new partial data that
    // was merged in via mergeCollection().
    const cachedCollection = getCachedCollection(collectionKey);
    const previousCollection = partialPreviousCollection !== null && partialPreviousCollection !== void 0 ? partialPreviousCollection : {};
    // We are iterating over all subscribers similar to keyChanged(). However, we are looking for subscribers who are subscribing to either a collection key or
    // individual collection key member for the collection that is being updated. It is important to note that the collection parameter cane be a PARTIAL collection
    // and does not represent all of the combined keys and values for a collection key. It is just the "new" data that was merged in via mergeCollection().
    const stateMappingKeys = Object.keys(callbackToStateMapping);
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
        // Regular Onyx.connect() subscriber found.
        if (typeof subscriber.callback === 'function') {
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
                const dataKeys = Object.keys(partialCollection !== null && partialCollection !== void 0 ? partialCollection : {});
                for (let j = 0; j < dataKeys.length; j++) {
                    const dataKey = dataKeys[j];
                    if ((0, fast_equals_1.deepEqual)(cachedCollection[dataKey], previousCollection[dataKey])) {
                        continue;
                    }
                    subscriber.callback(cachedCollection[dataKey], dataKey);
                }
                continue;
            }
            // And if the subscriber is specifically only tracking a particular collection member key then we will
            // notify them with the cached data for that key only.
            if (isSubscribedToCollectionMemberKey) {
                if ((0, fast_equals_1.deepEqual)(cachedCollection[subscriber.key], previousCollection[subscriber.key])) {
                    continue;
                }
                const subscriberCallback = subscriber.callback;
                subscriberCallback(cachedCollection[subscriber.key], subscriber.key);
                continue;
            }
            continue;
        }
        // React component subscriber found.
        if ('withOnyxInstance' in subscriber && subscriber.withOnyxInstance) {
            if (!notifyWithOnyxSubscibers) {
                continue;
            }
            // We are subscribed to a collection key so we must update the data in state with the new
            // collection member key values from the partial update.
            if (isSubscribedToCollectionKey) {
                // If the subscriber has a selector, then the component's state must only be updated with the data
                // returned by the selector.
                const collectionSelector = subscriber.selector;
                if (collectionSelector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const previousData = prevState[subscriber.statePropertyName];
                        const newData = reduceCollectionWithSelector(cachedCollection, collectionSelector, subscriber.withOnyxInstance.state);
                        if ((0, fast_equals_1.deepEqual)(previousData, newData)) {
                            return null;
                        }
                        return {
                            [subscriber.statePropertyName]: newData,
                        };
                    });
                    continue;
                }
                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    var _a;
                    const prevCollection = (_a = prevState === null || prevState === void 0 ? void 0 : prevState[subscriber.statePropertyName]) !== null && _a !== void 0 ? _a : {};
                    const finalCollection = (0, clone_1.default)(prevCollection);
                    const dataKeys = Object.keys(partialCollection !== null && partialCollection !== void 0 ? partialCollection : {});
                    for (let j = 0; j < dataKeys.length; j++) {
                        const dataKey = dataKeys[j];
                        finalCollection[dataKey] = cachedCollection[dataKey];
                    }
                    if ((0, fast_equals_1.deepEqual)(prevCollection, finalCollection)) {
                        return null;
                    }
                    PerformanceUtils.logSetStateCall(subscriber, prevState === null || prevState === void 0 ? void 0 : prevState[subscriber.statePropertyName], finalCollection, 'keysChanged', collectionKey);
                    return {
                        [subscriber.statePropertyName]: finalCollection,
                    };
                });
                continue;
            }
            // If a React component is only interested in a single key then we can set the cached value directly to the state name.
            if (isSubscribedToCollectionMemberKey) {
                if ((0, fast_equals_1.deepEqual)(cachedCollection[subscriber.key], previousCollection[subscriber.key])) {
                    continue;
                }
                // However, we only want to update this subscriber if the partial data contains a change.
                // Otherwise, we would update them with a value they already have and trigger an unnecessary re-render.
                const dataFromCollection = partialCollection === null || partialCollection === void 0 ? void 0 : partialCollection[subscriber.key];
                if (dataFromCollection === undefined) {
                    continue;
                }
                // If the subscriber has a selector, then the component's state must only be updated with the data
                // returned by the selector and the state should only change when the subset of data changes from what
                // it was previously.
                const selector = subscriber.selector;
                if (selector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const prevData = prevState[subscriber.statePropertyName];
                        const newData = selector(cachedCollection[subscriber.key], subscriber.withOnyxInstance.state);
                        if ((0, fast_equals_1.deepEqual)(prevData, newData)) {
                            return null;
                        }
                        PerformanceUtils.logSetStateCall(subscriber, prevData, newData, 'keysChanged', collectionKey);
                        return {
                            [subscriber.statePropertyName]: newData,
                        };
                    });
                    continue;
                }
                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const prevData = prevState[subscriber.statePropertyName];
                    const newData = cachedCollection[subscriber.key];
                    // Avoids triggering unnecessary re-renders when feeding empty objects
                    if (utils_1.default.isEmptyObject(newData) && utils_1.default.isEmptyObject(prevData)) {
                        return null;
                    }
                    if ((0, fast_equals_1.deepEqual)(prevData, newData)) {
                        return null;
                    }
                    PerformanceUtils.logSetStateCall(subscriber, prevData, newData, 'keysChanged', collectionKey);
                    return {
                        [subscriber.statePropertyName]: newData,
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
 */
function keyChanged(key, value, previousValue, canUpdateSubscriber = () => true, notifyRegularSubscibers = true, notifyWithOnyxSubscibers = true) {
    // Add or remove this key from the recentlyAccessedKeys lists
    if (value !== null) {
        addLastAccessedKey(key);
    }
    else {
        removeLastAccessedKey(key);
    }
    // We are iterating over all subscribers to see if they are interested in the key that has just changed. If the subscriber's  key is a collection key then we will
    // notify them if the key that changed is a collection member. Or if it is a regular key notify them when there is an exact match. Depending on whether the subscriber
    // was connected via withOnyx we will call setState() directly on the withOnyx instance. If it is a regular connection we will pass the data to the provided callback.
    const stateMappingKeys = Object.keys(callbackToStateMapping);
    for (let i = 0; i < stateMappingKeys.length; i++) {
        const subscriber = callbackToStateMapping[stateMappingKeys[i]];
        if (!subscriber || !isKeyMatch(subscriber.key, key) || !canUpdateSubscriber(subscriber)) {
            continue;
        }
        // Subscriber is a regular call to connect() and provided a callback
        if (typeof subscriber.callback === 'function') {
            if (!notifyRegularSubscibers) {
                continue;
            }
            if (isCollectionKey(subscriber.key) && subscriber.waitForCollectionCallback) {
                const cachedCollection = getCachedCollection(subscriber.key);
                cachedCollection[key] = value;
                subscriber.callback(cachedCollection);
                continue;
            }
            const subscriberCallback = subscriber.callback;
            subscriberCallback(value, key);
            continue;
        }
        // Subscriber connected via withOnyx() HOC
        if ('withOnyxInstance' in subscriber && subscriber.withOnyxInstance) {
            if (!notifyWithOnyxSubscibers) {
                continue;
            }
            const selector = subscriber.selector;
            // Check if we are subscribing to a collection key and overwrite the collection member key value in state
            if (isCollectionKey(subscriber.key)) {
                // If the subscriber has a selector, then the consumer of this data must only be given the data
                // returned by the selector and only when the selected data has changed.
                if (selector) {
                    subscriber.withOnyxInstance.setStateProxy((prevState) => {
                        const prevWithOnyxData = prevState[subscriber.statePropertyName];
                        const newWithOnyxData = {
                            [key]: selector(value, subscriber.withOnyxInstance.state),
                        };
                        const prevDataWithNewData = Object.assign(Object.assign({}, prevWithOnyxData), newWithOnyxData);
                        if ((0, fast_equals_1.deepEqual)(prevWithOnyxData, prevDataWithNewData)) {
                            return null;
                        }
                        PerformanceUtils.logSetStateCall(subscriber, prevWithOnyxData, newWithOnyxData, 'keyChanged', key);
                        return {
                            [subscriber.statePropertyName]: prevDataWithNewData,
                        };
                    });
                    continue;
                }
                subscriber.withOnyxInstance.setStateProxy((prevState) => {
                    const prevCollection = prevState[subscriber.statePropertyName] || {};
                    const newCollection = Object.assign(Object.assign({}, prevCollection), { [key]: value });
                    if ((0, fast_equals_1.deepEqual)(prevCollection, newCollection)) {
                        return null;
                    }
                    PerformanceUtils.logSetStateCall(subscriber, prevCollection, newCollection, 'keyChanged', key);
                    return {
                        [subscriber.statePropertyName]: newCollection,
                    };
                });
                continue;
            }
            // If the subscriber has a selector, then the component's state must only be updated with the data
            // returned by the selector and only if the selected data has changed.
            if (selector) {
                subscriber.withOnyxInstance.setStateProxy(() => {
                    const prevValue = selector(previousValue, subscriber.withOnyxInstance.state);
                    const newValue = selector(value, subscriber.withOnyxInstance.state);
                    if ((0, fast_equals_1.deepEqual)(prevValue, newValue)) {
                        return null;
                    }
                    return {
                        [subscriber.statePropertyName]: newValue,
                    };
                });
                continue;
            }
            // If we did not match on a collection key then we just set the new data to the state property
            subscriber.withOnyxInstance.setStateProxy((prevState) => {
                const prevWithOnyxValue = prevState[subscriber.statePropertyName];
                // Avoids triggering unnecessary re-renders when feeding empty objects
                if (utils_1.default.isEmptyObject(value) && utils_1.default.isEmptyObject(prevWithOnyxValue)) {
                    return null;
                }
                if (prevWithOnyxValue === value) {
                    return null;
                }
                PerformanceUtils.logSetStateCall(subscriber, previousValue, value, 'keyChanged', key);
                return {
                    [subscriber.statePropertyName]: value,
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
 */
function sendDataToConnection(mapping, value, matchedKey, isBatched) {
    var _a, _b;
    // If the mapping no longer exists then we should not send any data.
    // This means our subscriber disconnected or withOnyx wrapped component unmounted.
    if (!callbackToStateMapping[mapping.connectionID]) {
        return;
    }
    if ('withOnyxInstance' in mapping && mapping.withOnyxInstance) {
        let newData = value;
        // If the mapping has a selector, then the component's state must only be updated with the data
        // returned by the selector.
        if (mapping.selector) {
            if (isCollectionKey(mapping.key)) {
                newData = reduceCollectionWithSelector(value, mapping.selector, mapping.withOnyxInstance.state);
            }
            else {
                newData = mapping.selector(value, mapping.withOnyxInstance.state);
            }
        }
        PerformanceUtils.logSetStateCall(mapping, null, newData, 'sendDataToConnection');
        if (isBatched) {
            batchUpdates(() => mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData));
        }
        else {
            mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData);
        }
        return;
    }
    // When there are no matching keys in "Onyx.connect", we pass null to "sendDataToConnection" explicitly,
    // to allow the withOnyx instance to set the value in the state initially and therefore stop the loading state once all
    // required keys have been set.
    // If we would pass undefined to setWithOnyxInstance instead, withOnyx would not set the value in the state.
    // withOnyx will internally replace null values with undefined and never pass null values to wrapped components.
    // For regular callbacks, we never want to pass null values, but always just undefined if a value is not set in cache or storage.
    (_b = (_a = mapping).callback) === null || _b === void 0 ? void 0 : _b.call(_a, value === null ? undefined : value, matchedKey);
}
/**
 * We check to see if this key is flagged as safe for eviction and add it to the recentlyAccessedKeys list so that when we
 * run out of storage the least recently accessed key can be removed.
 */
function addKeyToRecentlyAccessedIfNeeded(mapping) {
    if (!isSafeEvictionKey(mapping.key)) {
        return;
    }
    // Try to free some cache whenever we connect to a safe eviction key
    OnyxCache_1.default.removeLeastRecentlyUsedKeys();
    if ('withOnyxInstance' in mapping && mapping.withOnyxInstance && !isCollectionKey(mapping.key)) {
        // All React components subscribing to a key flagged as a safe eviction key must implement the canEvict property.
        if (mapping.canEvict === undefined) {
            throw new Error(`Cannot subscribe to safe eviction key '${mapping.key}' without providing a canEvict value.`);
        }
        addLastAccessedKey(mapping.key);
    }
}
/**
 * Gets the data for a given an array of matching keys, combines them into an object, and sends the result back to the subscriber.
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
        const cacheValue = OnyxCache_1.default.get(key);
        if (cacheValue) {
            data[key] = cacheValue;
            return;
        }
        const pendingKey = `get:${key}`;
        if (OnyxCache_1.default.hasPendingTask(pendingKey)) {
            pendingTasks.push(OnyxCache_1.default.getTaskPromise(pendingKey));
            pendingKeys.push(key);
        }
        else {
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
            return Promise.resolve(undefined);
        }
        return storage_1.default.multiGet(missingKeys);
    })
        // We are going to add the data from the missing keys to the data object and also merge it to the cache.
        .then((values) => {
        if (!values || values.length === 0) {
            return Promise.resolve();
        }
        // temp object is used to merge the missing data into the cache
        const temp = {};
        values.forEach(([key, value]) => {
            data[key] = value;
            temp[key] = value;
        });
        OnyxCache_1.default.merge(temp);
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
 */
function scheduleSubscriberUpdate(key, value, previousValue, canUpdateSubscriber = () => true) {
    const promise = Promise.resolve().then(() => keyChanged(key, value, previousValue, canUpdateSubscriber, true, false));
    batchUpdates(() => keyChanged(key, value, previousValue, canUpdateSubscriber, false, true));
    return Promise.all([maybeFlushBatchUpdates(), promise]).then(() => undefined);
}
/**
 * This method is similar to notifySubscribersOnNextTick but it is built for working specifically with collections
 * so that keysChanged() is triggered for the collection and not keyChanged(). If this was not done, then the
 * subscriber callbacks receive the data in a different format than they normally expect and it breaks code.
 */
function scheduleNotifyCollectionSubscribers(key, value, previousValue) {
    const promise = Promise.resolve().then(() => keysChanged(key, value, previousValue, true, false));
    batchUpdates(() => keysChanged(key, value, previousValue, false, true));
    return Promise.all([maybeFlushBatchUpdates(), promise]).then(() => undefined);
}
/**
 * Remove a key from Onyx and update the subscribers
 */
function remove(key) {
    const prevValue = OnyxCache_1.default.get(key, false);
    OnyxCache_1.default.drop(key);
    scheduleSubscriberUpdate(key, undefined, prevValue);
    return storage_1.default.removeItem(key).then(() => undefined);
}
function reportStorageQuota() {
    return storage_1.default.getDatabaseSize()
        .then(({ bytesUsed, bytesRemaining }) => {
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
 */
function evictStorageAndRetry(error, onyxMethod, ...args) {
    Logger.logInfo(`Failed to save to storage. Error: ${error}. onyxMethod: ${onyxMethod.name}`);
    if (error && Str.startsWith(error.message, "Failed to execute 'put' on 'IDBObjectStore'")) {
        Logger.logAlert('Attempted to set invalid data set in Onyx. Please ensure all data is serializable.');
        throw error;
    }
    // Find the first key that we can remove that has no subscribers in our blocklist
    const keyForRemoval = recentlyAccessedKeys.find((key) => !evictionBlocklist[key]);
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
    // @ts-expect-error No overload matches this call.
    return remove(keyForRemoval).then(() => onyxMethod(...args));
}
/**
 * Notifies subscribers and writes current value to cache
 */
function broadcastUpdate(key, value, hasChanged) {
    const prevValue = OnyxCache_1.default.get(key, false);
    // Update subscribers if the cached value has changed, or when the subscriber specifically requires
    // all updates regardless of value changes (indicated by initWithStoredValues set to false).
    if (hasChanged) {
        OnyxCache_1.default.set(key, value);
    }
    else {
        OnyxCache_1.default.addToAccessedKeys(key);
    }
    return scheduleSubscriberUpdate(key, value, prevValue, (subscriber) => hasChanged || (subscriber === null || subscriber === void 0 ? void 0 : subscriber.initWithStoredValues) === false).then(() => undefined);
}
function hasPendingMergeForKey(key) {
    return !!mergeQueue[key];
}
/**
 * Removes a key from storage if the value is null.
 * Otherwise removes all nested null values in objects,
 * if shouldRemoveNestedNulls is true and returns the object.
 *
 * @returns The value without null values and a boolean "wasRemoved", which indicates if the key got removed completely
 */
function removeNullValues(key, value, shouldRemoveNestedNulls = true) {
    if (value === null) {
        remove(key);
        return { value, wasRemoved: true };
    }
    if (value === undefined) {
        return { value, wasRemoved: false };
    }
    // We can remove all null values in an object by merging it with itself
    // utils.fastMerge recursively goes through the object and removes all null values
    // Passing two identical objects as source and target to fastMerge will not change it, but only remove the null values
    return { value: shouldRemoveNestedNulls ? utils_1.default.removeNestedNullValues(value) : value, wasRemoved: false };
}
/**
 * Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
 * This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
 * to an array of key-value pairs in the above format and removes key-value pairs that are being set to null

* @return an array of key - value pairs <[key, value]>
 */
function prepareKeyValuePairsForStorage(data, shouldRemoveNestedNulls) {
    return Object.entries(data).reduce((pairs, [key, value]) => {
        const { value: valueAfterRemoving, wasRemoved } = removeNullValues(key, value, shouldRemoveNestedNulls);
        if (!wasRemoved && valueAfterRemoving !== undefined) {
            pairs.push([key, valueAfterRemoving]);
        }
        return pairs;
    }, []);
}
/**
 * Merges an array of changes with an existing value
 *
 * @param changes Array of changes that should be applied to the existing value
 */
function applyMerge(existingValue, changes, shouldRemoveNestedNulls) {
    const lastChange = changes === null || changes === void 0 ? void 0 : changes.at(-1);
    if (Array.isArray(lastChange)) {
        return lastChange;
    }
    if (changes.some((change) => change && typeof change === 'object')) {
        // Object values are then merged one after the other
        return changes.reduce((modifiedData, change) => utils_1.default.fastMerge(modifiedData, change, shouldRemoveNestedNulls), (existingValue || {}));
    }
    // If we have anything else we can't merge it so we'll
    // simply return the last value that was queued
    return lastChange;
}
/**
 * Merge user provided default key value pairs.
 */
function initializeWithDefaultKeyStates() {
    return storage_1.default.multiGet(Object.keys(defaultKeyStates)).then((pairs) => {
        const existingDataAsObject = Object.fromEntries(pairs);
        const merged = utils_1.default.fastMerge(existingDataAsObject, defaultKeyStates);
        OnyxCache_1.default.merge(merged !== null && merged !== void 0 ? merged : {});
        Object.entries(merged !== null && merged !== void 0 ? merged : {}).forEach(([key, value]) => keyChanged(key, value, existingDataAsObject));
    });
}
/**
 * Verify if the collection is valid for merging into the collection key using mergeCollection()
 */
function isValidMergeCollection(collectionKey, collection) {
    if (typeof collection !== 'object' || Array.isArray(collection) || utils_1.default.isEmptyObject(collection)) {
        Logger.logInfo('mergeCollection() called with invalid or empty value. Skipping this update.');
        return false;
    }
    // Confirm all the collection keys belong to the same parent
    let hasCollectionKeyCheckFailed = false;
    Object.keys(collection).forEach((dataKey) => {
        if (OnyxUtils.isKeyMatch(collectionKey, dataKey)) {
            return;
        }
        if (process.env.NODE_ENV === 'development') {
            throw new Error(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
        }
        hasCollectionKeyCheckFailed = true;
        Logger.logAlert(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
    });
    return !hasCollectionKeyCheckFailed;
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
    getCollectionKeys,
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
    getSnapshotKey,
    isValidMergeCollection,
};
exports.default = OnyxUtils;
