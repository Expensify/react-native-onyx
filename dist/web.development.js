(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("fast-equals"), require("underscore"), require("react-dom"), require("idb-keyval"), require("lodash/transform"), require("react"));
	else if(typeof define === 'function' && define.amd)
		define(["fast-equals", "underscore", "react-dom", "idb-keyval", "lodash/transform", "react"], factory);
	else if(typeof exports === 'object')
		exports["react-native-onyx/web"] = factory(require("fast-equals"), require("underscore"), require("react-dom"), require("idb-keyval"), require("lodash/transform"), require("react"));
	else
		root["react-native-onyx/web"] = factory(root["fast-equals"], root["underscore"], root["react-dom"], root["idb-keyval"], root["lodash/transform"], root["react"]);
})(self, (__WEBPACK_EXTERNAL_MODULE_fast_equals__, __WEBPACK_EXTERNAL_MODULE_underscore__, __WEBPACK_EXTERNAL_MODULE_react_dom__, __WEBPACK_EXTERNAL_MODULE_idb_keyval__, __WEBPACK_EXTERNAL_MODULE_lodash_transform__, __WEBPACK_EXTERNAL_MODULE_react__) => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./lib/ActiveClientManager/index.web.js":
/*!**********************************************!*\
  !*** ./lib/ActiveClientManager/index.web.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "init": () => (/* binding */ init),
/* harmony export */   "isClientTheLeader": () => (/* binding */ isClientTheLeader),
/* harmony export */   "isReady": () => (/* binding */ isReady),
/* harmony export */   "subscribeToClientChange": () => (/* binding */ subscribeToClientChange)
/* harmony export */ });
/* harmony import */ var _Str__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../Str */ "./lib/Str.js");
/* harmony import */ var _broadcast__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../broadcast */ "./lib/broadcast/index.web.js");
/**
 * When you have many tabs in one browser, the data of Onyx is shared between all of them. Since we persist write requests in Onyx, we need to ensure that
 * only one tab is processing those saved requests or we would be duplicating data (or creating errors).
 * This file ensures exactly that by tracking all the clientIDs connected, storing the most recent one last and it considers that last clientID the "leader".
 */




const NEW_LEADER_MESSAGE = 'NEW_LEADER';
const REMOVED_LEADER_MESSAGE = 'REMOVE_LEADER';

const clientID = _Str__WEBPACK_IMPORTED_MODULE_0__.guid();
const subscribers = [];
let timestamp = null;

let activeClientID = null;
let setIsReady = () => {};
const isReadyPromise = new Promise((resolve) => {
  setIsReady = resolve;
});

/**
 * Determines when the client is ready. We need to wait both till we saved our ID in onyx AND the init method was called
 * @returns {Promise}
 */
function isReady() {
  return isReadyPromise;
}

/**
 * Returns a boolean indicating if the current client is the leader.
 *
 * @returns {Boolean}
 */
function isClientTheLeader() {
  return activeClientID === clientID;
}

/**
 * Subscribes to when the client changes.
 * @param {Function} callback
 */
function subscribeToClientChange(callback) {
  subscribers.push(callback);
}

/**
 * Subscribe to the broadcast channel to listen for messages from other tabs, so that
 * all tabs agree on who the leader is, which should always be the last tab to open.
 */
function init() {
  _broadcast__WEBPACK_IMPORTED_MODULE_1__.subscribe((message) => {
    switch (message.data.type) {
      case NEW_LEADER_MESSAGE:{
          // Only update the active leader if the message received was from another
          // tab that initialized after the current one; if the timestamps are the
          // same, it uses the client ID to tie-break
          const isTimestampEqual = timestamp === message.data.timestamp;
          const isTimestampNewer = timestamp > message.data.timestamp;
          if (isClientTheLeader() && (isTimestampNewer || isTimestampEqual && clientID > message.data.clientID)) {
            return;
          }
          activeClientID = message.data.clientID;

          subscribers.forEach((callback) => callback());
          break;
        }
      case REMOVED_LEADER_MESSAGE:
        activeClientID = clientID;
        timestamp = Date.now();
        _broadcast__WEBPACK_IMPORTED_MODULE_1__.sendMessage({ type: NEW_LEADER_MESSAGE, clientID, timestamp });
        subscribers.forEach((callback) => callback());
        break;
      default:
        break;}

  });

  activeClientID = clientID;
  timestamp = Date.now();

  _broadcast__WEBPACK_IMPORTED_MODULE_1__.sendMessage({ type: NEW_LEADER_MESSAGE, clientID, timestamp });
  setIsReady();

  window.addEventListener('beforeunload', () => {
    if (!isClientTheLeader()) {
      return;
    }
    _broadcast__WEBPACK_IMPORTED_MODULE_1__.sendMessage({ type: REMOVED_LEADER_MESSAGE, clientID });
  });
}



/***/ }),

/***/ "./lib/Logger.js":
/*!***********************!*\
  !*** ./lib/Logger.js ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "logAlert": () => (/* binding */ logAlert),
/* harmony export */   "logInfo": () => (/* binding */ logInfo),
/* harmony export */   "registerLogger": () => (/* binding */ registerLogger)
/* harmony export */ });
// Logging callback
let logger = () => {};

/**
 * Register the logging callback
 *
 * @param {Function} callback
 */
function registerLogger(callback) {
  logger = callback;
}

/**
 * Send an alert message to the logger
 *
 * @param {String} message
 */
function logAlert(message) {
  logger({ message: `[Onyx] ${message}`, level: 'alert' });
}

/**
 * Send an info message to the logger
 *
 * @param {String} message
 */
function logInfo(message) {
  logger({ message: `[Onyx] ${message}`, level: 'info' });
}



/***/ }),

/***/ "./lib/Onyx.js":
/*!*********************!*\
  !*** ./lib/Onyx.js ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var fast_equals__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! fast-equals */ "fast-equals");
/* harmony import */ var fast_equals__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fast_equals__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _Logger__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./Logger */ "./lib/Logger.js");
/* harmony import */ var _OnyxCache__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./OnyxCache */ "./lib/OnyxCache.js");
/* harmony import */ var _Str__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./Str */ "./lib/Str.js");
/* harmony import */ var _createDeferredTask__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./createDeferredTask */ "./lib/createDeferredTask.js");
/* harmony import */ var _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./metrics/PerformanceUtils */ "./lib/metrics/PerformanceUtils.js");
/* harmony import */ var _storage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./storage */ "./lib/storage/index.web.js");
/* harmony import */ var _broadcast__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./broadcast */ "./lib/broadcast/index.web.js");
/* harmony import */ var _ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./ActiveClientManager */ "./lib/ActiveClientManager/index.web.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./utils */ "./lib/utils.js");
/* harmony import */ var _batch__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./batch */ "./lib/batch.js");
/* eslint-disable no-continue */













// Method constants
const METHOD = {
  SET: 'set',
  MERGE: 'merge',
  MERGE_COLLECTION: 'mergecollection',
  MULTI_SET: 'multiset',
  CLEAR: 'clear'
};

const ON_CLEAR = 'on_clear';

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
const deferredInitTask = (0,_createDeferredTask__WEBPACK_IMPORTED_MODULE_2__["default"])();

// The promise of the clear function, saved so that no writes happen while it's executing
let isClearing = false;

// Callback to be executed after the clear execution ends
let onClearCallback = null;

let batchUpdatesPromise = null;
let batchUpdatesQueue = [];

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
      (0,_batch__WEBPACK_IMPORTED_MODULE_3__["default"])(() => {
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
underscore__WEBPACK_IMPORTED_MODULE_1___default().reduce(
collection,
(finalCollection, item, key) => {
  // eslint-disable-next-line no-param-reassign
  finalCollection[key] = getSubsetOfData(item, selector, withOnyxInstanceState);

  return finalCollection;
},
{});


/**
 * Get some data from the store
 *
 * @private
 * @param {string} key
 * @returns {Promise<*>}
 */
function get(key) {
  // When we already have the value in cache - resolve right away
  if (_OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].hasCacheForKey(key)) {
    return Promise.resolve(_OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getValue(key));
  }

  const taskName = `get:${key}`;

  // When a value retrieving task for this key is still running hook to it
  if (_OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].hasPendingTask(taskName)) {
    return _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getTaskPromise(taskName);
  }

  // Otherwise retrieve the value from storage and capture a promise to aid concurrent usages
  const promise = _storage__WEBPACK_IMPORTED_MODULE_5__["default"].getItem(key).
  then((val) => {
    _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].set(key, val);
    return val;
  }).
  catch((err) => _Logger__WEBPACK_IMPORTED_MODULE_6__.logInfo(`Unable to get item from persistent storage. Key: ${key} Error: ${err}`));

  return _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].captureTask(taskName, promise);
}

/**
 * Returns current key names stored in persisted storage
 * @private
 * @returns {Promise<string[]>}
 */
function getAllKeys() {
  // When we've already read stored keys, resolve right away
  const storedKeys = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getAllKeys();
  if (storedKeys.length > 0) {
    return Promise.resolve(storedKeys);
  }

  const taskName = 'getAllKeys';

  // When a value retrieving task for all keys is still running hook to it
  if (_OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].hasPendingTask(taskName)) {
    return _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getTaskPromise(taskName);
  }

  // Otherwise retrieve the keys from storage and capture a promise to aid concurrent usages
  const promise = _storage__WEBPACK_IMPORTED_MODULE_5__["default"].getAllKeys().then((keys) => {
    underscore__WEBPACK_IMPORTED_MODULE_1___default().each(keys, (key) => _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].addKey(key));
    return keys;
  });

  return _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].captureTask(taskName, promise);
}

/**
 * Checks to see if the a subscriber's supplied key
 * is associated with a collection of keys.
 *
 * @private
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
  return _Str__WEBPACK_IMPORTED_MODULE_7__.startsWith(key, collectionKey) && key.length > collectionKey.length;
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
  return isCollectionKey(configKey) ? _Str__WEBPACK_IMPORTED_MODULE_7__.startsWith(key, configKey) : configKey === key;
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
  return underscore__WEBPACK_IMPORTED_MODULE_1___default().some(evictionAllowList, (key) => isKeyMatch(key, testKey));
}

/**
 * Tries to get a value from the cache. If the value is not present in cache it will return the default value or undefined.
 * If the requested key is a collection, it will return an object with all the collection members.
 *
 * @param {String} key
 * @param {Object} mapping
 * @returns {Mixed}
 */
function tryGetCachedValue(key) {let mapping = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  let val = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getValue(key);

  if (isCollectionKey(key)) {
    const allCacheKeys = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getAllKeys();

    // It is possible we haven't loaded all keys yet so we do not know if the
    // collection actually exists.
    if (allCacheKeys.length === 0) {
      return;
    }
    const matchingKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().filter(allCacheKeys, (k) => k.startsWith(key));
    const values = underscore__WEBPACK_IMPORTED_MODULE_1___default().reduce(
    matchingKeys,
    (finalObject, matchedKey) => {
      const cachedValue = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getValue(matchedKey);
      if (cachedValue) {
        // This is permissible because we're in the process of constructing the final object in a reduce function.
        // eslint-disable-next-line no-param-reassign
        finalObject[matchedKey] = cachedValue;
      }
      return finalObject;
    },
    {});


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
  recentlyAccessedKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().without(recentlyAccessedKeys, key);
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
  evictionBlocklist[key] = underscore__WEBPACK_IMPORTED_MODULE_1___default().without(evictionBlocklist[key] || [], connectionID);

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
    underscore__WEBPACK_IMPORTED_MODULE_1___default().each(evictionAllowList, (safeEvictionKey) => {
      underscore__WEBPACK_IMPORTED_MODULE_1___default().each(keys, (key) => {
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
  const collectionMemberKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().filter(_OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getAllKeys(), (storedKey) => isCollectionMemberKey(collectionKey, storedKey));

  return underscore__WEBPACK_IMPORTED_MODULE_1___default().reduce(
  collectionMemberKeys,
  (prev, curr) => {
    const cachedValue = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getValue(curr);
    if (!cachedValue) {
      return prev;
    }

    // eslint-disable-next-line no-param-reassign
    prev[curr] = cachedValue;
    return prev;
  },
  {});

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
function keysChanged(collectionKey, partialCollection) {let notifyRegularSubscibers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;let notifyWithOnyxSubscibers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
  // We are iterating over all subscribers similar to keyChanged(). However, we are looking for subscribers who are subscribing to either a collection key or
  // individual collection key member for the collection that is being updated. It is important to note that the collection parameter cane be a PARTIAL collection
  // and does not represent all of the combined keys and values for a collection key. It is just the "new" data that was merged in via mergeCollection().
  const stateMappingKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().keys(callbackToStateMapping);
  for (let i = 0; i < stateMappingKeys.length; i++) {
    const subscriber = callbackToStateMapping[stateMappingKeys[i]];
    if (!subscriber) {
      continue;
    }

    // Skip iteration if we do not have a collection key or a collection member key on this subscriber
    if (!_Str__WEBPACK_IMPORTED_MODULE_7__.startsWith(subscriber.key, collectionKey)) {
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
    if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isFunction(subscriber.callback)) {
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
        const dataKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().keys(partialCollection);
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

            if (!(0,fast_equals__WEBPACK_IMPORTED_MODULE_0__.deepEqual)(previousData, newData)) {
              return {
                [subscriber.statePropertyName]: newData
              };
            }
            return null;
          });
          continue;
        }

        subscriber.withOnyxInstance.setStateProxy((prevState) => {
          const finalCollection = underscore__WEBPACK_IMPORTED_MODULE_1___default().clone(prevState[subscriber.statePropertyName] || {});
          const dataKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().keys(partialCollection);
          for (let j = 0; j < dataKeys.length; j++) {
            const dataKey = dataKeys[j];
            finalCollection[dataKey] = cachedCollection[dataKey];
          }

          _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.logSetStateCall(subscriber, prevState[subscriber.statePropertyName], finalCollection, 'keysChanged', collectionKey);
          return {
            [subscriber.statePropertyName]: finalCollection
          };
        });
        continue;
      }

      // If a React component is only interested in a single key then we can set the cached value directly to the state name.
      if (isSubscribedToCollectionMemberKey) {
        // However, we only want to update this subscriber if the partial data contains a change.
        // Otherwise, we would update them with a value they already have and trigger an unnecessary re-render.
        const dataFromCollection = partialCollection[subscriber.key];
        if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isUndefined(dataFromCollection)) {
          continue;
        }

        // If the subscriber has a selector, then the component's state must only be updated with the data
        // returned by the selector and the state should only change when the subset of data changes from what
        // it was previously.
        if (subscriber.selector) {
          subscriber.withOnyxInstance.setStateProxy((prevState) => {
            const prevData = prevState[subscriber.statePropertyName];
            const newData = getSubsetOfData(cachedCollection[subscriber.key], subscriber.selector, subscriber.withOnyxInstance.state);
            if (!(0,fast_equals__WEBPACK_IMPORTED_MODULE_0__.deepEqual)(prevData, newData)) {
              _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.logSetStateCall(subscriber, prevData, newData, 'keysChanged', collectionKey);
              return {
                [subscriber.statePropertyName]: newData
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
          if (_utils__WEBPACK_IMPORTED_MODULE_9__["default"].areObjectsEmpty(data, previousData)) {
            return null;
          }
          if (data === previousData) {
            return null;
          }

          _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.logSetStateCall(subscriber, previousData, data, 'keysChanged', collectionKey);
          return {
            [subscriber.statePropertyName]: data
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
 * @param {Function} [canUpdateSubscriber] only subscribers that pass this truth test will be updated
 * @param {boolean} [notifyRegularSubscibers=true]
 * @param {boolean} [notifyWithOnyxSubscibers=true]
 */
function keyChanged(key, data, canUpdateSubscriber) {let notifyRegularSubscibers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;let notifyWithOnyxSubscibers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;
  // Add or remove this key from the recentlyAccessedKeys lists
  if (!underscore__WEBPACK_IMPORTED_MODULE_1___default().isNull(data)) {
    addLastAccessedKey(key);
  } else {
    removeLastAccessedKey(key);
  }

  // We are iterating over all subscribers to see if they are interested in the key that has just changed. If the subscriber's  key is a collection key then we will
  // notify them if the key that changed is a collection member. Or if it is a regular key notify them when there is an exact match. Depending on whether the subscriber
  // was connected via withOnyx we will call setState() directly on the withOnyx instance. If it is a regular connection we will pass the data to the provided callback.
  const stateMappingKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().keys(callbackToStateMapping);
  for (let i = 0; i < stateMappingKeys.length; i++) {
    const subscriber = callbackToStateMapping[stateMappingKeys[i]];
    if (!subscriber || !isKeyMatch(subscriber.key, key) || underscore__WEBPACK_IMPORTED_MODULE_1___default().isFunction(canUpdateSubscriber) && !canUpdateSubscriber(subscriber)) {
      continue;
    }

    // Subscriber is a regular call to connect() and provided a callback
    if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isFunction(subscriber.callback)) {
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
            const prevData = prevState[subscriber.statePropertyName];
            const newData = {
              [key]: getSubsetOfData(data, subscriber.selector, subscriber.withOnyxInstance.state)
            };
            const prevDataWithNewData = {
              ...prevData,
              ...newData
            };
            if (!(0,fast_equals__WEBPACK_IMPORTED_MODULE_0__.deepEqual)(prevData, prevDataWithNewData)) {
              _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.logSetStateCall(subscriber, prevData, newData, 'keyChanged', key);
              return {
                [subscriber.statePropertyName]: prevDataWithNewData
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
            [key]: data
          };
          _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.logSetStateCall(subscriber, collection, newCollection, 'keyChanged', key);
          return {
            [subscriber.statePropertyName]: newCollection
          };
        });
        continue;
      }

      // If the subscriber has a selector, then the component's state must only be updated with the data
      // returned by the selector and only if the selected data has changed.
      if (subscriber.selector) {
        subscriber.withOnyxInstance.setStateProxy((prevState) => {
          const previousValue = getSubsetOfData(prevState[subscriber.statePropertyName], subscriber.selector, subscriber.withOnyxInstance.state);
          const newValue = getSubsetOfData(data, subscriber.selector, subscriber.withOnyxInstance.state);
          if (!(0,fast_equals__WEBPACK_IMPORTED_MODULE_0__.deepEqual)(previousValue, newValue)) {
            return {
              [subscriber.statePropertyName]: newValue
            };
          }
          return null;
        });
        continue;
      }

      // If we did not match on a collection key then we just set the new data to the state property
      subscriber.withOnyxInstance.setStateProxy((prevState) => {
        const previousData = prevState[subscriber.statePropertyName];

        // Avoids triggering unnecessary re-renders when feeding empty objects
        if (_utils__WEBPACK_IMPORTED_MODULE_9__["default"].areObjectsEmpty(data, previousData)) {
          return null;
        }
        if (previousData === data) {
          return null;
        }

        _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.logSetStateCall(subscriber, previousData, data, 'keyChanged', key);
        return {
          [subscriber.statePropertyName]: data
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

    _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.logSetStateCall(mapping, null, newData, 'sendDataToConnection');
    if (isBatched) {
      batchUpdates(() => {
        mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData);
      });
    } else {
      mapping.withOnyxInstance.setWithOnyxState(mapping.statePropertyName, newData);
    }
    return;
  }

  if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isFunction(mapping.callback)) {
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
  _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].removeLeastRecentlyUsedKeys();

  if (mapping.withOnyxInstance && !isCollectionKey(mapping.key)) {
    // All React components subscribing to a key flagged as a safe eviction key must implement the canEvict property.
    if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isUndefined(mapping.canEvict)) {
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
  Promise.all(underscore__WEBPACK_IMPORTED_MODULE_1___default().map(matchingKeys, (key) => get(key))).
  then((values) =>
  underscore__WEBPACK_IMPORTED_MODULE_1___default().reduce(
  values,
  (finalObject, value, i) => {
    // eslint-disable-next-line no-param-reassign
    finalObject[matchingKeys[i]] = value;
    return finalObject;
  },
  {})).


  then((val) => sendDataToConnection(mapping, val, undefined, true));
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
  deferredInitTask.promise.
  then(() => addKeyToRecentlyAccessedIfNeeded(mapping)).
  then(() => {
    // Performance improvement
    // If the mapping is connected to an onyx key that is not a collection
    // we can skip the call to getAllKeys() and return an array with a single item
    if (Boolean(mapping.key) && typeof mapping.key === 'string' && !mapping.key.endsWith('_') && _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].storageKeys.has(mapping.key)) {
      return [mapping.key];
    }
    return getAllKeys();
  }).
  then((keys) => {
    // We search all the keys in storage to see if any are a "match" for the subscriber we are connecting so that we
    // can send data back to the subscriber. Note that multiple keys can match as a subscriber could either be
    // subscribed to a "collection key" or a single key.
    const matchingKeys = underscore__WEBPACK_IMPORTED_MODULE_1___default().filter(keys, (key) => isKeyMatch(mapping.key, key));

    // If the key being connected to does not exist we initialize the value with null. For subscribers that connected
    // directly via connect() they will simply get a null value sent to them without any information about which key matched
    // since there are none matched. In withOnyx() we wait for all connected keys to return a value before rendering the child
    // component. This null value will be filtered out so that the connected component can utilize defaultProps.
    if (matchingKeys.length === 0) {
      if (mapping.key && !isCollectionKey(mapping.key)) {
        _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].set(mapping.key, null);
      }

      // Here we cannot use batching because the null value is expected to be set immediately for default props
      // or they will be undefined.
      sendDataToConnection(mapping, null, undefined, false);
      return;
    }

    // When using a callback subscriber we will either trigger the provided callback for each key we find or combine all values
    // into an object and just make a single call. The latter behavior is enabled by providing a waitForCollectionCallback key
    // combined with a subscription to a collection key.
    if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isFunction(mapping.callback)) {
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
 * @param {Function} [canUpdateSubscriber] only subscribers that pass this truth test will be updated
 * @returns {Promise}
 */
function scheduleSubscriberUpdate(key, value, canUpdateSubscriber) {
  const promise = Promise.resolve().then(() => keyChanged(key, value, canUpdateSubscriber, true, false));
  batchUpdates(() => keyChanged(key, value, canUpdateSubscriber, false, true));
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
  _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].drop(key);
  scheduleSubscriberUpdate(key, null);
  return _storage__WEBPACK_IMPORTED_MODULE_5__["default"].removeItem(key);
}

/**
 * @private
 * @returns {Promise<void>}
 */
function reportStorageQuota() {
  return _storage__WEBPACK_IMPORTED_MODULE_5__["default"].getDatabaseSize().
  then((_ref) => {let { bytesUsed, bytesRemaining } = _ref;
    _Logger__WEBPACK_IMPORTED_MODULE_6__.logInfo(`Storage Quota Check -- bytesUsed: ${bytesUsed} bytesRemaining: ${bytesRemaining}`);
  }).
  catch((dbSizeError) => {
    _Logger__WEBPACK_IMPORTED_MODULE_6__.logAlert(`Unable to get database size. Error: ${dbSizeError}`);
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
function evictStorageAndRetry(error, onyxMethod) {for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {args[_key - 2] = arguments[_key];}
  _Logger__WEBPACK_IMPORTED_MODULE_6__.logInfo(`Failed to save to storage. Error: ${error}. onyxMethod: ${onyxMethod.name}`);

  if (error && _Str__WEBPACK_IMPORTED_MODULE_7__.startsWith(error.message, "Failed to execute 'put' on 'IDBObjectStore'")) {
    _Logger__WEBPACK_IMPORTED_MODULE_6__.logAlert('Attempted to set invalid data set in Onyx. Please ensure all data is serializable.');
    throw error;
  }

  // Find the first key that we can remove that has no subscribers in our blocklist
  const keyForRemoval = underscore__WEBPACK_IMPORTED_MODULE_1___default().find(recentlyAccessedKeys, (key) => !evictionBlocklist[key]);
  if (!keyForRemoval) {
    // If we have no acceptable keys to remove then we are possibly trying to save mission critical data. If this is the case,
    // then we should stop retrying as there is not much the user can do to fix this. Instead of getting them stuck in an infinite loop we
    // will allow this write to be skipped.
    _Logger__WEBPACK_IMPORTED_MODULE_6__.logAlert('Out of storage. But found no acceptable keys to remove.');
    return reportStorageQuota();
  }

  // Remove the least recently viewed key that is not currently being accessed and retry.
  _Logger__WEBPACK_IMPORTED_MODULE_6__.logInfo(`Out of storage. Evicting least recently accessed key (${keyForRemoval}) and retrying.`);
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
function broadcastUpdate(key, value, method, hasChanged) {let wasRemoved = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  // Logging properties only since values could be sensitive things we don't want to log
  _Logger__WEBPACK_IMPORTED_MODULE_6__.logInfo(`${method}() called for key: ${key}${underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject(value) ? ` properties: ${underscore__WEBPACK_IMPORTED_MODULE_1___default().keys(value).join(',')}` : ''}`);

  // Update subscribers if the cached value has changed, or when the subscriber specifically requires
  // all updates regardless of value changes (indicated by initWithStoredValues set to false).
  if (hasChanged && !wasRemoved) {
    _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].set(key, value);
  } else {
    _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].addToAccessedKeys(key);
  }

  return scheduleSubscriberUpdate(key, value, (subscriber) => hasChanged || subscriber.initWithStoredValues === false);
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
  if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isNull(value)) {
    remove(key);
    return { value, wasRemoved: true };
  }

  // We can remove all null values in an object by merging it with itself
  // utils.fastMerge recursively goes through the object and removes all null values
  // Passing two identical objects as source and target to fastMerge will not change it, but only remove the null values
  return { value: _utils__WEBPACK_IMPORTED_MODULE_9__["default"].removeNestedNullValues(value), wasRemoved: false };
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
  if (!_ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isClientTheLeader()) {
    _broadcast__WEBPACK_IMPORTED_MODULE_11__.sendMessage({ type: METHOD.SET, key, value });
    return Promise.resolve();
  }

  if (isClearing) {
    return Promise.resolve();
  }

  // If the value is null, we remove the key from storage
  const { value: valueAfterRemoving, wasRemoved } = removeNullValues(key, value);

  if (hasPendingMergeForKey(key)) {
    delete mergeQueue[key];
  }

  const hasChanged = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].hasValueChanged(key, valueAfterRemoving);

  // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
  const updatePromise = broadcastUpdate(key, valueAfterRemoving, 'set', hasChanged, wasRemoved);

  // If the value has not changed or the key got removed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
  if (!hasChanged || wasRemoved) {
    return updatePromise;
  }

  return _storage__WEBPACK_IMPORTED_MODULE_5__["default"].setItem(key, valueAfterRemoving).
  catch((error) => evictStorageAndRetry(error, set, key, valueAfterRemoving)).
  then(() => updatePromise);
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

  underscore__WEBPACK_IMPORTED_MODULE_1___default().forEach(data, (value, key) => {
    const { value: valueAfterRemoving, wasRemoved } = removeNullValues(key, value);

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
  if (!_ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isClientTheLeader()) {
    _broadcast__WEBPACK_IMPORTED_MODULE_11__.sendMessage({ type: METHOD.MULTI_SET, data });
    return Promise.resolve();
  }

  if (isClearing) {
    return Promise.resolve();
  }

  const keyValuePairs = prepareKeyValuePairsForStorage(data);

  const updatePromises = underscore__WEBPACK_IMPORTED_MODULE_1___default().map(keyValuePairs, (_ref2) => {let [key, value] = _ref2;
    // Update cache and optimistically inform subscribers on the next tick
    _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].set(key, value);
    return scheduleSubscriberUpdate(key, value);
  });

  return _storage__WEBPACK_IMPORTED_MODULE_5__["default"].multiSet(keyValuePairs).
  catch((error) => evictStorageAndRetry(error, multiSet, data)).
  then(() => Promise.all(updatePromises));
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
  const lastChange = underscore__WEBPACK_IMPORTED_MODULE_1___default().last(changes);

  if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isArray(lastChange)) {
    return lastChange;
  }

  if (underscore__WEBPACK_IMPORTED_MODULE_1___default().some(changes, (underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject))) {
    // Object values are then merged one after the other
    return underscore__WEBPACK_IMPORTED_MODULE_1___default().reduce(changes, (modifiedData, change) => _utils__WEBPACK_IMPORTED_MODULE_9__["default"].fastMerge(modifiedData, change, shouldRemoveNullObjectValues), existingValue || {});
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
  if (!_ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isClientTheLeader()) {
    _broadcast__WEBPACK_IMPORTED_MODULE_11__.sendMessage({ type: METHOD.MERGE, key, changes });
    return Promise.resolve();
  }

  if (isClearing) {
    return Promise.resolve();
  }

  // Top-level undefined values are ignored
  // Therefore we need to prevent adding them to the merge queue
  if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isUndefined(changes)) {
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
      const shouldOverwriteExistingValue = underscore__WEBPACK_IMPORTED_MODULE_1___default().includes(mergeQueue[key], null);

      // Clean up the write queue, so we don't apply these changes again
      delete mergeQueue[key];
      delete mergeQueuePromise[key];

      // If the batched changes equal null, we want to remove the key from storage, to reduce storage size
      const { wasRemoved } = removeNullValues(key, batchedChanges);

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

      const hasChanged = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].hasValueChanged(key, modifiedData);

      // This approach prioritizes fast UI changes without waiting for data to be stored in device storage.
      const updatePromise = broadcastUpdate(key, modifiedData, 'merge', hasChanged, wasRemoved);

      // If the value has not changed, calling Storage.setItem() would be redundant and a waste of performance, so return early instead.
      if (!hasChanged || isClearing || wasRemoved) {
        return updatePromise;
      }

      return _storage__WEBPACK_IMPORTED_MODULE_5__["default"].mergeItem(key, batchedChanges, modifiedData).then(() => updatePromise);
    } catch (error) {
      _Logger__WEBPACK_IMPORTED_MODULE_6__.logAlert(`An error occurred while applying merge for key: ${key}, Error: ${error}`);
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
  return _storage__WEBPACK_IMPORTED_MODULE_5__["default"].multiGet(underscore__WEBPACK_IMPORTED_MODULE_1___default().keys(defaultKeyStates)).then((pairs) => {
    const asObject = underscore__WEBPACK_IMPORTED_MODULE_1___default().object(pairs);

    const merged = _utils__WEBPACK_IMPORTED_MODULE_9__["default"].fastMerge(asObject, defaultKeyStates);
    _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].merge(merged);
    underscore__WEBPACK_IMPORTED_MODULE_1___default().each(merged, (val, key) => keyChanged(key, val));
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
function clear() {let keysToPreserve = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  if (!_ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isClientTheLeader()) {
    _broadcast__WEBPACK_IMPORTED_MODULE_11__.sendMessage({ type: METHOD.CLEAR, keysToPreserve });
    return Promise.resolve();
  }

  if (isClearing) {
    return Promise.resolve();
  }

  isClearing = true;

  return getAllKeys().then((keys) => {
    const keysToBeClearedFromStorage = [];
    const keyValuesToResetAsCollection = {};
    const keyValuesToResetIndividually = {};

    // The only keys that should not be cleared are:
    // 1. Anything specifically passed in keysToPreserve (because some keys like language preferences, offline
    //      status, or activeClients need to remain in Onyx even when signed out)
    // 2. Any keys with a default state (because they need to remain in Onyx as their default, and setting them
    //      to null would cause unknown behavior)
    underscore__WEBPACK_IMPORTED_MODULE_1___default().each(keys, (key) => {
      const isKeyToPreserve = underscore__WEBPACK_IMPORTED_MODULE_1___default().contains(keysToPreserve, key);
      const isDefaultKey = underscore__WEBPACK_IMPORTED_MODULE_1___default().has(defaultKeyStates, key);

      // If the key is being removed or reset to default:
      // 1. Update it in the cache
      // 2. Figure out whether it is a collection key or not,
      //      since collection key subscribers need to be updated differently
      if (!isKeyToPreserve) {
        const oldValue = _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].getValue(key);
        const newValue = underscore__WEBPACK_IMPORTED_MODULE_1___default().get(defaultKeyStates, key, null);
        if (newValue !== oldValue) {
          _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].set(key, newValue);
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
    underscore__WEBPACK_IMPORTED_MODULE_1___default().each(keyValuesToResetIndividually, (value, key) => {
      updatePromises.push(scheduleSubscriberUpdate(key, value));
    });
    underscore__WEBPACK_IMPORTED_MODULE_1___default().each(keyValuesToResetAsCollection, (value, key) => {
      updatePromises.push(scheduleNotifyCollectionSubscribers(key, value));
    });

    const defaultKeyValuePairs = underscore__WEBPACK_IMPORTED_MODULE_1___default().pairs(underscore__WEBPACK_IMPORTED_MODULE_1___default().omit(defaultKeyStates, keysToPreserve));

    // Remove only the items that we want cleared from storage, and reset others to default
    underscore__WEBPACK_IMPORTED_MODULE_1___default().each(keysToBeClearedFromStorage, (key) => _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].drop(key));
    return _storage__WEBPACK_IMPORTED_MODULE_5__["default"].removeItems(keysToBeClearedFromStorage).
    then(() => _storage__WEBPACK_IMPORTED_MODULE_5__["default"].multiSet(defaultKeyValuePairs)).
    then(() => {
      isClearing = false;
      _broadcast__WEBPACK_IMPORTED_MODULE_11__.sendMessage({ type: METHOD.CLEAR, keysToPreserve });
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
  if (!underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject(collection) || underscore__WEBPACK_IMPORTED_MODULE_1___default().isArray(collection) || underscore__WEBPACK_IMPORTED_MODULE_1___default().isEmpty(collection)) {
    _Logger__WEBPACK_IMPORTED_MODULE_6__.logInfo('mergeCollection() called with invalid or empty value. Skipping this update.');
    return Promise.resolve();
  }

  // Confirm all the collection keys belong to the same parent
  let hasCollectionKeyCheckFailed = false;
  underscore__WEBPACK_IMPORTED_MODULE_1___default().each(collection, (_data, dataKey) => {
    if (isKeyMatch(collectionKey, dataKey)) {
      return;
    }

    if (true) {
      throw new Error(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
    }

    hasCollectionKeyCheckFailed = true;
    _Logger__WEBPACK_IMPORTED_MODULE_6__.logAlert(`Provided collection doesn't have all its data belonging to the same parent. CollectionKey: ${collectionKey}, DataKey: ${dataKey}`);
  });

  // Gracefully handle bad mergeCollection updates so it doesn't block the merge queue
  if (hasCollectionKeyCheckFailed) {
    return Promise.resolve();
  }

  return getAllKeys().then((persistedKeys) => {
    // Split to keys that exist in storage and keys that don't
    const [existingKeys, newKeys] = underscore__WEBPACK_IMPORTED_MODULE_1___default().chain(collection).
    pick((value, key) => {
      if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isNull(value)) {
        remove(key);
        return false;
      }
      return true;
    }).
    keys().
    partition((key) => persistedKeys.includes(key)).
    value();

    const existingKeyCollection = underscore__WEBPACK_IMPORTED_MODULE_1___default().pick(collection, existingKeys);
    const newCollection = underscore__WEBPACK_IMPORTED_MODULE_1___default().pick(collection, newKeys);
    const keyValuePairsForExistingCollection = prepareKeyValuePairsForStorage(existingKeyCollection);
    const keyValuePairsForNewCollection = prepareKeyValuePairsForStorage(newCollection);

    const promises = [];

    // New keys will be added via multiSet while existing keys will be updated using multiMerge
    // This is because setting a key that doesn't exist yet with multiMerge will throw errors
    if (keyValuePairsForExistingCollection.length > 0) {
      promises.push(_storage__WEBPACK_IMPORTED_MODULE_5__["default"].multiMerge(keyValuePairsForExistingCollection));
    }

    if (keyValuePairsForNewCollection.length > 0) {
      promises.push(_storage__WEBPACK_IMPORTED_MODULE_5__["default"].multiSet(keyValuePairsForNewCollection));
    }

    // Prefill cache if necessary by calling get() on any existing keys and then merge original data to cache
    // and update all subscribers
    const promiseUpdate = Promise.all(underscore__WEBPACK_IMPORTED_MODULE_1___default().map(existingKeys, get)).then(() => {
      _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].merge(collection);
      return scheduleNotifyCollectionSubscribers(collectionKey, collection);
    });

    return Promise.all(promises).
    catch((error) => evictStorageAndRetry(error, mergeCollection, collection)).
    then(() => promiseUpdate);
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
  underscore__WEBPACK_IMPORTED_MODULE_1___default().each(data, (_ref3) => {let { onyxMethod, key, value } = _ref3;
    if (!underscore__WEBPACK_IMPORTED_MODULE_1___default().contains([METHOD.CLEAR, METHOD.SET, METHOD.MERGE, METHOD.MERGE_COLLECTION, METHOD.MULTI_SET], onyxMethod)) {
      throw new Error(`Invalid onyxMethod ${onyxMethod} in Onyx update.`);
    }
    if (onyxMethod === METHOD.MULTI_SET) {
      // For multiset, we just expect the value to be an object
      if (!underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject(value) || underscore__WEBPACK_IMPORTED_MODULE_1___default().isArray(value) || underscore__WEBPACK_IMPORTED_MODULE_1___default().isFunction(value)) {
        throw new Error('Invalid value provided in Onyx multiSet. Onyx multiSet value must be of type object.');
      }
    } else if (onyxMethod !== METHOD.CLEAR && !underscore__WEBPACK_IMPORTED_MODULE_1___default().isString(key)) {
      throw new Error(`Invalid ${typeof key} key provided in Onyx update. Onyx key must be of type string.`);
    }
  });

  const promises = [];
  let clearPromise = Promise.resolve();

  underscore__WEBPACK_IMPORTED_MODULE_1___default().each(data, (_ref4) => {let { onyxMethod, key, value } = _ref4;
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
        break;}

  });

  return clearPromise.then(() => Promise.all(underscore__WEBPACK_IMPORTED_MODULE_1___default().map(promises, (p) => p())));
}

/**
 * When set these keys will not be persisted to storage
 * @param {string[]} keyList
 */
function setMemoryOnlyKeys(keyList) {
  _storage__WEBPACK_IMPORTED_MODULE_5__["default"].setMemoryOnlyKeys(keyList);

  // When in memory only mode for certain keys we do not want to ever drop items from the cache as the user will have no way to recover them again via storage.
  _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].setRecentKeysLimit(Infinity);
}

/**
 * Sets the callback to be called when the clear finishes executing.
 * @param {Function} callback
 */
function onClear(callback) {
  onClearCallback = callback;
}

/**
 * Subscribes to the Broadcast channel and executes actions based on the
 * types of events.
 */
function subscribeToEvents() {
  _broadcast__WEBPACK_IMPORTED_MODULE_11__.subscribe((_ref5) => {let { data } = _ref5;
    if (!_ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isClientTheLeader()) {
      return;
    }
    switch (data.type) {
      case METHOD.CLEAR:
        clear(data.keysToPreserve);
        break;
      case METHOD.SET:
        set(data.key, data.value);
        break;
      case METHOD.MULTI_SET:
        multiSet(data.key, data.value);
        break;
      case METHOD.MERGE:
        merge(data.key, data.changes);
        break;
      case ON_CLEAR:
        if (!onClearCallback) {
          break;
        }
        onClearCallback();
        break;
      default:
        break;}

  });
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
function init()







{let { keys = {}, initialKeyStates = {}, safeEvictionKeys = [], maxCachedKeysCount = 1000, captureMetrics = false, shouldSyncMultipleInstances = Boolean(__webpack_require__.g.localStorage), debugSetState = false } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  _ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.init();

  _ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isReady().then(() => {
    if (!_ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isClientTheLeader()) {
      return;
    }
    subscribeToEvents();
  });

  if (captureMetrics) {
    // The code here is only bundled and applied when the captureMetrics is set
    // eslint-disable-next-line no-use-before-define
    applyDecorators();
  }

  if (debugSetState) {
    _metrics_PerformanceUtils__WEBPACK_IMPORTED_MODULE_8__.setShouldDebugSetState(true);
  }

  if (maxCachedKeysCount > 0) {
    _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].setRecentKeysLimit(maxCachedKeysCount);
  }

  // We need the value of the collection keys later for checking if a
  // key is a collection. We store it in a map for faster lookup.
  const collectionValues = underscore__WEBPACK_IMPORTED_MODULE_1___default().values(keys.COLLECTION);
  onyxCollectionKeyMap = underscore__WEBPACK_IMPORTED_MODULE_1___default().reduce(
  collectionValues,
  (acc, val) => {
    acc.set(val, true);
    return acc;
  },
  new Map());


  // Set our default key states to use when initializing and clearing Onyx data
  defaultKeyStates = initialKeyStates;

  // Let Onyx know about which keys are safe to evict
  evictionAllowList = safeEvictionKeys;

  // Initialize all of our keys with data provided then give green light to any pending connections
  Promise.all([addAllSafeEvictionKeysToRecentlyAccessedList(), initializeWithDefaultKeyStates()]).then(deferredInitTask.resolve);

  if (shouldSyncMultipleInstances && underscore__WEBPACK_IMPORTED_MODULE_1___default().isFunction(_storage__WEBPACK_IMPORTED_MODULE_5__["default"].keepInstancesSync)) {
    _storage__WEBPACK_IMPORTED_MODULE_5__["default"].keepInstancesSync((key, value) => {
      _OnyxCache__WEBPACK_IMPORTED_MODULE_4__["default"].set(key, value);
      keyChanged(key, value);
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
  registerLogger: _Logger__WEBPACK_IMPORTED_MODULE_6__.registerLogger,
  addToEvictionBlockList,
  removeFromEvictionBlockList,
  isSafeEvictionKey,
  METHOD,
  setMemoryOnlyKeys,
  tryGetCachedValue,
  hasPendingMergeForKey,
  onClear,
  isClientManagerReady: _ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isReady,
  isClientTheLeader: _ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.isClientTheLeader,
  subscribeToClientChange: _ActiveClientManager__WEBPACK_IMPORTED_MODULE_10__.subscribeToClientChange
};

/**
 * Apply calls statistic decorators to benchmark Onyx
 *
 * @private
 */
function applyDecorators() {
  // We're requiring the script dynamically here so that it's only evaluated when decorators are used
  const decorate = __webpack_require__(/*! ./metrics */ "./lib/metrics/index.web.js");

  // Re-assign with decorated functions
  /* eslint-disable no-func-assign */
  get = decorate.decorateWithMetrics(get, 'Onyx:get');
  set = decorate.decorateWithMetrics(set, 'Onyx:set');
  multiSet = decorate.decorateWithMetrics(multiSet, 'Onyx:multiSet');
  clear = decorate.decorateWithMetrics(clear, 'Onyx:clear');
  merge = decorate.decorateWithMetrics(merge, 'Onyx:merge');
  mergeCollection = decorate.decorateWithMetrics(mergeCollection, 'Onyx:mergeCollection');
  getAllKeys = decorate.decorateWithMetrics(getAllKeys, 'Onyx:getAllKeys');
  initializeWithDefaultKeyStates = decorate.decorateWithMetrics(initializeWithDefaultKeyStates, 'Onyx:defaults');
  update = decorate.decorateWithMetrics(update, 'Onyx:update');
  /* eslint-enable */

  // Re-expose decorated methods
  /* eslint-disable rulesdir/prefer-actions-set-data */
  Onyx.set = set;
  Onyx.multiSet = multiSet;
  Onyx.clear = clear;
  Onyx.merge = merge;
  Onyx.mergeCollection = mergeCollection;
  Onyx.update = update;
  /* eslint-enable */

  // Expose stats methods on Onyx
  Onyx.getMetrics = decorate.getMetrics;
  Onyx.resetMetrics = decorate.resetMetrics;
  Onyx.printMetrics = decorate.printMetrics;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (Onyx);

/***/ }),

/***/ "./lib/OnyxCache.js":
/*!**************************!*\
  !*** ./lib/OnyxCache.js ***!
  \**************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var fast_equals__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! fast-equals */ "fast-equals");
/* harmony import */ var fast_equals__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fast_equals__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./utils */ "./lib/utils.js");




const isDefined = underscore__WEBPACK_IMPORTED_MODULE_0___default().negate((underscore__WEBPACK_IMPORTED_MODULE_0___default().isUndefined));

/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */
class OnyxCache {
  constructor() {
    /**
     * @private
     * Cache of all the storage keys available in persistent storage
     * @type {Set<string>}
     */
    this.storageKeys = new Set();

    /**
     * @private
     * Unique list of keys maintained in access order (most recent at the end)
     * @type {Set<string>}
     */
    this.recentKeys = new Set();

    /**
     * @private
     * A map of cached values
     * @type {Record<string, *>}
     */
    this.storageMap = {};

    /**
     * @private
     * Captured pending tasks for already running storage methods
     * Using a map yields better performance on operations such a delete
     * https://www.zhenghao.io/posts/object-vs-map
     * @type {Map<string, Promise>}
     */
    this.pendingPromises = new Map();

    // bind all public methods to prevent problems with `this`
    underscore__WEBPACK_IMPORTED_MODULE_0___default().bindAll(
    this,
    'getAllKeys',
    'getValue',
    'hasCacheForKey',
    'addKey',
    'set',
    'drop',
    'merge',
    'hasPendingTask',
    'getTaskPromise',
    'captureTask',
    'removeLeastRecentlyUsedKeys',
    'setRecentKeysLimit');

  }

  /**
   * Get all the storage keys
   * @returns {string[]}
   */
  getAllKeys() {
    return Array.from(this.storageKeys);
  }

  /**
   * Get a cached value from storage
   * @param {string} key
   * @returns {*}
   */
  getValue(key) {
    this.addToAccessedKeys(key);
    return this.storageMap[key];
  }

  /**
   * Check whether cache has data for the given key
   * @param {string} key
   * @returns {boolean}
   */
  hasCacheForKey(key) {
    return isDefined(this.storageMap[key]);
  }

  /**
   * Saves a key in the storage keys list
   * Serves to keep the result of `getAllKeys` up to date
   * @param {string} key
   */
  addKey(key) {
    this.storageKeys.add(key);
  }

  /**
   * Set's a key value in cache
   * Adds the key to the storage keys list as well
   * @param {string} key
   * @param {*} value
   * @returns {*} value - returns the cache value
   */
  set(key, value) {
    this.addKey(key);
    this.addToAccessedKeys(key);
    this.storageMap[key] = value;

    return value;
  }

  /**
   * Forget the cached value for the given key
   * @param {string} key
   */
  drop(key) {
    delete this.storageMap[key];
    this.storageKeys.delete(key);
    this.recentKeys.delete(key);
  }

  /**
   * Deep merge data to cache, any non existing keys will be created
   * @param {Record<string, *>} data - a map of (cache) key - values
   */
  merge(data) {
    if (!underscore__WEBPACK_IMPORTED_MODULE_0___default().isObject(data) || underscore__WEBPACK_IMPORTED_MODULE_0___default().isArray(data)) {
      throw new Error('data passed to cache.merge() must be an Object of onyx key/value pairs');
    }

    // lodash adds a small overhead so we don't use it here
    // eslint-disable-next-line prefer-object-spread, rulesdir/prefer-underscore-method
    this.storageMap = Object.assign({}, _utils__WEBPACK_IMPORTED_MODULE_2__["default"].fastMerge(this.storageMap, data, false));

    const storageKeys = this.getAllKeys();
    const mergedKeys = underscore__WEBPACK_IMPORTED_MODULE_0___default().keys(data);
    this.storageKeys = new Set([...storageKeys, ...mergedKeys]);
    underscore__WEBPACK_IMPORTED_MODULE_0___default().each(mergedKeys, (key) => this.addToAccessedKeys(key));
  }

  /**
   * Check whether the given task is already running
   * @param {string} taskName - unique name given for the task
   * @returns {*}
   */
  hasPendingTask(taskName) {
    return isDefined(this.pendingPromises.get(taskName));
  }

  /**
   * Use this method to prevent concurrent calls for the same thing
   * Instead of calling the same task again use the existing promise
   * provided from this function
   * @template T
   * @param {string} taskName - unique name given for the task
   * @returns {Promise<T>}
   */
  getTaskPromise(taskName) {
    return this.pendingPromises.get(taskName);
  }

  /**
   * Capture a promise for a given task so other caller can
   * hook up to the promise if it's still pending
   * @template T
   * @param {string} taskName - unique name for the task
   * @param {Promise<T>} promise
   * @returns {Promise<T>}
   */
  captureTask(taskName, promise) {
    const returnPromise = promise.finally(() => {
      this.pendingPromises.delete(taskName);
    });

    this.pendingPromises.set(taskName, returnPromise);

    return returnPromise;
  }

  /**
   * @private
   * Adds a key to the top of the recently accessed keys
   * @param {string} key
   */
  addToAccessedKeys(key) {
    // Removing and re-adding a key ensures it's at the end of the list
    this.recentKeys.delete(key);
    this.recentKeys.add(key);
  }

  /**
   * Remove keys that don't fall into the range of recently used keys
   */
  removeLeastRecentlyUsedKeys() {
    let numKeysToRemove = this.recentKeys.size - this.maxRecentKeysSize;
    if (numKeysToRemove <= 0) {
      return;
    }
    const iterator = this.recentKeys.values();
    const temp = [];
    while (numKeysToRemove > 0) {
      const value = iterator.next().value;
      temp.push(value);
      numKeysToRemove--;
    }

    for (let i = 0; i < temp.length; ++i) {
      delete this.storageMap[temp[i]];
      this.recentKeys.delete(temp[i]);
    }
  }

  /**
   * Set the recent keys list size
   * @param {number} limit
   */
  setRecentKeysLimit(limit) {
    this.maxRecentKeysSize = limit;
  }

  /**
   * @param {String} key
   * @param {*} value
   * @returns {Boolean}
   */
  hasValueChanged(key, value) {
    return !(0,fast_equals__WEBPACK_IMPORTED_MODULE_1__.deepEqual)(this.storageMap[key], value);
  }
}

const instance = new OnyxCache();

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (instance);

/***/ }),

/***/ "./lib/Str.js":
/*!********************!*\
  !*** ./lib/Str.js ***!
  \********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "guid": () => (/* binding */ guid),
/* harmony export */   "result": () => (/* binding */ result),
/* harmony export */   "startsWith": () => (/* binding */ startsWith)
/* harmony export */ });
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_0__);


/**
 * Returns true if the haystack begins with the needle
 *
 * @param {String} haystack  The full string to be searched
 * @param {String} needle    The case-sensitive string to search for
 * @return {Boolean} Returns true if the haystack starts with the needle.
 */
function startsWith(haystack, needle) {
  return underscore__WEBPACK_IMPORTED_MODULE_0___default().isString(haystack) && underscore__WEBPACK_IMPORTED_MODULE_0___default().isString(needle) && haystack.startsWith(needle);
}

/**
 * Checks if parameter is a string or function.
 * If it is a string, then we will just return it.
 * If it is a function, then we will call it with
 * any additional arguments and return the result.
 *
 * @param {String|Function} parameter
 * @returns {*}
 */
function result(parameter) {for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {args[_key - 1] = arguments[_key];}
  return underscore__WEBPACK_IMPORTED_MODULE_0___default().isFunction(parameter) ? parameter(...args) : parameter;
}

/**
 * A simple GUID generator taken from https://stackoverflow.com/a/32760401/9114791
 *
 * @param {String} [prefix] an optional prefix to put in front of the guid
 * @returns {String}
 */
function guid() {let prefix = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).
    toString(16).
    substring(1);
  }
  return `${prefix}${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}



/***/ }),

/***/ "./lib/batch.js":
/*!**********************!*\
  !*** ./lib/batch.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react-dom */ "react-dom");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_dom__WEBPACK_IMPORTED_MODULE_0__);


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (react_dom__WEBPACK_IMPORTED_MODULE_0__.unstable_batchedUpdates);

/***/ }),

/***/ "./lib/broadcast/index.web.js":
/*!************************************!*\
  !*** ./lib/broadcast/index.web.js ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "disconnect": () => (/* binding */ disconnect),
/* harmony export */   "sendMessage": () => (/* binding */ sendMessage),
/* harmony export */   "subscribe": () => (/* binding */ subscribe)
/* harmony export */ });
const BROADCAST_ONYX = 'BROADCAST_ONYX';

const subscriptions = [];
const channel = new BroadcastChannel(BROADCAST_ONYX);

/**
 * Sends a message to the broadcast channel.
 * @param {String} message
 */
function sendMessage(message) {
  channel.postMessage(message);
}

/**
 * Subscribes to the broadcast channel. Every time a new message
 * is received, the callback is called.
 * @param {Function} callback
 */
function subscribe(callback) {
  subscriptions.push(callback);
  channel.onmessage = (message) => {
    subscriptions.forEach((c) => c(message));
  };
}

/**
 * Disconnects from the broadcast channel.
 */
function disconnect() {
  channel.close();
}



/***/ }),

/***/ "./lib/createDeferredTask.js":
/*!***********************************!*\
  !*** ./lib/createDeferredTask.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ createDeferredTask)
/* harmony export */ });
/**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete when we call `resolve`
 * Useful when we want to wait for a tasks that is resolved from an external action
 *
 * @template T
 * @returns {{ resolve: function(*), promise: Promise<T|void> }}
 */
function createDeferredTask() {
  const deferred = {};
  deferred.promise = new Promise((res) => {
    deferred.resolve = res;
  });

  return deferred;
}

/***/ }),

/***/ "./lib/metrics/PerformanceUtils.js":
/*!*****************************************!*\
  !*** ./lib/metrics/PerformanceUtils.js ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "logSetStateCall": () => (/* binding */ logSetStateCall),
/* harmony export */   "setShouldDebugSetState": () => (/* binding */ setShouldDebugSetState)
/* harmony export */ });
/* harmony import */ var lodash_transform__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! lodash/transform */ "lodash/transform");
/* harmony import */ var lodash_transform__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(lodash_transform__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_1__);



let debugSetState = false;

/**
 * @param {Boolean} debug
 */
function setShouldDebugSetState(debug) {
  debugSetState = debug;
}

/**
 * Deep diff between two objects. Useful for figuring out what changed about an object from one render to the next so
 * that state and props updates can be optimized.
 *
 * @param  {Object} object
 * @param  {Object} base
 * @return {Object}
 */
function diffObject(object, base) {
  function changes(obj, comparisonObject) {
    return lodash_transform__WEBPACK_IMPORTED_MODULE_0___default()(obj, (result, value, key) => {
      if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isEqual(value, comparisonObject[key])) {
        return;
      }

      // eslint-disable-next-line no-param-reassign
      result[key] = underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject(value) && underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject(comparisonObject[key]) ? changes(value, comparisonObject[key]) : value;
    });
  }
  return changes(object, base);
}

/**
 * Provide insights into why a setState() call occurred by diffing the before and after values.
 *
 * @param {Object} mapping
 * @param {*} previousValue
 * @param {*} newValue
 * @param {String} caller
 * @param {String} [keyThatChanged]
 */
function logSetStateCall(mapping, previousValue, newValue, caller, keyThatChanged) {
  if (!debugSetState) {
    return;
  }

  const logParams = {};
  if (keyThatChanged) {
    logParams.keyThatChanged = keyThatChanged;
  }
  if (underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject(newValue) && underscore__WEBPACK_IMPORTED_MODULE_1___default().isObject(previousValue)) {
    logParams.difference = diffObject(previousValue, newValue);
  } else {
    logParams.previousValue = previousValue;
    logParams.newValue = newValue;
  }

  console.debug(`[Onyx-Debug] ${mapping.displayName} setState() called. Subscribed to key '${mapping.key}' (${caller})`, logParams);
}



/***/ }),

/***/ "./lib/metrics/index.web.js":
/*!**********************************!*\
  !*** ./lib/metrics/index.web.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "decorateWithMetrics": () => (/* binding */ decorateWithMetrics),
/* harmony export */   "getMetrics": () => (/* binding */ getMetrics),
/* harmony export */   "printMetrics": () => (/* binding */ printMetrics),
/* harmony export */   "resetMetrics": () => (/* binding */ resetMetrics)
/* harmony export */ });
// For web-only implementations of Onyx, this module will just be a no-op

function decorateWithMetrics(func) {
  return func;
}
function getMetrics() {}
function printMetrics() {}
function resetMetrics() {}



/***/ }),

/***/ "./lib/storage/WebStorage.js":
/*!***********************************!*\
  !*** ./lib/storage/WebStorage.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./providers/IDBKeyVal */ "./lib/storage/providers/IDBKeyVal.js");
/**
 * This file is here to wrap IDBKeyVal with a layer that provides data-changed events like the ones that exist
 * when using LocalStorage APIs in the browser. These events are great because multiple tabs can listen for when
 * data changes and then stay up-to-date with everything happening in Onyx.
 */



const SYNC_ONYX = 'SYNC_ONYX';

/**
 * Raise an event thorough `localStorage` to let other tabs know a value changed
 * @param {String} onyxKey
 */
function raiseStorageSyncEvent(onyxKey) {
  __webpack_require__.g.localStorage.setItem(SYNC_ONYX, onyxKey);
  __webpack_require__.g.localStorage.removeItem(SYNC_ONYX, onyxKey);
}

function raiseStorageSyncManyKeysEvent(onyxKeys) {
  underscore__WEBPACK_IMPORTED_MODULE_0___default().each(onyxKeys, (onyxKey) => {
    raiseStorageSyncEvent(onyxKey);
  });
}

const webStorage = {
  ..._providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"],

  /**
   * @param {Function} onStorageKeyChanged Storage synchronization mechanism keeping all opened tabs in sync
   */
  keepInstancesSync(onStorageKeyChanged) {
    // Override set, remove and clear to raise storage events that we intercept in other tabs
    this.setItem = (key, value) => _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"].setItem(key, value).then(() => raiseStorageSyncEvent(key));

    this.removeItem = (key) => _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"].removeItem(key).then(() => raiseStorageSyncEvent(key));

    this.removeItems = (keys) => _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"].removeItems(keys).then(() => raiseStorageSyncManyKeysEvent(keys));

    this.mergeItem = (key, batchedChanges, modifiedData) => _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"].mergeItem(key, batchedChanges, modifiedData).then(() => raiseStorageSyncEvent(key));

    // If we just call Storage.clear other tabs will have no idea which keys were available previously
    // so that they can call keysChanged for them. That's why we iterate over every key and raise a storage sync
    // event for each one
    this.clear = () => {
      let allKeys;

      // The keys must be retrieved before storage is cleared or else the list of keys would be empty
      return _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"].getAllKeys().
      then((keys) => {
        allKeys = keys;
      }).
      then(() => _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"].clear()).
      then(() => {
        // Now that storage is cleared, the storage sync event can happen which is a more atomic action
        // for other browser tabs
        underscore__WEBPACK_IMPORTED_MODULE_0___default().each(allKeys, raiseStorageSyncEvent);
      });
    };

    // This listener will only be triggered by events coming from other tabs
    __webpack_require__.g.addEventListener('storage', (event) => {
      // Ignore events that don't originate from the SYNC_ONYX logic
      if (event.key !== SYNC_ONYX || !event.newValue) {
        return;
      }

      const onyxKey = event.newValue;
      _providers_IDBKeyVal__WEBPACK_IMPORTED_MODULE_1__["default"].getItem(onyxKey).then((value) => onStorageKeyChanged(onyxKey, value));
    });
  }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (webStorage);

/***/ }),

/***/ "./lib/storage/index.web.js":
/*!**********************************!*\
  !*** ./lib/storage/index.web.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _WebStorage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./WebStorage */ "./lib/storage/WebStorage.js");


/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_WebStorage__WEBPACK_IMPORTED_MODULE_0__["default"]);

/***/ }),

/***/ "./lib/storage/providers/IDBKeyVal.js":
/*!********************************************!*\
  !*** ./lib/storage/providers/IDBKeyVal.js ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var idb_keyval__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! idb-keyval */ "idb-keyval");
/* harmony import */ var idb_keyval__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(idb_keyval__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../utils */ "./lib/utils.js");




// We don't want to initialize the store while the JS bundle loads as idb-keyval will try to use global.indexedDB
// which might not be available in certain environments that load the bundle (e.g. electron main process).
let customStoreInstance;
const getCustomStore = () => {
  if (!customStoreInstance) {
    customStoreInstance = (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.createStore)('OnyxDB', 'keyvaluepairs');
  }
  return customStoreInstance;
};

const provider = {
  /**
   * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
   * @param {String} key
   * @param {*} value
   * @return {Promise<void>}
   */
  setItem: (key, value) => (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.set)(key, value, getCustomStore()),

  /**
   * Get multiple key-value pairs for the give array of keys in a batch.
   * This is optimized to use only one database transaction.
   * @param {String[]} keysParam
   * @return {Promise<Array<[key, value]>>}
   */
  multiGet: (keysParam) => (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.getMany)(keysParam, getCustomStore()).then((values) => underscore__WEBPACK_IMPORTED_MODULE_1___default().map(values, (value, index) => [keysParam[index], value])),

  /**
   * Multiple merging of existing and new values in a batch
   * @param {Array<[key, value]>} pairs
   * This function also removes all nested null values from an object.
   * @return {Promise<void>}
   */
  multiMerge: (pairs) =>
  getCustomStore()('readwrite', (store) => {
    // Note: we are using the manual store transaction here, to fit the read and update
    // of the items in one transaction to achieve best performance.

    const getValues = Promise.all(underscore__WEBPACK_IMPORTED_MODULE_1___default().map(pairs, (_ref) => {let [key] = _ref;return (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.promisifyRequest)(store.get(key));}));

    return getValues.then((values) => {
      const upsertMany = underscore__WEBPACK_IMPORTED_MODULE_1___default().map(pairs, (_ref2, index) => {let [key, value] = _ref2;
        const prev = values[index];
        const newValue = _utils__WEBPACK_IMPORTED_MODULE_2__["default"].fastMerge(prev, value);
        return (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.promisifyRequest)(store.put(newValue, key));
      });
      return Promise.all(upsertMany);
    });
  }),

  /**
   * Merging an existing value with a new one
   * @param {String} key
   * @param {any} _changes - not used, as we rely on the pre-merged data from the `modifiedData`
   * @param {any} modifiedData - the pre-merged data from `Onyx.applyMerge`
   * @return {Promise<void>}
   */
  mergeItem(key, _changes, modifiedData) {
    // Since Onyx also merged the existing value with the changes, we can just set the value directly
    return provider.setItem(key, modifiedData);
  },

  /**
   * Stores multiple key-value pairs in a batch
   * @param {Array<[key, value]>} pairs
   * @return {Promise<void>}
   */
  multiSet: (pairs) => (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.setMany)(pairs, getCustomStore()),

  /**
   * Clear everything from storage and also stops the SyncQueue from adding anything more to storage
   * @returns {Promise<void>}
   */
  clear: () => (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.clear)(getCustomStore()),

  // This is a noop for now in order to keep clients from crashing see https://github.com/Expensify/Expensify/issues/312438
  setMemoryOnlyKeys: () => {},

  /**
   * Returns all keys available in storage
   * @returns {Promise<String[]>}
   */
  getAllKeys: () => (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.keys)(getCustomStore()),

  /**
   * Get the value of a given key or return `null` if it's not available in storage
   * @param {String} key
   * @return {Promise<*>}
   */
  getItem: (key) =>
  (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.get)(key, getCustomStore())
  // idb-keyval returns undefined for missing items, but this needs to return null so that idb-keyval does the same thing as SQLiteStorage.
  .then((val) => val === undefined ? null : val),

  /**
   * Remove given key and it's value from storage
   * @param {String} key
   * @returns {Promise<void>}
   */
  removeItem: (key) => (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.del)(key, getCustomStore()),

  /**
   * Remove given keys and their values from storage
   *
   * @param {Array} keysParam
   * @returns {Promise}
   */
  removeItems: (keysParam) => (0,idb_keyval__WEBPACK_IMPORTED_MODULE_0__.delMany)(keysParam, getCustomStore()),

  /**
   * Gets the total bytes of the database file
   * @returns {Promise<number>}
   */
  getDatabaseSize() {
    if (!window.navigator || !window.navigator.storage) {
      throw new Error('StorageManager browser API unavailable');
    }

    return window.navigator.storage.
    estimate().
    then((value) => ({
      bytesUsed: value.usage,
      bytesRemaining: value.quota - value.usage
    })).
    catch((error) => {
      throw new Error(`Unable to estimate web storage quota. Original error: ${error}`);
    });
  }
};

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (provider);

/***/ }),

/***/ "./lib/utils.js":
/*!**********************!*\
  !*** ./lib/utils.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_0__);


function areObjectsEmpty(a, b) {
  return typeof a === 'object' && typeof b === 'object' && underscore__WEBPACK_IMPORTED_MODULE_0___default().isEmpty(a) && underscore__WEBPACK_IMPORTED_MODULE_0___default().isEmpty(b);
}

// Mostly copied from https://medium.com/@lubaka.a/how-to-remove-lodash-performance-improvement-b306669ad0e1

/**
 * @param {mixed} val
 * @returns {boolean}
 */
function isMergeableObject(val) {
  const nonNullObject = val != null ? typeof val === 'object' : false;
  return (
    nonNullObject &&
    Object.prototype.toString.call(val) !== '[object RegExp]' &&
    Object.prototype.toString.call(val) !== '[object Date]' &&
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    !Array.isArray(val));

}

/**
 * @param {Object} target
 * @param {Object} source
 * @param {Boolean} shouldRemoveNullObjectValues
 * @returns {Object}
 */
function mergeObject(target, source) {let shouldRemoveNullObjectValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  const destination = {};
  if (isMergeableObject(target)) {
    // lodash adds a small overhead so we don't use it here
    // eslint-disable-next-line rulesdir/prefer-underscore-method
    const targetKeys = Object.keys(target);
    for (let i = 0; i < targetKeys.length; ++i) {
      const key = targetKeys[i];

      // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
      const isSourceOrTargetNull = target[key] === null || source[key] === null;
      const shouldOmitSourceKey = shouldRemoveNullObjectValues && isSourceOrTargetNull;

      if (!shouldOmitSourceKey) {
        destination[key] = target[key];
      }
    }
  }

  // lodash adds a small overhead so we don't use it here
  // eslint-disable-next-line rulesdir/prefer-underscore-method
  const sourceKeys = Object.keys(source);
  for (let i = 0; i < sourceKeys.length; ++i) {
    const key = sourceKeys[i];

    // If shouldRemoveNullObjectValues is true, we want to remove null values from the merged object
    const shouldOmitSourceKey = shouldRemoveNullObjectValues && source[key] === null;

    // If we pass undefined as the updated value for a key, we want to generally ignore it
    const isSourceKeyUndefined = source[key] === undefined;

    if (!isSourceKeyUndefined && !shouldOmitSourceKey) {
      const isSourceKeyMergable = isMergeableObject(source[key]);

      if (isSourceKeyMergable && target[key]) {
        if (!shouldRemoveNullObjectValues || isSourceKeyMergable) {
          // eslint-disable-next-line no-use-before-define
          destination[key] = fastMerge(target[key], source[key], shouldRemoveNullObjectValues);
        }
      } else if (!shouldRemoveNullObjectValues || source[key] !== null) {
        destination[key] = source[key];
      }
    }
  }

  return destination;
}

/**
 * Merges two objects and removes null values if "shouldRemoveNullObjectValues" is set to true
 *
 * We generally want to remove null values from objects written to disk and cache, because it decreases the amount of data stored in memory and on disk.
 * On native, when merging an existing value with new changes, SQLite will use JSON_PATCH, which removes top-level nullish values.
 * To be consistent with the behaviour for merge, we'll also want to remove null values for "set" operations.
 *
 * @param {Object|Array} target
 * @param {Object|Array} source
 * @param {Boolean} shouldRemoveNullObjectValues
 * @returns {Object|Array}
 */
function fastMerge(target, source) {let shouldRemoveNullObjectValues = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
  // We have to ignore arrays and nullish values here,
  // otherwise "mergeObject" will throw an error,
  // because it expects an object as "source"
  if (underscore__WEBPACK_IMPORTED_MODULE_0___default().isArray(source) || source === null || source === undefined) {
    return source;
  }
  return mergeObject(target, source, shouldRemoveNullObjectValues);
}

function removeNestedNullValues(value) {
  if (typeof value === 'object' && !underscore__WEBPACK_IMPORTED_MODULE_0___default().isArray(value)) {
    return fastMerge(value, value);
  }

  return value;
}

/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({ areObjectsEmpty, fastMerge, removeNestedNullValues });

/***/ }),

/***/ "./lib/withOnyx.js":
/*!*************************!*\
  !*** ./lib/withOnyx.js ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* export default binding */ __WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! prop-types */ "./node_modules/prop-types/index.js");
/* harmony import */ var prop_types__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(prop_types__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! underscore */ "underscore");
/* harmony import */ var underscore__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(underscore__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _Onyx__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./Onyx */ "./lib/Onyx.js");
/* harmony import */ var _Str__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./Str */ "./lib/Str.js");
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./utils */ "./lib/utils.js");
function _extends() {_extends = Object.assign ? Object.assign.bind() : function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};return _extends.apply(this, arguments);}function _defineProperty(obj, key, value) {key = _toPropertyKey(key);if (key in obj) {Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true });} else {obj[key] = value;}return obj;}function _toPropertyKey(arg) {var key = _toPrimitive(arg, "string");return typeof key === "symbol" ? key : String(key);}function _toPrimitive(input, hint) {if (typeof input !== "object" || input === null) return input;var prim = input[Symbol.toPrimitive];if (prim !== undefined) {var res = prim.call(input, hint || "default");if (typeof res !== "object") return res;throw new TypeError("@@toPrimitive must return a primitive value.");}return (hint === "string" ? String : Number)(input);} /**
 * This is a higher order component that provides the ability to map a state property directly to
 * something in Onyx (a key/value store). That way, as soon as data in Onyx changes, the state will be set and the view
 * will automatically change to reflect the new data.
 */







// This is a list of keys that can exist on a `mapping`, but are not directly related to loading data from Onyx. When the keys of a mapping are looped over to check
// if a key has changed, it's a good idea to skip looking at these properties since they would have unexpected results.
const mappingPropertiesToIgnoreChangesTo = ['initialValue', 'allowStaleData'];

/**
 * Returns the display name of a component
 *
 * @param {object} component
 * @returns {string}
 */
function getDisplayName(component) {
  return component.displayName || component.name || 'Component';
}

/**
 * Removes all the keys from state that are unrelated to the onyx data being mapped to the component.
 *
 * @param {Object} state of the component
 * @param {Object} onyxToStateMapping the object holding all of the mapping configuration for the component
 * @returns {Object}
 */
const getOnyxDataFromState = (state, onyxToStateMapping) => underscore__WEBPACK_IMPORTED_MODULE_2___default().pick(state, underscore__WEBPACK_IMPORTED_MODULE_2___default().keys(onyxToStateMapping));

/* harmony default export */ function __WEBPACK_DEFAULT_EXPORT__(mapOnyxToState) {let shouldDelayUpdates = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  // A list of keys that must be present in tempState before we can render the WrappedComponent
  const requiredKeysForInit = underscore__WEBPACK_IMPORTED_MODULE_2___default().chain(mapOnyxToState).
  omit((config) => config.initWithStoredValues === false).
  keys().
  value();
  return (WrappedComponent) => {
    const displayName = getDisplayName(WrappedComponent);
    class withOnyx extends (react__WEBPACK_IMPORTED_MODULE_1___default().Component) {


      constructor(props) {
        super(props);_defineProperty(this, "pendingSetStates", []);
        this.shouldDelayUpdates = shouldDelayUpdates;
        this.setWithOnyxState = this.setWithOnyxState.bind(this);
        this.flushPendingSetStates = this.flushPendingSetStates.bind(this);

        // This stores all the Onyx connection IDs to be used when the component unmounts so everything can be
        // disconnected. It is a key value store with the format {[mapping.key]: connectionID}.
        this.activeConnectionIDs = {};

        const cachedState = underscore__WEBPACK_IMPORTED_MODULE_2___default().reduce(
        mapOnyxToState,
        (resultObj, mapping, propertyName) => {
          const key = _Str__WEBPACK_IMPORTED_MODULE_3__.result(mapping.key, props);
          let value = _Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].tryGetCachedValue(key, mapping);
          if (!value && mapping.initialValue) {
            value = mapping.initialValue;
          }

          /**
           * If we have a pending merge for a key it could mean that data is being set via Onyx.merge() and someone expects a component to have this data immediately.
           *
           * @example
           *
           * Onyx.merge('report_123', value);
           * Navigation.navigate(route); // Where "route" expects the "value" to be available immediately once rendered.
           *
           * In reality, Onyx.merge() will only update the subscriber after all merges have been batched and the previous value is retrieved via a get() (returns a promise).
           * So, we won't use the cache optimization here as it will lead us to arbitrarily defer various actions in the application code.
           */
          if (value !== undefined && !_Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].hasPendingMergeForKey(key) || mapping.allowStaleData) {
            // eslint-disable-next-line no-param-reassign
            resultObj[propertyName] = value;
          }

          return resultObj;
        },
        {});


        // If we have all the data we need, then we can render the component immediately
        cachedState.loading = underscore__WEBPACK_IMPORTED_MODULE_2___default().size(cachedState) < requiredKeysForInit.length;

        // Object holding the temporary initial state for the component while we load the various Onyx keys
        this.tempState = cachedState;

        this.state = cachedState;
      }

      componentDidMount() {
        const onyxDataFromState = getOnyxDataFromState(this.state, mapOnyxToState);

        // Subscribe each of the state properties to the proper Onyx key
        underscore__WEBPACK_IMPORTED_MODULE_2___default().each(mapOnyxToState, (mapping, propertyName) => {
          if (underscore__WEBPACK_IMPORTED_MODULE_2___default().includes(mappingPropertiesToIgnoreChangesTo, propertyName)) {
            return;
          }
          const key = _Str__WEBPACK_IMPORTED_MODULE_3__.result(mapping.key, { ...this.props, ...onyxDataFromState });
          this.connectMappingToOnyx(mapping, propertyName, key);
        });
        this.checkEvictableKeys();
      }

      componentDidUpdate(prevProps, prevState) {
        // The whole purpose of this method is to check to see if a key that is subscribed to Onyx has changed, and then Onyx needs to be disconnected from the old
        // key and connected to the new key.
        // For example, a key could change if KeyB depends on data loading from Onyx for KeyA.
        const isFirstTimeUpdatingAfterLoading = prevState.loading && !this.state.loading;
        const onyxDataFromState = getOnyxDataFromState(this.state, mapOnyxToState);
        const prevOnyxDataFromState = getOnyxDataFromState(prevState, mapOnyxToState);

        underscore__WEBPACK_IMPORTED_MODULE_2___default().each(mapOnyxToState, (mapping, propName) => {
          // Some properties can be ignored because they aren't related to onyx keys and they will never change
          if (underscore__WEBPACK_IMPORTED_MODULE_2___default().includes(mappingPropertiesToIgnoreChangesTo, propName)) {
            return;
          }

          // The previous key comes from either:
          // 1) The initial key that was connected to (ie. set from `componentDidMount()`)
          // 2) The updated props which caused `componentDidUpdate()` to run
          // The first case cannot be used all the time because of race conditions where `componentDidUpdate()` can be triggered before connectingMappingToOnyx() is done
          // (eg. if a user switches chats really quickly). In this case, it's much more stable to always look at the changes to prevProp and prevState to derive the key.
          // The second case cannot be used all the time because the onyx data doesn't change the first time that `componentDidUpdate()` runs after loading. In this case,
          // the `mapping.previousKey` must be used for the comparison or else this logic never detects that onyx data could have changed during the loading process.
          const previousKey = isFirstTimeUpdatingAfterLoading ? mapping.previousKey : _Str__WEBPACK_IMPORTED_MODULE_3__.result(mapping.key, { ...prevProps, ...prevOnyxDataFromState });
          const newKey = _Str__WEBPACK_IMPORTED_MODULE_3__.result(mapping.key, { ...this.props, ...onyxDataFromState });
          if (previousKey !== newKey) {
            _Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].disconnect(this.activeConnectionIDs[previousKey], previousKey);
            delete this.activeConnectionIDs[previousKey];
            this.connectMappingToOnyx(mapping, propName, newKey);
          }
        });
        this.checkEvictableKeys();
      }

      componentWillUnmount() {
        // Disconnect everything from Onyx
        underscore__WEBPACK_IMPORTED_MODULE_2___default().each(mapOnyxToState, (mapping) => {
          const key = _Str__WEBPACK_IMPORTED_MODULE_3__.result(mapping.key, { ...this.props, ...getOnyxDataFromState(this.state, mapOnyxToState) });
          _Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].disconnect(this.activeConnectionIDs[key], key);
        });
      }

      setStateProxy(modifier) {
        if (this.shouldDelayUpdates) {
          this.pendingSetStates.push(modifier);
        } else {
          this.setState(modifier);
        }
      }

      /**
       * This method is used by the internal raw Onyx `sendDataToConnection`, it is designed to prevent unnecessary renders while a component
       * still in a "loading" (read "mounting") state. The temporary initial state is saved to the HOC instance and setState()
       * only called once all the necessary data has been collected.
       *
       * There is however the possibility the component could have been updated by a call to setState()
       * before the data was "initially" collected. A race condition.
       * For example some update happened on some key, while onyx was still gathering the initial hydration data.
       * This update is disptached directly to setStateProxy and therefore the component has the most up-to-date data
       *
       * This is a design flaw in Onyx itself as dispatching updates before initial hydration is not a correct event flow.
       * We however need to workaround this issue in the HOC. The addition of initialValue makes things even more complex,
       * since you cannot be really sure if the component has been updated before or after the initial hydration. Therefore if
       * initialValue is there, we just check if the update is different than that and then try to handle it as best as we can.
       *
       * @param {String} statePropertyName
       * @param {*} val
       */
      setWithOnyxState(statePropertyName, val) {
        const prevValue = this.state[statePropertyName];

        // If the component is not loading (read "mounting"), then we can just update the state
        // There is a small race condition.
        // When calling setWithOnyxState we delete the tempState object that is used to hold temporary state updates while the HOC is gathering data.
        // However the loading flag is only set on the setState callback down below. setState however is an async operation that is also batched,
        // therefore there is a small window of time where the loading flag is not false but the tempState is already gone
        // (while the update is queued and waiting to be applied).
        // This simply bypasses the loading check if the tempState is gone and the update can be safely queued with a normal setStateProxy.
        if (!this.state.loading || !this.tempState) {
          // Performance optimization, do not trigger update with same values
          if (prevValue === val || _utils__WEBPACK_IMPORTED_MODULE_5__["default"].areObjectsEmpty(prevValue, val)) {
            return;
          }

          this.setStateProxy({ [statePropertyName]: val });
          return;
        }

        this.tempState[statePropertyName] = val;

        // If some key does not have a value yet, do not update the state yet
        const tempStateIsMissingKey = underscore__WEBPACK_IMPORTED_MODULE_2___default().some(requiredKeysForInit, (key) => underscore__WEBPACK_IMPORTED_MODULE_2___default().isUndefined(this.tempState[key]));
        if (tempStateIsMissingKey) {
          return;
        }

        const stateUpdate = { ...this.tempState };
        delete this.tempState;

        // Full of hacky workarounds to prevent the race condition described above.
        this.setState((prevState) => {
          const finalState = underscore__WEBPACK_IMPORTED_MODULE_2___default().reduce(
          stateUpdate,
          (result, value, key) => {
            if (key === 'loading') {
              return result;
            }

            const initialValue = mapOnyxToState[key].initialValue;

            // If initialValue is there and the state contains something different it means
            // an update has already been received and we can discard the value we are trying to hydrate
            if (!underscore__WEBPACK_IMPORTED_MODULE_2___default().isUndefined(initialValue) && !underscore__WEBPACK_IMPORTED_MODULE_2___default().isUndefined(prevState[key]) && prevState[key] !== initialValue) {
              // eslint-disable-next-line no-param-reassign
              result[key] = prevState[key];

              // if value is already there (without initial value) then we can discard the value we are trying to hydrate
            } else if (!underscore__WEBPACK_IMPORTED_MODULE_2___default().isUndefined(prevState[key])) {
              // eslint-disable-next-line no-param-reassign
              result[key] = prevState[key];
            } else {
              // eslint-disable-next-line no-param-reassign
              result[key] = value;
            }
            return result;
          },
          {});


          finalState.loading = false;
          return finalState;
        });
      }

      /**
       * Makes sure each Onyx key we requested has been set to state with a value of some kind.
       * We are doing this so that the wrapped component will only render when all the data
       * it needs is available to it.
       */
      checkEvictableKeys() {
        // We will add this key to our list of recently accessed keys
        // if the canEvict function returns true. This is necessary criteria
        // we MUST use to specify if a key can be removed or not.
        underscore__WEBPACK_IMPORTED_MODULE_2___default().each(mapOnyxToState, (mapping) => {
          if (underscore__WEBPACK_IMPORTED_MODULE_2___default().isUndefined(mapping.canEvict)) {
            return;
          }

          const canEvict = _Str__WEBPACK_IMPORTED_MODULE_3__.result(mapping.canEvict, this.props);
          const key = _Str__WEBPACK_IMPORTED_MODULE_3__.result(mapping.key, this.props);

          if (!_Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].isSafeEvictionKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
          }

          if (canEvict) {
            _Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].removeFromEvictionBlockList(key, mapping.connectionID);
          } else {
            _Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].addToEvictionBlockList(key, mapping.connectionID);
          }
        });
      }

      /**
       * Takes a single mapping and binds the state of the component to the store
       *
       * @param {object} mapping
       * @param {string|function} mapping.key key to connect to. can be a string or a
       * function that takes this.props as an argument and returns a string
       * @param {string} statePropertyName the name of the state property that Onyx will add the data to
       * @param {boolean} [mapping.initWithStoredValues] If set to false, then no data will be prefilled into the
       *  component
       * @param {string} key to connect to Onyx with
       */
      connectMappingToOnyx(mapping, statePropertyName, key) {
        // Remember what the previous key was so that key changes can be detected when data is being loaded from Onyx. This will allow
        // dependent keys to finish loading their data.
        // eslint-disable-next-line no-param-reassign
        mapOnyxToState[statePropertyName].previousKey = key;

        // eslint-disable-next-line rulesdir/prefer-onyx-connect-in-libs
        this.activeConnectionIDs[key] = _Onyx__WEBPACK_IMPORTED_MODULE_4__["default"].connect({
          ...mapping,
          key,
          statePropertyName,
          withOnyxInstance: this,
          displayName
        });
      }

      flushPendingSetStates() {
        if (!this.shouldDelayUpdates) {
          return;
        }

        this.shouldDelayUpdates = false;

        this.pendingSetStates.forEach((modifier) => {
          this.setState(modifier);
        });
        this.pendingSetStates = [];
      }

      render() {
        // Remove any null values so that React replaces them with default props
        const propsToPass = underscore__WEBPACK_IMPORTED_MODULE_2___default().omit(this.props, (underscore__WEBPACK_IMPORTED_MODULE_2___default().isNull));

        if (this.state.loading) {
          return null;
        }

        // Remove any internal state properties used by withOnyx
        // that should not be passed to a wrapped component
        let stateToPass = underscore__WEBPACK_IMPORTED_MODULE_2___default().omit(this.state, 'loading');
        stateToPass = underscore__WEBPACK_IMPORTED_MODULE_2___default().omit(stateToPass, (underscore__WEBPACK_IMPORTED_MODULE_2___default().isNull));

        // Spreading props and state is necessary in an HOC where the data cannot be predicted
        return /*#__PURE__*/(
          react__WEBPACK_IMPORTED_MODULE_1___default().createElement(WrappedComponent, _extends({
            markReadyForHydration: this.flushPendingSetStates
            // eslint-disable-next-line react/jsx-props-no-spreading
          }, propsToPass,

          stateToPass, {
            ref: this.props.forwardedRef })));


      }
    }

    withOnyx.propTypes = {
      forwardedRef: prop_types__WEBPACK_IMPORTED_MODULE_0___default().oneOfType([
      (prop_types__WEBPACK_IMPORTED_MODULE_0___default().func),
      // eslint-disable-next-line react/forbid-prop-types
      prop_types__WEBPACK_IMPORTED_MODULE_0___default().shape({ current: (prop_types__WEBPACK_IMPORTED_MODULE_0___default().object) })])

    };
    withOnyx.defaultProps = {
      forwardedRef: undefined
    };
    withOnyx.displayName = `withOnyx(${displayName})`;
    return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_1___default().forwardRef((props, ref) => {
      const Component = withOnyx;
      return /*#__PURE__*/(
        react__WEBPACK_IMPORTED_MODULE_1___default().createElement(Component
        // eslint-disable-next-line react/jsx-props-no-spreading
        , _extends({}, props, {
          forwardedRef: ref })));


    });
  };
}

/***/ }),

/***/ "./node_modules/object-assign/index.js":
/*!*********************************************!*\
  !*** ./node_modules/object-assign/index.js ***!
  \*********************************************/
/***/ ((module) => {

"use strict";
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/


/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};


/***/ }),

/***/ "./node_modules/prop-types/checkPropTypes.js":
/*!***************************************************!*\
  !*** ./node_modules/prop-types/checkPropTypes.js ***!
  \***************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



var printWarning = function() {};

if (true) {
  var ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "./node_modules/prop-types/lib/ReactPropTypesSecret.js");
  var loggedTypeFailures = {};
  var has = Function.call.bind(Object.prototype.hasOwnProperty);

  printWarning = function(text) {
    var message = 'Warning: ' + text;
    if (typeof console !== 'undefined') {
      console.error(message);
    }
    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch (x) {}
  };
}

/**
 * Assert that the values match with the type specs.
 * Error messages are memorized and will only be shown once.
 *
 * @param {object} typeSpecs Map of name to a ReactPropType
 * @param {object} values Runtime values that need to be type-checked
 * @param {string} location e.g. "prop", "context", "child context"
 * @param {string} componentName Name of the component for error messages.
 * @param {?Function} getStack Returns the component stack.
 * @private
 */
function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
  if (true) {
    for (var typeSpecName in typeSpecs) {
      if (has(typeSpecs, typeSpecName)) {
        var error;
        // Prop type validation may throw. In case they do, we don't want to
        // fail the render phase where it didn't fail before. So we log it.
        // After these have been cleaned up, we'll let them throw.
        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          if (typeof typeSpecs[typeSpecName] !== 'function') {
            var err = Error(
              (componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' +
              'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.'
            );
            err.name = 'Invariant Violation';
            throw err;
          }
          error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
        } catch (ex) {
          error = ex;
        }
        if (error && !(error instanceof Error)) {
          printWarning(
            (componentName || 'React class') + ': type specification of ' +
            location + ' `' + typeSpecName + '` is invalid; the type checker ' +
            'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +
            'You may have forgotten to pass an argument to the type checker ' +
            'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +
            'shape all require an argument).'
          );
        }
        if (error instanceof Error && !(error.message in loggedTypeFailures)) {
          // Only monitor this failure once because there tends to be a lot of the
          // same error.
          loggedTypeFailures[error.message] = true;

          var stack = getStack ? getStack() : '';

          printWarning(
            'Failed ' + location + ' type: ' + error.message + (stack != null ? stack : '')
          );
        }
      }
    }
  }
}

/**
 * Resets warning cache when testing.
 *
 * @private
 */
checkPropTypes.resetWarningCache = function() {
  if (true) {
    loggedTypeFailures = {};
  }
}

module.exports = checkPropTypes;


/***/ }),

/***/ "./node_modules/prop-types/factoryWithTypeCheckers.js":
/*!************************************************************!*\
  !*** ./node_modules/prop-types/factoryWithTypeCheckers.js ***!
  \************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



var ReactIs = __webpack_require__(/*! react-is */ "./node_modules/react-is/index.js");
var assign = __webpack_require__(/*! object-assign */ "./node_modules/object-assign/index.js");

var ReactPropTypesSecret = __webpack_require__(/*! ./lib/ReactPropTypesSecret */ "./node_modules/prop-types/lib/ReactPropTypesSecret.js");
var checkPropTypes = __webpack_require__(/*! ./checkPropTypes */ "./node_modules/prop-types/checkPropTypes.js");

var has = Function.call.bind(Object.prototype.hasOwnProperty);
var printWarning = function() {};

if (true) {
  printWarning = function(text) {
    var message = 'Warning: ' + text;
    if (typeof console !== 'undefined') {
      console.error(message);
    }
    try {
      // --- Welcome to debugging React ---
      // This error was thrown as a convenience so that you can use this stack
      // to find the callsite that caused this warning to fire.
      throw new Error(message);
    } catch (x) {}
  };
}

function emptyFunctionThatReturnsNull() {
  return null;
}

module.exports = function(isValidElement, throwOnDirectAccess) {
  /* global Symbol */
  var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
  var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

  /**
   * Returns the iterator method function contained on the iterable object.
   *
   * Be sure to invoke the function with the iterable as context:
   *
   *     var iteratorFn = getIteratorFn(myIterable);
   *     if (iteratorFn) {
   *       var iterator = iteratorFn.call(myIterable);
   *       ...
   *     }
   *
   * @param {?object} maybeIterable
   * @return {?function}
   */
  function getIteratorFn(maybeIterable) {
    var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
    if (typeof iteratorFn === 'function') {
      return iteratorFn;
    }
  }

  /**
   * Collection of methods that allow declaration and validation of props that are
   * supplied to React components. Example usage:
   *
   *   var Props = require('ReactPropTypes');
   *   var MyArticle = React.createClass({
   *     propTypes: {
   *       // An optional string prop named "description".
   *       description: Props.string,
   *
   *       // A required enum prop named "category".
   *       category: Props.oneOf(['News','Photos']).isRequired,
   *
   *       // A prop named "dialog" that requires an instance of Dialog.
   *       dialog: Props.instanceOf(Dialog).isRequired
   *     },
   *     render: function() { ... }
   *   });
   *
   * A more formal specification of how these methods are used:
   *
   *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
   *   decl := ReactPropTypes.{type}(.isRequired)?
   *
   * Each and every declaration produces a function with the same signature. This
   * allows the creation of custom validation functions. For example:
   *
   *  var MyLink = React.createClass({
   *    propTypes: {
   *      // An optional string or URI prop named "href".
   *      href: function(props, propName, componentName) {
   *        var propValue = props[propName];
   *        if (propValue != null && typeof propValue !== 'string' &&
   *            !(propValue instanceof URI)) {
   *          return new Error(
   *            'Expected a string or an URI for ' + propName + ' in ' +
   *            componentName
   *          );
   *        }
   *      }
   *    },
   *    render: function() {...}
   *  });
   *
   * @internal
   */

  var ANONYMOUS = '<<anonymous>>';

  // Important!
  // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.
  var ReactPropTypes = {
    array: createPrimitiveTypeChecker('array'),
    bool: createPrimitiveTypeChecker('boolean'),
    func: createPrimitiveTypeChecker('function'),
    number: createPrimitiveTypeChecker('number'),
    object: createPrimitiveTypeChecker('object'),
    string: createPrimitiveTypeChecker('string'),
    symbol: createPrimitiveTypeChecker('symbol'),

    any: createAnyTypeChecker(),
    arrayOf: createArrayOfTypeChecker,
    element: createElementTypeChecker(),
    elementType: createElementTypeTypeChecker(),
    instanceOf: createInstanceTypeChecker,
    node: createNodeChecker(),
    objectOf: createObjectOfTypeChecker,
    oneOf: createEnumTypeChecker,
    oneOfType: createUnionTypeChecker,
    shape: createShapeTypeChecker,
    exact: createStrictShapeTypeChecker,
  };

  /**
   * inlined Object.is polyfill to avoid requiring consumers ship their own
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
   */
  /*eslint-disable no-self-compare*/
  function is(x, y) {
    // SameValue algorithm
    if (x === y) {
      // Steps 1-5, 7-10
      // Steps 6.b-6.e: +0 != -0
      return x !== 0 || 1 / x === 1 / y;
    } else {
      // Step 6.a: NaN == NaN
      return x !== x && y !== y;
    }
  }
  /*eslint-enable no-self-compare*/

  /**
   * We use an Error-like object for backward compatibility as people may call
   * PropTypes directly and inspect their output. However, we don't use real
   * Errors anymore. We don't inspect their stack anyway, and creating them
   * is prohibitively expensive if they are created too often, such as what
   * happens in oneOfType() for any type before the one that matched.
   */
  function PropTypeError(message) {
    this.message = message;
    this.stack = '';
  }
  // Make `instanceof Error` still work for returned errors.
  PropTypeError.prototype = Error.prototype;

  function createChainableTypeChecker(validate) {
    if (true) {
      var manualPropTypeCallCache = {};
      var manualPropTypeWarningCount = 0;
    }
    function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
      componentName = componentName || ANONYMOUS;
      propFullName = propFullName || propName;

      if (secret !== ReactPropTypesSecret) {
        if (throwOnDirectAccess) {
          // New behavior only for users of `prop-types` package
          var err = new Error(
            'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
            'Use `PropTypes.checkPropTypes()` to call them. ' +
            'Read more at http://fb.me/use-check-prop-types'
          );
          err.name = 'Invariant Violation';
          throw err;
        } else if ( true && typeof console !== 'undefined') {
          // Old behavior for people using React.PropTypes
          var cacheKey = componentName + ':' + propName;
          if (
            !manualPropTypeCallCache[cacheKey] &&
            // Avoid spamming the console because they are often not actionable except for lib authors
            manualPropTypeWarningCount < 3
          ) {
            printWarning(
              'You are manually calling a React.PropTypes validation ' +
              'function for the `' + propFullName + '` prop on `' + componentName  + '`. This is deprecated ' +
              'and will throw in the standalone `prop-types` package. ' +
              'You may be seeing this warning due to a third-party PropTypes ' +
              'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.'
            );
            manualPropTypeCallCache[cacheKey] = true;
            manualPropTypeWarningCount++;
          }
        }
      }
      if (props[propName] == null) {
        if (isRequired) {
          if (props[propName] === null) {
            return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
          }
          return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
        }
        return null;
      } else {
        return validate(props, propName, componentName, location, propFullName);
      }
    }

    var chainedCheckType = checkType.bind(null, false);
    chainedCheckType.isRequired = checkType.bind(null, true);

    return chainedCheckType;
  }

  function createPrimitiveTypeChecker(expectedType) {
    function validate(props, propName, componentName, location, propFullName, secret) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== expectedType) {
        // `propValue` being instance of, say, date/regexp, pass the 'object'
        // check, but we can offer a more precise error message here rather than
        // 'of type `object`'.
        var preciseType = getPreciseType(propValue);

        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createAnyTypeChecker() {
    return createChainableTypeChecker(emptyFunctionThatReturnsNull);
  }

  function createArrayOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      if (typeof typeChecker !== 'function') {
        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
      }
      var propValue = props[propName];
      if (!Array.isArray(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
      }
      for (var i = 0; i < propValue.length; i++) {
        var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);
        if (error instanceof Error) {
          return error;
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createElementTypeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      if (!isValidElement(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createElementTypeTypeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      if (!ReactIs.isValidElementType(propValue)) {
        var propType = getPropType(propValue);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement type.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createInstanceTypeChecker(expectedClass) {
    function validate(props, propName, componentName, location, propFullName) {
      if (!(props[propName] instanceof expectedClass)) {
        var expectedClassName = expectedClass.name || ANONYMOUS;
        var actualClassName = getClassName(props[propName]);
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createEnumTypeChecker(expectedValues) {
    if (!Array.isArray(expectedValues)) {
      if (true) {
        if (arguments.length > 1) {
          printWarning(
            'Invalid arguments supplied to oneOf, expected an array, got ' + arguments.length + ' arguments. ' +
            'A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).'
          );
        } else {
          printWarning('Invalid argument supplied to oneOf, expected an array.');
        }
      }
      return emptyFunctionThatReturnsNull;
    }

    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      for (var i = 0; i < expectedValues.length; i++) {
        if (is(propValue, expectedValues[i])) {
          return null;
        }
      }

      var valuesString = JSON.stringify(expectedValues, function replacer(key, value) {
        var type = getPreciseType(value);
        if (type === 'symbol') {
          return String(value);
        }
        return value;
      });
      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + String(propValue) + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
    }
    return createChainableTypeChecker(validate);
  }

  function createObjectOfTypeChecker(typeChecker) {
    function validate(props, propName, componentName, location, propFullName) {
      if (typeof typeChecker !== 'function') {
        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
      }
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
      }
      for (var key in propValue) {
        if (has(propValue, key)) {
          var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
          if (error instanceof Error) {
            return error;
          }
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createUnionTypeChecker(arrayOfTypeCheckers) {
    if (!Array.isArray(arrayOfTypeCheckers)) {
       true ? printWarning('Invalid argument supplied to oneOfType, expected an instance of array.') : 0;
      return emptyFunctionThatReturnsNull;
    }

    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
      var checker = arrayOfTypeCheckers[i];
      if (typeof checker !== 'function') {
        printWarning(
          'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +
          'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.'
        );
        return emptyFunctionThatReturnsNull;
      }
    }

    function validate(props, propName, componentName, location, propFullName) {
      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
        var checker = arrayOfTypeCheckers[i];
        if (checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret) == null) {
          return null;
        }
      }

      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
    }
    return createChainableTypeChecker(validate);
  }

  function createNodeChecker() {
    function validate(props, propName, componentName, location, propFullName) {
      if (!isNode(props[propName])) {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createShapeTypeChecker(shapeTypes) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
      }
      for (var key in shapeTypes) {
        var checker = shapeTypes[key];
        if (!checker) {
          continue;
        }
        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
        if (error) {
          return error;
        }
      }
      return null;
    }
    return createChainableTypeChecker(validate);
  }

  function createStrictShapeTypeChecker(shapeTypes) {
    function validate(props, propName, componentName, location, propFullName) {
      var propValue = props[propName];
      var propType = getPropType(propValue);
      if (propType !== 'object') {
        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
      }
      // We need to check all keys in case some are required but missing from
      // props.
      var allKeys = assign({}, props[propName], shapeTypes);
      for (var key in allKeys) {
        var checker = shapeTypes[key];
        if (!checker) {
          return new PropTypeError(
            'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +
            '\nBad object: ' + JSON.stringify(props[propName], null, '  ') +
            '\nValid keys: ' +  JSON.stringify(Object.keys(shapeTypes), null, '  ')
          );
        }
        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
        if (error) {
          return error;
        }
      }
      return null;
    }

    return createChainableTypeChecker(validate);
  }

  function isNode(propValue) {
    switch (typeof propValue) {
      case 'number':
      case 'string':
      case 'undefined':
        return true;
      case 'boolean':
        return !propValue;
      case 'object':
        if (Array.isArray(propValue)) {
          return propValue.every(isNode);
        }
        if (propValue === null || isValidElement(propValue)) {
          return true;
        }

        var iteratorFn = getIteratorFn(propValue);
        if (iteratorFn) {
          var iterator = iteratorFn.call(propValue);
          var step;
          if (iteratorFn !== propValue.entries) {
            while (!(step = iterator.next()).done) {
              if (!isNode(step.value)) {
                return false;
              }
            }
          } else {
            // Iterator will provide entry [k,v] tuples rather than values.
            while (!(step = iterator.next()).done) {
              var entry = step.value;
              if (entry) {
                if (!isNode(entry[1])) {
                  return false;
                }
              }
            }
          }
        } else {
          return false;
        }

        return true;
      default:
        return false;
    }
  }

  function isSymbol(propType, propValue) {
    // Native Symbol.
    if (propType === 'symbol') {
      return true;
    }

    // falsy value can't be a Symbol
    if (!propValue) {
      return false;
    }

    // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
    if (propValue['@@toStringTag'] === 'Symbol') {
      return true;
    }

    // Fallback for non-spec compliant Symbols which are polyfilled.
    if (typeof Symbol === 'function' && propValue instanceof Symbol) {
      return true;
    }

    return false;
  }

  // Equivalent of `typeof` but with special handling for array and regexp.
  function getPropType(propValue) {
    var propType = typeof propValue;
    if (Array.isArray(propValue)) {
      return 'array';
    }
    if (propValue instanceof RegExp) {
      // Old webkits (at least until Android 4.0) return 'function' rather than
      // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
      // passes PropTypes.object.
      return 'object';
    }
    if (isSymbol(propType, propValue)) {
      return 'symbol';
    }
    return propType;
  }

  // This handles more types than `getPropType`. Only used for error messages.
  // See `createPrimitiveTypeChecker`.
  function getPreciseType(propValue) {
    if (typeof propValue === 'undefined' || propValue === null) {
      return '' + propValue;
    }
    var propType = getPropType(propValue);
    if (propType === 'object') {
      if (propValue instanceof Date) {
        return 'date';
      } else if (propValue instanceof RegExp) {
        return 'regexp';
      }
    }
    return propType;
  }

  // Returns a string that is postfixed to a warning about an invalid type.
  // For example, "undefined" or "of type array"
  function getPostfixForTypeWarning(value) {
    var type = getPreciseType(value);
    switch (type) {
      case 'array':
      case 'object':
        return 'an ' + type;
      case 'boolean':
      case 'date':
      case 'regexp':
        return 'a ' + type;
      default:
        return type;
    }
  }

  // Returns class name of the object, if any.
  function getClassName(propValue) {
    if (!propValue.constructor || !propValue.constructor.name) {
      return ANONYMOUS;
    }
    return propValue.constructor.name;
  }

  ReactPropTypes.checkPropTypes = checkPropTypes;
  ReactPropTypes.resetWarningCache = checkPropTypes.resetWarningCache;
  ReactPropTypes.PropTypes = ReactPropTypes;

  return ReactPropTypes;
};


/***/ }),

/***/ "./node_modules/prop-types/index.js":
/*!******************************************!*\
  !*** ./node_modules/prop-types/index.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

if (true) {
  var ReactIs = __webpack_require__(/*! react-is */ "./node_modules/react-is/index.js");

  // By explicitly using `prop-types` you are opting into new development behavior.
  // http://fb.me/prop-types-in-prod
  var throwOnDirectAccess = true;
  module.exports = __webpack_require__(/*! ./factoryWithTypeCheckers */ "./node_modules/prop-types/factoryWithTypeCheckers.js")(ReactIs.isElement, throwOnDirectAccess);
} else {}


/***/ }),

/***/ "./node_modules/prop-types/lib/ReactPropTypesSecret.js":
/*!*************************************************************!*\
  !*** ./node_modules/prop-types/lib/ReactPropTypesSecret.js ***!
  \*************************************************************/
/***/ ((module) => {

"use strict";
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */



var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

module.exports = ReactPropTypesSecret;


/***/ }),

/***/ "./node_modules/react-is/cjs/react-is.development.js":
/*!***********************************************************!*\
  !*** ./node_modules/react-is/cjs/react-is.development.js ***!
  \***********************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";
/** @license React v16.13.1
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */





if (true) {
  (function() {
'use strict';

// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
// nor polyfill, then a plain number is used for performance.
var hasSymbol = typeof Symbol === 'function' && Symbol.for;
var REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for('react.element') : 0xeac7;
var REACT_PORTAL_TYPE = hasSymbol ? Symbol.for('react.portal') : 0xeaca;
var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for('react.fragment') : 0xeacb;
var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for('react.strict_mode') : 0xeacc;
var REACT_PROFILER_TYPE = hasSymbol ? Symbol.for('react.profiler') : 0xead2;
var REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for('react.provider') : 0xeacd;
var REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for('react.context') : 0xeace; // TODO: We don't use AsyncMode or ConcurrentMode anymore. They were temporary
// (unstable) APIs that have been removed. Can we remove the symbols?

var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for('react.async_mode') : 0xeacf;
var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for('react.concurrent_mode') : 0xeacf;
var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;
var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for('react.suspense') : 0xead1;
var REACT_SUSPENSE_LIST_TYPE = hasSymbol ? Symbol.for('react.suspense_list') : 0xead8;
var REACT_MEMO_TYPE = hasSymbol ? Symbol.for('react.memo') : 0xead3;
var REACT_LAZY_TYPE = hasSymbol ? Symbol.for('react.lazy') : 0xead4;
var REACT_BLOCK_TYPE = hasSymbol ? Symbol.for('react.block') : 0xead9;
var REACT_FUNDAMENTAL_TYPE = hasSymbol ? Symbol.for('react.fundamental') : 0xead5;
var REACT_RESPONDER_TYPE = hasSymbol ? Symbol.for('react.responder') : 0xead6;
var REACT_SCOPE_TYPE = hasSymbol ? Symbol.for('react.scope') : 0xead7;

function isValidElementType(type) {
  return typeof type === 'string' || typeof type === 'function' || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
  type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || typeof type === 'object' && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_FUNDAMENTAL_TYPE || type.$$typeof === REACT_RESPONDER_TYPE || type.$$typeof === REACT_SCOPE_TYPE || type.$$typeof === REACT_BLOCK_TYPE);
}

function typeOf(object) {
  if (typeof object === 'object' && object !== null) {
    var $$typeof = object.$$typeof;

    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
        var type = object.type;

        switch (type) {
          case REACT_ASYNC_MODE_TYPE:
          case REACT_CONCURRENT_MODE_TYPE:
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
          case REACT_SUSPENSE_TYPE:
            return type;

          default:
            var $$typeofType = type && type.$$typeof;

            switch ($$typeofType) {
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_LAZY_TYPE:
              case REACT_MEMO_TYPE:
              case REACT_PROVIDER_TYPE:
                return $$typeofType;

              default:
                return $$typeof;
            }

        }

      case REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }

  return undefined;
} // AsyncMode is deprecated along with isAsyncMode

var AsyncMode = REACT_ASYNC_MODE_TYPE;
var ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
var ContextConsumer = REACT_CONTEXT_TYPE;
var ContextProvider = REACT_PROVIDER_TYPE;
var Element = REACT_ELEMENT_TYPE;
var ForwardRef = REACT_FORWARD_REF_TYPE;
var Fragment = REACT_FRAGMENT_TYPE;
var Lazy = REACT_LAZY_TYPE;
var Memo = REACT_MEMO_TYPE;
var Portal = REACT_PORTAL_TYPE;
var Profiler = REACT_PROFILER_TYPE;
var StrictMode = REACT_STRICT_MODE_TYPE;
var Suspense = REACT_SUSPENSE_TYPE;
var hasWarnedAboutDeprecatedIsAsyncMode = false; // AsyncMode should be deprecated

function isAsyncMode(object) {
  {
    if (!hasWarnedAboutDeprecatedIsAsyncMode) {
      hasWarnedAboutDeprecatedIsAsyncMode = true; // Using console['warn'] to evade Babel and ESLint

      console['warn']('The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactIs.isConcurrentMode() instead. It has the exact same API.');
    }
  }

  return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;
}
function isConcurrentMode(object) {
  return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;
}
function isContextConsumer(object) {
  return typeOf(object) === REACT_CONTEXT_TYPE;
}
function isContextProvider(object) {
  return typeOf(object) === REACT_PROVIDER_TYPE;
}
function isElement(object) {
  return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
}
function isForwardRef(object) {
  return typeOf(object) === REACT_FORWARD_REF_TYPE;
}
function isFragment(object) {
  return typeOf(object) === REACT_FRAGMENT_TYPE;
}
function isLazy(object) {
  return typeOf(object) === REACT_LAZY_TYPE;
}
function isMemo(object) {
  return typeOf(object) === REACT_MEMO_TYPE;
}
function isPortal(object) {
  return typeOf(object) === REACT_PORTAL_TYPE;
}
function isProfiler(object) {
  return typeOf(object) === REACT_PROFILER_TYPE;
}
function isStrictMode(object) {
  return typeOf(object) === REACT_STRICT_MODE_TYPE;
}
function isSuspense(object) {
  return typeOf(object) === REACT_SUSPENSE_TYPE;
}

exports.AsyncMode = AsyncMode;
exports.ConcurrentMode = ConcurrentMode;
exports.ContextConsumer = ContextConsumer;
exports.ContextProvider = ContextProvider;
exports.Element = Element;
exports.ForwardRef = ForwardRef;
exports.Fragment = Fragment;
exports.Lazy = Lazy;
exports.Memo = Memo;
exports.Portal = Portal;
exports.Profiler = Profiler;
exports.StrictMode = StrictMode;
exports.Suspense = Suspense;
exports.isAsyncMode = isAsyncMode;
exports.isConcurrentMode = isConcurrentMode;
exports.isContextConsumer = isContextConsumer;
exports.isContextProvider = isContextProvider;
exports.isElement = isElement;
exports.isForwardRef = isForwardRef;
exports.isFragment = isFragment;
exports.isLazy = isLazy;
exports.isMemo = isMemo;
exports.isPortal = isPortal;
exports.isProfiler = isProfiler;
exports.isStrictMode = isStrictMode;
exports.isSuspense = isSuspense;
exports.isValidElementType = isValidElementType;
exports.typeOf = typeOf;
  })();
}


/***/ }),

/***/ "./node_modules/react-is/index.js":
/*!****************************************!*\
  !*** ./node_modules/react-is/index.js ***!
  \****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


if (false) {} else {
  module.exports = __webpack_require__(/*! ./cjs/react-is.development.js */ "./node_modules/react-is/cjs/react-is.development.js");
}


/***/ }),

/***/ "fast-equals":
/*!******************************!*\
  !*** external "fast-equals" ***!
  \******************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_fast_equals__;

/***/ }),

/***/ "idb-keyval":
/*!*****************************!*\
  !*** external "idb-keyval" ***!
  \*****************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_idb_keyval__;

/***/ }),

/***/ "lodash/transform":
/*!***********************************!*\
  !*** external "lodash/transform" ***!
  \***********************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_lodash_transform__;

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_react__;

/***/ }),

/***/ "react-dom":
/*!****************************!*\
  !*** external "react-dom" ***!
  \****************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_react_dom__;

/***/ }),

/***/ "underscore":
/*!*****************************!*\
  !*** external "underscore" ***!
  \*****************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_underscore__;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__),
/* harmony export */   "withOnyx": () => (/* reexport safe */ _withOnyx__WEBPACK_IMPORTED_MODULE_1__["default"])
/* harmony export */ });
/* harmony import */ var _Onyx__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./Onyx */ "./lib/Onyx.js");
/* harmony import */ var _withOnyx__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./withOnyx */ "./lib/withOnyx.js");



/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_Onyx__WEBPACK_IMPORTED_MODULE_0__["default"]);

})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=web.development.js.map