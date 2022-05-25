(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("underscore"), require("expensify-common/lib/str"), require("lodash/merge"), require("localforage"), require("react"));
	else if(typeof define === 'function' && define.amd)
		define(["underscore", "expensify-common/lib/str", "lodash/merge", "localforage", "react"], factory);
	else if(typeof exports === 'object')
		exports["react-native-onyx/web"] = factory(require("underscore"), require("expensify-common/lib/str"), require("lodash/merge"), require("localforage"), require("react"));
	else
		root["react-native-onyx/web"] = factory(root["underscore"], root["expensify-common/lib/str"], root["lodash/merge"], root["localforage"], root["react"]);
})(self, (__WEBPACK_EXTERNAL_MODULE_underscore__, __WEBPACK_EXTERNAL_MODULE_expensify_common_lib_str__, __WEBPACK_EXTERNAL_MODULE_lodash_merge__, __WEBPACK_EXTERNAL_MODULE_localforage__, __WEBPACK_EXTERNAL_MODULE_react__) => {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/@babel/runtime/helpers/arrayLikeToArray.js":
/*!*****************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/arrayLikeToArray.js ***!
  \*****************************************************************/
/***/ ((module) => {

function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;

  for (var i = 0, arr2 = new Array(len); i < len; i++) {
    arr2[i] = arr[i];
  }

  return arr2;
}

module.exports = _arrayLikeToArray;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/arrayWithHoles.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/arrayWithHoles.js ***!
  \***************************************************************/
/***/ ((module) => {

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

module.exports = _arrayWithHoles;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/arrayWithoutHoles.js":
/*!******************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/arrayWithoutHoles.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayLikeToArray = __webpack_require__(/*! ./arrayLikeToArray */ "./node_modules/@babel/runtime/helpers/arrayLikeToArray.js");

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) return arrayLikeToArray(arr);
}

module.exports = _arrayWithoutHoles;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/assertThisInitialized.js":
/*!**********************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/assertThisInitialized.js ***!
  \**********************************************************************/
/***/ ((module) => {

function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return self;
}

module.exports = _assertThisInitialized;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/classCallCheck.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/classCallCheck.js ***!
  \***************************************************************/
/***/ ((module) => {

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

module.exports = _classCallCheck;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/createClass.js":
/*!************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/createClass.js ***!
  \************************************************************/
/***/ ((module) => {

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

module.exports = _createClass;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/defineProperty.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/defineProperty.js ***!
  \***************************************************************/
/***/ ((module) => {

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

module.exports = _defineProperty;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/extends.js":
/*!********************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/extends.js ***!
  \********************************************************/
/***/ ((module) => {

function _extends() {
  module.exports = _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

module.exports = _extends;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/getPrototypeOf.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/getPrototypeOf.js ***!
  \***************************************************************/
/***/ ((module) => {

function _getPrototypeOf(o) {
  module.exports = _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
    return o.__proto__ || Object.getPrototypeOf(o);
  };
  return _getPrototypeOf(o);
}

module.exports = _getPrototypeOf;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/inherits.js":
/*!*********************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/inherits.js ***!
  \*********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var setPrototypeOf = __webpack_require__(/*! ./setPrototypeOf */ "./node_modules/@babel/runtime/helpers/setPrototypeOf.js");

function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  if (superClass) setPrototypeOf(subClass, superClass);
}

module.exports = _inherits;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js":
/*!**********************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/interopRequireDefault.js ***!
  \**********************************************************************/
/***/ ((module) => {

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    "default": obj
  };
}

module.exports = _interopRequireDefault;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/iterableToArray.js":
/*!****************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/iterableToArray.js ***!
  \****************************************************************/
/***/ ((module) => {

function _iterableToArray(iter) {
  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
}

module.exports = _iterableToArray;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js":
/*!*********************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js ***!
  \*********************************************************************/
/***/ ((module) => {

function _iterableToArrayLimit(arr, i) {
  if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;

  try {
    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

module.exports = _iterableToArrayLimit;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/nonIterableRest.js":
/*!****************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/nonIterableRest.js ***!
  \****************************************************************/
/***/ ((module) => {

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

module.exports = _nonIterableRest;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/nonIterableSpread.js":
/*!******************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/nonIterableSpread.js ***!
  \******************************************************************/
/***/ ((module) => {

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

module.exports = _nonIterableSpread;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/possibleConstructorReturn.js":
/*!**************************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/possibleConstructorReturn.js ***!
  \**************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var _typeof = __webpack_require__(/*! @babel/runtime/helpers/typeof */ "./node_modules/@babel/runtime/helpers/typeof.js");

var assertThisInitialized = __webpack_require__(/*! ./assertThisInitialized */ "./node_modules/@babel/runtime/helpers/assertThisInitialized.js");

function _possibleConstructorReturn(self, call) {
  if (call && (_typeof(call) === "object" || typeof call === "function")) {
    return call;
  }

  return assertThisInitialized(self);
}

module.exports = _possibleConstructorReturn;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/setPrototypeOf.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/setPrototypeOf.js ***!
  \***************************************************************/
/***/ ((module) => {

function _setPrototypeOf(o, p) {
  module.exports = _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
    o.__proto__ = p;
    return o;
  };

  return _setPrototypeOf(o, p);
}

module.exports = _setPrototypeOf;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/slicedToArray.js":
/*!**************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/slicedToArray.js ***!
  \**************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayWithHoles = __webpack_require__(/*! ./arrayWithHoles */ "./node_modules/@babel/runtime/helpers/arrayWithHoles.js");

var iterableToArrayLimit = __webpack_require__(/*! ./iterableToArrayLimit */ "./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js");

var unsupportedIterableToArray = __webpack_require__(/*! ./unsupportedIterableToArray */ "./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js");

var nonIterableRest = __webpack_require__(/*! ./nonIterableRest */ "./node_modules/@babel/runtime/helpers/nonIterableRest.js");

function _slicedToArray(arr, i) {
  return arrayWithHoles(arr) || iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest();
}

module.exports = _slicedToArray;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/toConsumableArray.js":
/*!******************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/toConsumableArray.js ***!
  \******************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayWithoutHoles = __webpack_require__(/*! ./arrayWithoutHoles */ "./node_modules/@babel/runtime/helpers/arrayWithoutHoles.js");

var iterableToArray = __webpack_require__(/*! ./iterableToArray */ "./node_modules/@babel/runtime/helpers/iterableToArray.js");

var unsupportedIterableToArray = __webpack_require__(/*! ./unsupportedIterableToArray */ "./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js");

var nonIterableSpread = __webpack_require__(/*! ./nonIterableSpread */ "./node_modules/@babel/runtime/helpers/nonIterableSpread.js");

function _toConsumableArray(arr) {
  return arrayWithoutHoles(arr) || iterableToArray(arr) || unsupportedIterableToArray(arr) || nonIterableSpread();
}

module.exports = _toConsumableArray;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/typeof.js":
/*!*******************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/typeof.js ***!
  \*******************************************************/
/***/ ((module) => {

function _typeof(obj) {
  "@babel/helpers - typeof";

  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    module.exports = _typeof = function _typeof(obj) {
      return typeof obj;
    };
  } else {
    module.exports = _typeof = function _typeof(obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    };
  }

  return _typeof(obj);
}

module.exports = _typeof;

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js":
/*!***************************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js ***!
  \***************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var arrayLikeToArray = __webpack_require__(/*! ./arrayLikeToArray */ "./node_modules/@babel/runtime/helpers/arrayLikeToArray.js");

function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
}

module.exports = _unsupportedIterableToArray;

/***/ }),

/***/ "./lib/Logger.js":
/*!***********************!*\
  !*** ./lib/Logger.js ***!
  \***********************/
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));exports.registerLogger = registerLogger;exports.logInfo = logInfo;exports.logAlert = logAlert; // Logging callback
var logger = function logger() {};

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
  logger({ message: "[Onyx] " + message, level: 'alert' });
}

/**
 * Send an info message to the logger
 *
 * @param {String} message
 */
function logInfo(message) {
  logger({ message: "[Onyx] " + message, level: 'info' });
}

/***/ }),

/***/ "./lib/Onyx.js":
/*!*********************!*\
  !*** ./lib/Onyx.js ***!
  \*********************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = void 0;var _slicedToArray2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/slicedToArray */ "./node_modules/@babel/runtime/helpers/slicedToArray.js"));var _toConsumableArray2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/toConsumableArray */ "./node_modules/@babel/runtime/helpers/toConsumableArray.js"));var _defineProperty2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "./node_modules/@babel/runtime/helpers/defineProperty.js"));var _extends4 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/extends */ "./node_modules/@babel/runtime/helpers/extends.js"));var _underscore = _interopRequireDefault(__webpack_require__(/*! underscore */ "underscore"));
var _str = _interopRequireDefault(__webpack_require__(/*! expensify-common/lib/str */ "expensify-common/lib/str"));
var _merge = _interopRequireDefault(__webpack_require__(/*! lodash/merge */ "lodash/merge"));
var _storage = _interopRequireDefault(__webpack_require__(/*! ./storage */ "./lib/storage/index.web.js"));

var _Logger = __webpack_require__(/*! ./Logger */ "./lib/Logger.js");
var _OnyxCache = _interopRequireDefault(__webpack_require__(/*! ./OnyxCache */ "./lib/OnyxCache.js"));
var _createDeferredTask = _interopRequireDefault(__webpack_require__(/*! ./createDeferredTask */ "./lib/createDeferredTask.js"));

// Keeps track of the last connectionID that was used so we can keep incrementing it
var lastConnectionID = 0;

// Holds a mapping of all the react components that want their state subscribed to a store key
var callbackToStateMapping = {};

// Stores all of the keys that Onyx can use. Must be defined in init().
var onyxKeys = {};

// Holds a list of keys that have been directly subscribed to or recently modified from least to most recent
var recentlyAccessedKeys = [];

// Holds a list of keys that are safe to remove when we reach max storage. If a key does not match with
// whatever appears in this list it will NEVER be a candidate for eviction.
var evictionAllowList = [];

// Holds a map of keys and connectionID arrays whose keys will never be automatically evicted as
// long as we have at least one subscriber that returns false for the canEvict property.
var evictionBlocklist = {};

// Optional user-provided key value states set when Onyx initializes or clears
var defaultKeyStates = {};

// Connections can be made before `Onyx.init`. They would wait for this task before resolving
var deferredInitTask = (0, _createDeferredTask.default)();

/**
 * Get some data from the store
 *
 * @private
 * @param {string} key
 * @returns {Promise<*>}
 */
function get(key) {
  // When we already have the value in cache - resolve right away
  if (_OnyxCache.default.hasCacheForKey(key)) {
    return Promise.resolve(_OnyxCache.default.getValue(key));
  }

  var taskName = "get:" + key;

  // When a value retrieving task for this key is still running hook to it
  if (_OnyxCache.default.hasPendingTask(taskName)) {
    return _OnyxCache.default.getTaskPromise(taskName);
  }

  // Otherwise retrieve the value from storage and capture a promise to aid concurrent usages
  var promise = _storage.default.getItem(key).
  then(function (val) {
    _OnyxCache.default.set(key, val);
    return val;
  }).
  catch(function (err) {return (0, _Logger.logInfo)("Unable to get item from persistent storage. Key: " + key + " Error: " + err);});

  return _OnyxCache.default.captureTask(taskName, promise);
}

/**
 * Returns current key names stored in persisted storage
 * @private
 * @returns {Promise<string[]>}
 */
function getAllKeys() {
  // When we've already read stored keys, resolve right away
  var storedKeys = _OnyxCache.default.getAllKeys();
  if (storedKeys.length > 0) {
    return Promise.resolve(storedKeys);
  }

  var taskName = 'getAllKeys';

  // When a value retrieving task for all keys is still running hook to it
  if (_OnyxCache.default.hasPendingTask(taskName)) {
    return _OnyxCache.default.getTaskPromise(taskName);
  }

  // Otherwise retrieve the keys from storage and capture a promise to aid concurrent usages
  var promise = _storage.default.getAllKeys().
  then(function (keys) {
    _underscore.default.each(keys, function (key) {return _OnyxCache.default.addKey(key);});
    return keys;
  });

  return _OnyxCache.default.captureTask(taskName, promise);
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
  return _underscore.default.contains(_underscore.default.values(onyxKeys.COLLECTION), key);
}

/**
 * Checks to see if a given key matches with the
 * configured key of our connected subscriber
 *
 * @private
 * @param {String} configKey
 * @param {String} key
 * @return {Boolean}
 */
function isKeyMatch(configKey, key) {
  return isCollectionKey(configKey) ?
  _str.default.startsWith(key, configKey) :
  configKey === key;
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
  return _underscore.default.some(evictionAllowList, function (key) {return isKeyMatch(key, testKey);});
}

/**
 * Remove a key from the recently accessed key list.
 *
 * @private
 * @param {String} key
 */
function removeLastAccessedKey(key) {
  recentlyAccessedKeys = _underscore.default.without(recentlyAccessedKeys, key);
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
  evictionBlocklist[key] = _underscore.default.without(evictionBlocklist[key] || [], connectionID);

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
  return getAllKeys().
  then(function (keys) {
    _underscore.default.each(evictionAllowList, function (safeEvictionKey) {
      _underscore.default.each(keys, function (key) {
        if (isKeyMatch(safeEvictionKey, key)) {
          addLastAccessedKey(key);
        }
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
  var collectionMemberKeys = _underscore.default.filter(_OnyxCache.default.getAllKeys(),
  function (storedKey) {return isKeyMatch(collectionKey, storedKey);});


  return _underscore.default.reduce(collectionMemberKeys, function (prev, curr) {
    var cachedValue = _OnyxCache.default.getValue(curr);
    if (!cachedValue) {
      return prev;
    }
    return (0, _extends4.default)({},
    prev, (0, _defineProperty2.default)({},
    curr, cachedValue));

  }, {});
}

/**
 * When a collection of keys change, search for any callbacks matching the collection key and trigger those callbacks
 *
 * @private
 * @param {String} collectionKey
 * @param {Object} collection
 */
function keysChanged(collectionKey, collection) {
  // Find all subscribers that were added with connect() and trigger the callback or setState() with the new data
  _underscore.default.each(callbackToStateMapping, function (subscriber) {
    if (!subscriber) {
      return;
    }

    var isSubscribedToCollectionKey = isKeyMatch(subscriber.key, collectionKey) &&
    isCollectionKey(subscriber.key);
    var isSubscribedToCollectionMemberKey = subscriber.key.startsWith(collectionKey);

    if (isSubscribedToCollectionKey) {
      if (_underscore.default.isFunction(subscriber.callback)) {
        // eslint-disable-next-line no-use-before-define
        var cachedCollection = getCachedCollection(collectionKey);
        _underscore.default.each(collection, function (data, dataKey) {
          subscriber.callback(cachedCollection[dataKey], dataKey);
        });
      } else if (subscriber.withOnyxInstance) {
        subscriber.withOnyxInstance.setState(function (prevState) {
          var finalCollection = _underscore.default.clone(prevState[subscriber.statePropertyName] || {});
          _underscore.default.each(collection, function (data, dataKey) {
            if (finalCollection[dataKey]) {
              (0, _merge.default)(finalCollection[dataKey], data);
            } else {
              finalCollection[dataKey] = data;
            }
          });

          return (0, _defineProperty2.default)({},
          subscriber.statePropertyName, finalCollection);

        });
      }
    } else if (isSubscribedToCollectionMemberKey) {
      var dataFromCollection = collection[subscriber.key];

      // If `dataFromCollection` happens to not exist, then return early so that there are no unnecessary
      // re-renderings of the component
      if (_underscore.default.isUndefined(dataFromCollection)) {
        return;
      }

      subscriber.withOnyxInstance.setState(function (prevState) {return (0, _defineProperty2.default)({},
        subscriber.statePropertyName, _underscore.default.isObject(dataFromCollection) ? (0, _extends4.default)({},

        prevState[subscriber.statePropertyName],
        dataFromCollection) :

        dataFromCollection);});

    }
  });
}

/**
 * When a key change happens, search for any callbacks matching the key or collection key and trigger those callbacks
 *
 * @private
 * @param {String} key
 * @param {*} data
 */
function keyChanged(key, data) {
  // Add or remove this key from the recentlyAccessedKeys lists
  if (!_underscore.default.isNull(data)) {
    addLastAccessedKey(key);
  } else {
    removeLastAccessedKey(key);
  }

  // Find all subscribers that were added with connect() and trigger the callback or setState() with the new data
  _underscore.default.each(callbackToStateMapping, function (subscriber) {
    if (subscriber && isKeyMatch(subscriber.key, key)) {
      if (_underscore.default.isFunction(subscriber.callback)) {
        subscriber.callback(data, key);
      }

      if (!subscriber.withOnyxInstance) {
        return;
      }

      // Check if we are subscribing to a collection key and add this item as a collection
      if (isCollectionKey(subscriber.key)) {
        subscriber.withOnyxInstance.setState(function (prevState) {
          var collection = _underscore.default.clone(prevState[subscriber.statePropertyName] || {});
          collection[key] = data;
          return (0, _defineProperty2.default)({},
          subscriber.statePropertyName, collection);

        });
      } else {
        subscriber.withOnyxInstance.setState((0, _defineProperty2.default)({},
        subscriber.statePropertyName, data));

      }
    }
  });
}

/**
 * Sends the data obtained from the keys to the connection. It either:
 *     - sets state on the withOnyxInstances
 *     - triggers the callback function
 *
 * @private
 * @param {object} config
 * @param {object} [config.withOnyxInstance]
 * @param {string} [config.statePropertyName]
 * @param {function} [config.callback]
 * @param {*|null} val
 * @param {String} key
 */
function sendDataToConnection(config, val, key) {
  // If the mapping no longer exists then we should not send any data.
  // This means our subscriber disconnected or withOnyx wrapped component unmounted.
  if (!callbackToStateMapping[config.connectionID]) {
    return;
  }

  if (config.withOnyxInstance) {
    config.withOnyxInstance.setWithOnyxState(config.statePropertyName, val);
  } else if (_underscore.default.isFunction(config.callback)) {
    config.callback(val, key);
  }
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
 * @returns {Number} an ID to use when calling disconnect
 */
function connect(mapping) {
  var connectionID = lastConnectionID++;
  callbackToStateMapping[connectionID] = mapping;
  callbackToStateMapping[connectionID].connectionID = connectionID;

  if (mapping.initWithStoredValues === false) {
    return connectionID;
  }

  // Commit connection only after init passes
  deferredInitTask.promise.
  then(function () {
    // Check to see if this key is flagged as a safe eviction key and add it to the recentlyAccessedKeys list
    if (isSafeEvictionKey(mapping.key)) {
      // Try to free some cache whenever we connect to a safe eviction key
      _OnyxCache.default.removeLeastRecentlyUsedKeys();

      if (mapping.withOnyxInstance && !isCollectionKey(mapping.key)) {
        // All React components subscribing to a key flagged as a safe eviction
        // key must implement the canEvict property.
        if (_underscore.default.isUndefined(mapping.canEvict)) {
          throw new Error("Cannot subscribe to safe eviction key '" +
          mapping.key + "' without providing a canEvict value.");

        }

        addLastAccessedKey(mapping.key);
      }
    }
  }).
  then(getAllKeys).
  then(function (keys) {
    // Find all the keys matched by the config key
    var matchingKeys = _underscore.default.filter(keys, function (key) {return isKeyMatch(mapping.key, key);});

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
      Promise.all(_underscore.default.map(matchingKeys, function (key) {return get(key);})).
      then(function (values) {return _underscore.default.reduce(values, function (finalObject, value, i) {return (0, _extends4.default)({},
          finalObject, (0, _defineProperty2.default)({},
          matchingKeys[i], value));},
        {});}).
      then(function (val) {return sendDataToConnection(mapping, val);});
    } else {
      _underscore.default.each(matchingKeys, function (key) {
        get(key).then(function (val) {return sendDataToConnection(mapping, val, key);});
      });
    }
  });

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
 * Remove a key from Onyx and update the subscribers
 *
 * @private
 * @param {String} key
 * @return {Promise}
 */
function remove(key) {
  // Cache the fact that the value was removed
  _OnyxCache.default.set(key, null);

  // Optimistically inform subscribers on the next tick
  Promise.resolve().then(function () {return keyChanged(key, null);});

  return _storage.default.removeItem(key);
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
  (0, _Logger.logInfo)("Handled error: " + error);

  if (error && _str.default.startsWith(error.message, 'Failed to execute \'put\' on \'IDBObjectStore\'')) {
    (0, _Logger.logAlert)('Attempted to set invalid data set in Onyx. Please ensure all data is serializable.');
    throw error;
  }

  // Find the first key that we can remove that has no subscribers in our blocklist
  var keyForRemoval = _underscore.default.find(recentlyAccessedKeys, function (key) {return !evictionBlocklist[key];});

  if (!keyForRemoval) {
    (0, _Logger.logAlert)('Out of storage. But found no acceptable keys to remove.');
    throw error;
  }

  // Remove the least recently viewed key that is not currently being accessed and retry.
  (0, _Logger.logInfo)("Out of storage. Evicting least recently accessed key (" + keyForRemoval + ") and retrying.");
  return remove(keyForRemoval).
  then(function () {return onyxMethod.apply(void 0, args);});
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
  // Logging properties only since values could be sensitive things we don't want to log
  (0, _Logger.logInfo)("set() called for key: " + key + (_underscore.default.isObject(value) ? " properties: " + _underscore.default.keys(value).join(',') : ''));

  // eslint-disable-next-line no-use-before-define
  if (hasPendingMergeForKey(key)) {
    // eslint-disable-next-line max-len
    (0, _Logger.logAlert)("Onyx.set() called after Onyx.merge() for key: " + key + ". It is recommended to use set() or merge() not both.");
  }

  // Adds the key to cache when it's not available
  _OnyxCache.default.set(key, value);

  // Optimistically inform subscribers on the next tick
  Promise.resolve().then(function () {return keyChanged(key, value);});

  // Write the thing to persistent storage, which will trigger a storage event for any other tabs open on this domain
  return _storage.default.setItem(key, value).
  catch(function (error) {return evictStorageAndRetry(error, set, key, value);});
}

/**
 * Storage expects array like: [["@MyApp_user", value_1], ["@MyApp_key", value_2]]
 * This method transforms an object like {'@MyApp_user': myUserValue, '@MyApp_key': myKeyValue}
 * to an array of key-value pairs in the above format
 * @private
 * @param {Record} data
 * @return {Array} an array of key - value pairs <[key, value]>
 */
function prepareKeyValuePairsForStorage(data) {
  return _underscore.default.map(data, function (value, key) {return [key, value];});
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
  var keyValuePairs = prepareKeyValuePairsForStorage(data);

  _underscore.default.each(data, function (val, key) {
    // Update cache and optimistically inform subscribers on the next tick
    _OnyxCache.default.set(key, val);
    Promise.resolve().then(function () {return keyChanged(key, val);});
  });

  return _storage.default.multiSet(keyValuePairs).
  catch(function (error) {return evictStorageAndRetry(error, multiSet, data);});
}

// Key/value store of Onyx key and arrays of values to merge
var mergeQueue = {};

/**
 * @private
 * @param {String} key
 * @returns {Boolean}
 */
function hasPendingMergeForKey(key) {
  return Boolean(mergeQueue[key]);
}

/**
 * Given an Onyx key and value this method will combine all queued
 * value updates and return a single value. Merge attempts are
 * batched. They must occur after a single call to get() so we
 * can avoid race conditions.
 *
 * @private
 * @param {String} key
 * @param {*} data
 *
 * @returns {*}
 */
function applyMerge(key, data) {
  var mergeValues = mergeQueue[key];
  if (_underscore.default.isArray(data) || _underscore.default.every(mergeValues, _underscore.default.isArray)) {
    // Array values will always just concatenate
    // more items onto the end of the array
    return _underscore.default.reduce(mergeValues, function (modifiedData, mergeValue) {return [].concat((0, _toConsumableArray2.default)(
      modifiedData), (0, _toConsumableArray2.default)(
      mergeValue));},
    data || []);
  }

  if (_underscore.default.isObject(data) || _underscore.default.every(mergeValues, _underscore.default.isObject)) {
    // Object values are merged one after the other
    return _underscore.default.reduce(mergeValues, function (modifiedData, mergeValue) {
      var newData = (0, _merge.default)({}, modifiedData, mergeValue);

      // We will also delete any object keys that are undefined or null.
      // Deleting keys is not supported by AsyncStorage so we do it this way.
      // Remove all first level keys that are explicitly set to null.
      return _underscore.default.omit(newData, function (value, finalObjectKey) {return _underscore.default.isNull(mergeValue[finalObjectKey]);});
    }, data || {});
  }

  // If we have anything else we can't merge it so we'll
  // simply return the last value that was queued
  return _underscore.default.last(mergeValues);
}

/**
 * Merge a new value into an existing value at a key.
 *
 * The types of values that can be merged are `Object` and `Array`. To set another type of value use `Onyx.set()`. Merge
 * behavior uses lodash/merge under the hood for `Object` and simple concatenation for `Array`. However, it's important
 * to note that if you have an array value property on an `Object` that the default behavior of lodash/merge is not to
 * concatenate. See here: https://github.com/lodash/lodash/issues/2872
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
 * @param {(Object|Array)} value Object or Array value to merge
 * @returns {Promise}
 */
function merge(key, value) {
  if (mergeQueue[key]) {
    mergeQueue[key].push(value);
    return Promise.resolve();
  }

  mergeQueue[key] = [value];
  return get(key).
  then(function (data) {
    try {
      var modifiedData = applyMerge(key, data);

      // Clean up the write queue so we
      // don't apply these changes again
      delete mergeQueue[key];

      return set(key, modifiedData);
    } catch (error) {
      (0, _Logger.logAlert)("An error occurred while applying merge for key: " + key + ", Error: " + error);
    }

    return Promise.resolve();
  });
}

/**
 * Merge user provided default key value pairs.
 * @private
 * @returns {Promise}
 */
function initializeWithDefaultKeyStates() {
  return _storage.default.multiGet(_underscore.default.keys(defaultKeyStates)).
  then(function (pairs) {
    var asObject = _underscore.default.object(pairs);

    var merged = (0, _merge.default)(asObject, defaultKeyStates);
    _OnyxCache.default.merge(merged);
    _underscore.default.each(merged, function (val, key) {return keyChanged(key, val);});
  });
}

/**
 * Clear out all the data in the store
 *
 * @returns {Promise<void>}
 */
function clear() {
  return getAllKeys().
  then(function (keys) {
    _underscore.default.each(keys, function (key) {
      keyChanged(key, null);
      _OnyxCache.default.set(key, null);
    });
  }).
  then(_storage.default.clear).
  then(initializeWithDefaultKeyStates);
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
  // Confirm all the collection keys belong to the same parent
  _underscore.default.each(collection, function (data, dataKey) {
    if (!isKeyMatch(collectionKey, dataKey)) {
      // eslint-disable-next-line max-len
      throw new Error("Provided collection does not have all its data belonging to the same parent. CollectionKey: " + collectionKey + ", DataKey: " + dataKey);
    }
  });

  return getAllKeys().
  then(function (persistedKeys) {
    // Split to keys that exist in storage and keys that don't
    var _$chain$keys$partitio = _underscore.default.chain(collection).
    keys().
    partition(function (key) {return persistedKeys.includes(key);}).
    value(),_$chain$keys$partitio2 = (0, _slicedToArray2.default)(_$chain$keys$partitio, 2),existingKeys = _$chain$keys$partitio2[0],newKeys = _$chain$keys$partitio2[1];

    var existingKeyCollection = _underscore.default.pick(collection, existingKeys);
    var newCollection = _underscore.default.pick(collection, newKeys);
    var keyValuePairsForExistingCollection = prepareKeyValuePairsForStorage(existingKeyCollection);
    var keyValuePairsForNewCollection = prepareKeyValuePairsForStorage(newCollection);

    var promises = [];

    // New keys will be added via multiSet while existing keys will be updated using multiMerge
    // This is because setting a key that doesn't exist yet with multiMerge will throw errors
    if (keyValuePairsForExistingCollection.length > 0) {
      promises.push(_storage.default.multiMerge(keyValuePairsForExistingCollection));
    }

    if (keyValuePairsForNewCollection.length > 0) {
      promises.push(_storage.default.multiSet(keyValuePairsForNewCollection));
    }

    // Prefill cache if necessary by calling get() on any existing keys and then merge original data to cache
    // and update all subscribers
    Promise.all(_underscore.default.map(existingKeys, get)).then(function () {
      _OnyxCache.default.merge(collection);
      keysChanged(collectionKey, collection);
    });

    return Promise.all(promises).
    catch(function (error) {return evictStorageAndRetry(error, mergeCollection, collection);});
  });
}

/**
 * Insert API responses and lifecycle data into Onyx
 *
 * @param {Array} data An array of objects with shape {onyxMethod: oneOf('set', 'merge'), key: string, value: *}
 */
function update(data) {
  // First, validate the Onyx object is in the format we expect
  _underscore.default.each(data, function (_ref4) {var onyxMethod = _ref4.onyxMethod,key = _ref4.key;
    if (!_underscore.default.contains(['set', 'merge'], onyxMethod)) {
      throw new Error("Invalid onyxMethod " + onyxMethod + " in Onyx update.");
    }
    if (!_underscore.default.isString(key)) {
      throw new Error("Invalid " + typeof key + " key provided in Onyx update. Onyx key must be of type string.");
    }
  });

  _underscore.default.each(data, function (_ref5) {var onyxMethod = _ref5.onyxMethod,key = _ref5.key,value = _ref5.value;
    switch (onyxMethod) {
      case 'set':
        set(key, value);
        break;
      case 'merge':
        merge(key, value);
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
 * @param {String[]} [option.keysToDisableSyncEvents=[]] Contains keys for which
 * we want to disable sync event across tabs.
 * @example
 * Onyx.init({
 *     keys: ONYXKEYS,
 *     initialKeyStates: {
 *         [ONYXKEYS.SESSION]: {loading: false},
 *     },
 * });
 */
function init()







{var _ref6 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},_ref6$keys = _ref6.keys,keys = _ref6$keys === void 0 ? {} : _ref6$keys,_ref6$initialKeyState = _ref6.initialKeyStates,initialKeyStates = _ref6$initialKeyState === void 0 ? {} : _ref6$initialKeyState,_ref6$safeEvictionKey = _ref6.safeEvictionKeys,safeEvictionKeys = _ref6$safeEvictionKey === void 0 ? [] : _ref6$safeEvictionKey,_ref6$maxCachedKeysCo = _ref6.maxCachedKeysCount,maxCachedKeysCount = _ref6$maxCachedKeysCo === void 0 ? 1000 : _ref6$maxCachedKeysCo,_ref6$captureMetrics = _ref6.captureMetrics,captureMetrics = _ref6$captureMetrics === void 0 ? false : _ref6$captureMetrics,_ref6$shouldSyncMulti = _ref6.shouldSyncMultipleInstances,shouldSyncMultipleInstances = _ref6$shouldSyncMulti === void 0 ? Boolean(__webpack_require__.g.localStorage) : _ref6$shouldSyncMulti,_ref6$keysToDisableSy = _ref6.keysToDisableSyncEvents,keysToDisableSyncEvents = _ref6$keysToDisableSy === void 0 ? [] : _ref6$keysToDisableSy;
  if (captureMetrics) {
    // The code here is only bundled and applied when the captureMetrics is set
    // eslint-disable-next-line no-use-before-define
    applyDecorators();
  }

  if (maxCachedKeysCount > 0) {
    _OnyxCache.default.setRecentKeysLimit(maxCachedKeysCount);
  }

  // Let Onyx know about all of our keys
  onyxKeys = keys;

  // Set our default key states to use when initializing and clearing Onyx data
  defaultKeyStates = initialKeyStates;

  // Let Onyx know about which keys are safe to evict
  evictionAllowList = safeEvictionKeys;

  // Initialize all of our keys with data provided then give green light to any pending connections
  Promise.all([
  addAllSafeEvictionKeysToRecentlyAccessedList(),
  initializeWithDefaultKeyStates()]).

  then(deferredInitTask.resolve);

  if (shouldSyncMultipleInstances && _underscore.default.isFunction(_storage.default.keepInstancesSync)) {
    _storage.default.keepInstancesSync(keysToDisableSyncEvents, function (key, value) {
      _OnyxCache.default.set(key, value);
      keyChanged(key, value);
    });
  }
}

var Onyx = {
  connect: connect,
  disconnect: disconnect,
  set: set,
  multiSet: multiSet,
  merge: merge,
  mergeCollection: mergeCollection,
  update: update,
  clear: clear,
  init: init,
  registerLogger: _Logger.registerLogger,
  addToEvictionBlockList: addToEvictionBlockList,
  removeFromEvictionBlockList: removeFromEvictionBlockList,
  isSafeEvictionKey: isSafeEvictionKey };


/**
 * Apply calls statistic decorators to benchmark Onyx
 *
 * @private
 */
function applyDecorators() {
  // We're requiring the script dynamically here so that it's only evaluated when decorators are used
  var decorate = __webpack_require__(/*! ./metrics */ "./lib/metrics/index.web.js");

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
  Onyx.set = set;
  Onyx.multiSet = multiSet;
  Onyx.clear = clear;
  Onyx.merge = merge;
  Onyx.mergeCollection = mergeCollection;
  Onyx.update = update;

  // Expose stats methods on Onyx
  Onyx.getMetrics = decorate.getMetrics;
  Onyx.resetMetrics = decorate.resetMetrics;
  Onyx.printMetrics = decorate.printMetrics;
}var _default =

Onyx;exports["default"] = _default;

/***/ }),

/***/ "./lib/OnyxCache.js":
/*!**************************!*\
  !*** ./lib/OnyxCache.js ***!
  \**************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = void 0;var _toConsumableArray2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/toConsumableArray */ "./node_modules/@babel/runtime/helpers/toConsumableArray.js"));var _classCallCheck2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ "./node_modules/@babel/runtime/helpers/classCallCheck.js"));var _createClass2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/createClass */ "./node_modules/@babel/runtime/helpers/createClass.js"));var _underscore = _interopRequireDefault(__webpack_require__(/*! underscore */ "underscore"));
var _merge = _interopRequireDefault(__webpack_require__(/*! lodash/merge */ "lodash/merge"));


var isDefined = _underscore.default.negate(_underscore.default.isUndefined);

/**
 * In memory cache providing data by reference
 * Encapsulates Onyx cache related functionality
 */var
OnyxCache = /*#__PURE__*/function () {
  function OnyxCache() {(0, _classCallCheck2.default)(this, OnyxCache);
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
     * @type {Record<string, Promise>}
     */
    this.pendingPromises = {};

    // bind all public methods to prevent problems with `this`
    _underscore.default.bindAll(
    this,
    'getAllKeys', 'getValue', 'hasCacheForKey', 'addKey', 'set', 'drop', 'merge',
    'hasPendingTask', 'getTaskPromise', 'captureTask', 'removeLeastRecentlyUsedKeys',
    'setRecentKeysLimit');

  }

  /**
   * Get all the storage keys
   * @returns {string[]}
   */(0, _createClass2.default)(OnyxCache, [{ key: "getAllKeys", value: function getAllKeys()
    {
      return Array.from(this.storageKeys);
    }

    /**
     * Get a cached value from storage
     * @param {string} key
     * @returns {*}
     */ }, { key: "getValue", value: function getValue(
    key) {
      this.addToAccessedKeys(key);
      return this.storageMap[key];
    }

    /**
     * Check whether cache has data for the given key
     * @param {string} key
     * @returns {boolean}
     */ }, { key: "hasCacheForKey", value: function hasCacheForKey(
    key) {
      return isDefined(this.storageMap[key]);
    }

    /**
     * Saves a key in the storage keys list
     * Serves to keep the result of `getAllKeys` up to date
     * @param {string} key
     */ }, { key: "addKey", value: function addKey(
    key) {
      this.storageKeys.add(key);
    }

    /**
     * Set's a key value in cache
     * Adds the key to the storage keys list as well
     * @param {string} key
     * @param {*} value
     * @returns {*} value - returns the cache value
     */ }, { key: "set", value: function set(
    key, value) {
      this.addKey(key);
      this.addToAccessedKeys(key);
      this.storageMap[key] = value;

      return value;
    }

    /**
     * Forget the cached value for the given key
     * @param {string} key
     */ }, { key: "drop", value: function drop(
    key) {
      delete this.storageMap[key];
    }

    /**
     * Deep merge data to cache, any non existing keys will be created
     * @param {Record<string, *>} data - a map of (cache) key - values
     */ }, { key: "merge", value: function merge(
    data) {var _this = this;
      this.storageMap = (0, _merge.default)({}, this.storageMap, data);

      var storageKeys = this.getAllKeys();
      var mergedKeys = _underscore.default.keys(data);
      this.storageKeys = new Set([].concat((0, _toConsumableArray2.default)(storageKeys), (0, _toConsumableArray2.default)(mergedKeys)));
      _underscore.default.each(mergedKeys, function (key) {return _this.addToAccessedKeys(key);});
    }

    /**
     * Check whether the given task is already running
     * @param {string} taskName - unique name given for the task
     * @returns {*}
     */ }, { key: "hasPendingTask", value: function hasPendingTask(
    taskName) {
      return isDefined(this.pendingPromises[taskName]);
    }

    /**
     * Use this method to prevent concurrent calls for the same thing
     * Instead of calling the same task again use the existing promise
     * provided from this function
     * @template T
     * @param {string} taskName - unique name given for the task
     * @returns {Promise<T>}
     */ }, { key: "getTaskPromise", value: function getTaskPromise(
    taskName) {
      return this.pendingPromises[taskName];
    }

    /**
     * Capture a promise for a given task so other caller can
     * hook up to the promise if it's still pending
     * @template T
     * @param {string} taskName - unique name for the task
     * @param {Promise<T>} promise
     * @returns {Promise<T>}
     */ }, { key: "captureTask", value: function captureTask(
    taskName, promise) {var _this2 = this;
      this.pendingPromises[taskName] = promise.finally(function () {
        delete _this2.pendingPromises[taskName];
      });

      return this.pendingPromises[taskName];
    }

    /**
     * @private
     * Adds a key to the top of the recently accessed keys
     * @param {string} key
     */ }, { key: "addToAccessedKeys", value: function addToAccessedKeys(
    key) {
      // Removing and re-adding a key ensures it's at the end of the list
      this.recentKeys.delete(key);
      this.recentKeys.add(key);
    }

    /**
     * Remove keys that don't fall into the range of recently used keys
     */ }, { key: "removeLeastRecentlyUsedKeys", value: function removeLeastRecentlyUsedKeys()
    {
      if (this.recentKeys.size > this.maxRecentKeysSize) {
        // Get the last N keys by doing a negative slice
        var recentlyAccessed = (0, _toConsumableArray2.default)(this.recentKeys).slice(-this.maxRecentKeysSize);
        var storageKeys = _underscore.default.keys(this.storageMap);
        var keysToRemove = _underscore.default.difference(storageKeys, recentlyAccessed);

        _underscore.default.each(keysToRemove, this.drop);
      }
    }

    /**
     * Set the recent keys list size
     * @param {number} limit
     */ }, { key: "setRecentKeysLimit", value: function setRecentKeysLimit(
    limit) {
      this.maxRecentKeysSize = limit;
    } }]);return OnyxCache;}();


var instance = new OnyxCache();var _default =

instance;exports["default"] = _default;

/***/ }),

/***/ "./lib/SyncQueue.js":
/*!**************************!*\
  !*** ./lib/SyncQueue.js ***!
  \**************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = void 0;var _classCallCheck2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ "./node_modules/@babel/runtime/helpers/classCallCheck.js"));var _createClass2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/createClass */ "./node_modules/@babel/runtime/helpers/createClass.js")); /**
 * Synchronous queue that can be used to ensure promise based tasks are run in sequence.
 * Pass to the constructor a function that returns a promise to run the task then add data.
 *
 * @example
 *
 *     const queue = new SyncQueue(({key, val}) => {
 *         return someAsyncProcess(key, val);
 *     });
 *
 *     queue.push({key: 1, val: '1'});
 *     queue.push({key: 2, val: '2'});
 */var
SyncQueue = /*#__PURE__*/function () {
  /**
   * @param {Function} run - must return a promise
   */
  function SyncQueue(run) {(0, _classCallCheck2.default)(this, SyncQueue);
    this.queue = [];
    this.isProcessing = false;
    this.run = run;
  }(0, _createClass2.default)(SyncQueue, [{ key: "process", value: function process()

    {var _this = this;
      if (this.isProcessing || this.queue.length === 0) {
        return;
      }

      this.isProcessing = true;var _this$queue$shift =

      this.queue.shift(),data = _this$queue$shift.data,resolve = _this$queue$shift.resolve,reject = _this$queue$shift.reject;
      this.run(data).
      then(resolve).
      catch(reject).
      finally(function () {
        _this.isProcessing = false;
        _this.process();
      });
    }

    /**
     * @param {*} data
     * @returns {Promise}
     */ }, { key: "push", value: function push(
    data) {var _this2 = this;
      return new Promise(function (resolve, reject) {
        _this2.queue.push({ resolve: resolve, reject: reject, data: data });
        _this2.process();
      });
    } }]);return SyncQueue;}();exports["default"] = SyncQueue;

/***/ }),

/***/ "./lib/createDeferredTask.js":
/*!***********************************!*\
  !*** ./lib/createDeferredTask.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = createDeferredTask; /**
 * Create a deferred task that can be resolved when we call `resolve()`
 * The returned promise will complete when we call `resolve`
 * Useful when we want to wait for a tasks that is resolved from an external action
 *
 * @template T
 * @returns {{ resolve: function(*), promise: Promise<T|void> }}
 */
function createDeferredTask() {
  var deferred = {};
  deferred.promise = new Promise(function (res) {
    deferred.resolve = res;
  });

  return deferred;
}

/***/ }),

/***/ "./lib/metrics/index.web.js":
/*!**********************************!*\
  !*** ./lib/metrics/index.web.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports) => {

Object.defineProperty(exports, "__esModule", ({ value: true }));exports.decorateWithMetrics = decorateWithMetrics;exports.getMetrics = getMetrics;exports.resetMetrics = resetMetrics;exports.printMetrics = printMetrics; // For web-only implementations of Onyx, this module will just be a no-op

function decorateWithMetrics() {}
function getMetrics() {}
function printMetrics() {}
function resetMetrics() {}

/***/ }),

/***/ "./lib/storage/WebStorage.js":
/*!***********************************!*\
  !*** ./lib/storage/WebStorage.js ***!
  \***********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = void 0;var _extends2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/extends */ "./node_modules/@babel/runtime/helpers/extends.js"));var _underscore = _interopRequireDefault(__webpack_require__(/*! underscore */ "underscore"));
var _LocalForage = _interopRequireDefault(__webpack_require__(/*! ./providers/LocalForage */ "./lib/storage/providers/LocalForage.js"));

var SYNC_ONYX = 'SYNC_ONYX';

/**
 * Raise an event thorough `localStorage` to let other tabs know a value changed
 * @param {String} onyxKey
 */
function raiseStorageSyncEvent(onyxKey) {
  __webpack_require__.g.localStorage.setItem(SYNC_ONYX, onyxKey);
  __webpack_require__.g.localStorage.removeItem(SYNC_ONYX, onyxKey);
}

var webStorage = (0, _extends2.default)({},
_LocalForage.default, {

  /**
   * Contains keys for which we want to disable sync event across tabs.
   * @param {String[]} keysToDisableSyncEvents
   * Storage synchronization mechanism keeping all opened tabs in sync
   * @param {function(key: String, data: *)} onStorageKeyChanged
   */
  keepInstancesSync: function keepInstancesSync(keysToDisableSyncEvents, onStorageKeyChanged) {var _this = this;
    // Override set, remove and clear to raise storage events that we intercept in other tabs
    this.setItem = function (key, value) {return _LocalForage.default.setItem(key, value).
      then(function () {return raiseStorageSyncEvent(key);});};

    this.removeItem = function (key) {return _LocalForage.default.removeItem(key).
      then(function () {return raiseStorageSyncEvent(key);});};

    // If we just call Storage.clear other tabs will have no idea which keys were available previously
    // so that they can call keysChanged for them. That's why we iterate and remove keys one by one
    this.clear = function () {return _LocalForage.default.getAllKeys().
      then(function (keys) {return _underscore.default.map(keys, function (key) {return _this.removeItem(key);});}).
      then(function (tasks) {return Promise.all(tasks);});};

    // This listener will only be triggered by events coming from other tabs
    __webpack_require__.g.addEventListener('storage', function (event) {
      // Ignore events that don't originate from the SYNC_ONYX logic
      if (event.key !== SYNC_ONYX || !event.newValue) {
        return;
      }

      var onyxKey = event.newValue;
      if (_underscore.default.contains(keysToDisableSyncEvents, onyxKey)) {
        return;
      }

      _LocalForage.default.getItem(onyxKey).
      then(function (value) {return onStorageKeyChanged(onyxKey, value);});
    });
  } });var _default =


webStorage;exports["default"] = _default;

/***/ }),

/***/ "./lib/storage/index.web.js":
/*!**********************************!*\
  !*** ./lib/storage/index.web.js ***!
  \**********************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = void 0;var _WebStorage = _interopRequireDefault(__webpack_require__(/*! ./WebStorage */ "./lib/storage/WebStorage.js"));var _default =

_WebStorage.default;exports["default"] = _default;

/***/ }),

/***/ "./lib/storage/providers/LocalForage.js":
/*!**********************************************!*\
  !*** ./lib/storage/providers/LocalForage.js ***!
  \**********************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = void 0;var _slicedToArray2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/slicedToArray */ "./node_modules/@babel/runtime/helpers/slicedToArray.js"));





var _localforage = _interopRequireDefault(__webpack_require__(/*! localforage */ "localforage"));
var _underscore = _interopRequireDefault(__webpack_require__(/*! underscore */ "underscore"));
var _merge = _interopRequireDefault(__webpack_require__(/*! lodash/merge */ "lodash/merge"));
var _SyncQueue = _interopRequireDefault(__webpack_require__(/*! ../../SyncQueue */ "./lib/SyncQueue.js")); /**
 * @file
 * The storage provider based on localforage allows us to store most anything in its
 * natural form in the underlying DB without having to stringify or de-stringify it
 */_localforage.default.config({ name: 'OnyxDB' });

var provider = {
  /**
   * Writing very quickly to IndexedDB causes performance issues and can lock up the page and lead to jank.
   * So, we are slowing this process down by waiting until one write is complete before moving on
   * to the next.
   */
  setItemQueue: new _SyncQueue.default(function (_ref) {var key = _ref.key,value = _ref.value,shouldMerge = _ref.shouldMerge;
    if (shouldMerge) {
      return _localforage.default.getItem(key).
      then(function (existingValue) {
        var newValue = _underscore.default.isObject(existingValue) ?
        (0, _merge.default)({}, existingValue, value) :
        value;
        return _localforage.default.setItem(key, newValue);
      });
    }

    return _localforage.default.setItem(key, value);
  }),

  /**
   * Get multiple key-value pairs for the give array of keys in a batch
   * @param {String[]} keys
   * @return {Promise<Array<[key, value]>>}
   */
  multiGet: function multiGet(keys) {
    var pairs = _underscore.default.map(
    keys,
    function (key) {return _localforage.default.getItem(key).
      then(function (value) {return [key, value];});});


    return Promise.all(pairs);
  },

  /**
   * Multiple merging of existing and new values in a batch
   * @param {Array<[key, value]>} pairs
   * @return {Promise<void>}
   */
  multiMerge: function multiMerge(pairs) {var _this = this;
    var tasks = _underscore.default.map(pairs, function (_ref2) {var _ref3 = (0, _slicedToArray2.default)(_ref2, 2),key = _ref3[0],value = _ref3[1];return _this.setItemQueue.push({ key: key, value: value, shouldMerge: true });});

    // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
    return Promise.all(tasks).then(function () {return Promise.resolve();});
  },

  /**
   * Stores multiple key-value pairs in a batch
   * @param {Array<[key, value]>} pairs
   * @return {Promise<void>}
   */
  multiSet: function multiSet(pairs) {var _this2 = this;
    // We're returning Promise.resolve, otherwise the array of task results will be returned to the caller
    var tasks = _underscore.default.map(pairs, function (_ref4) {var _ref5 = (0, _slicedToArray2.default)(_ref4, 2),key = _ref5[0],value = _ref5[1];return _this2.setItem(key, value);});
    return Promise.all(tasks).then(function () {return Promise.resolve();});
  },

  /**
   * Clear absolutely everything from storage
   * @returns {Promise<void>}
   */
  clear: _localforage.default.clear,

  /**
   * Returns all keys available in storage
   * @returns {Promise<String[]>}
   */
  getAllKeys: _localforage.default.keys,

  /**
   * Get the value of a given key or return `null` if it's not available in storage
   * @param {String} key
   * @return {Promise<*>}
   */
  getItem: _localforage.default.getItem,

  /**
   * Remove given key and it's value from storage
   * @param {String} key
   * @returns {Promise<void>}
   */
  removeItem: _localforage.default.removeItem,

  /**
   * Sets the value for a given key. The only requirement is that the value should be serializable to JSON string
   * @param {String} key
   * @param {*} value
   * @return {Promise<void>}
   */
  setItem: function setItem(key, value) {
    return this.setItemQueue.push({ key: key, value: value });
  } };var _default =


provider;exports["default"] = _default;

/***/ }),

/***/ "./lib/withOnyx.js":
/*!*************************!*\
  !*** ./lib/withOnyx.js ***!
  \*************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));exports["default"] = _default;var _extends2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/extends */ "./node_modules/@babel/runtime/helpers/extends.js"));var _defineProperty2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/defineProperty */ "./node_modules/@babel/runtime/helpers/defineProperty.js"));var _classCallCheck2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ "./node_modules/@babel/runtime/helpers/classCallCheck.js"));var _createClass2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/createClass */ "./node_modules/@babel/runtime/helpers/createClass.js"));var _assertThisInitialized2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/assertThisInitialized */ "./node_modules/@babel/runtime/helpers/assertThisInitialized.js"));var _inherits2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/inherits */ "./node_modules/@babel/runtime/helpers/inherits.js"));var _possibleConstructorReturn2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/possibleConstructorReturn */ "./node_modules/@babel/runtime/helpers/possibleConstructorReturn.js"));var _getPrototypeOf2 = _interopRequireDefault(__webpack_require__(/*! @babel/runtime/helpers/getPrototypeOf */ "./node_modules/@babel/runtime/helpers/getPrototypeOf.js"));




var _react = _interopRequireDefault(__webpack_require__(/*! react */ "react"));
var _underscore = _interopRequireDefault(__webpack_require__(/*! underscore */ "underscore"));
var _propTypes = _interopRequireDefault(__webpack_require__(/*! prop-types */ "./node_modules/prop-types/index.js"));
var _str = _interopRequireDefault(__webpack_require__(/*! expensify-common/lib/str */ "expensify-common/lib/str"));
var _Onyx = _interopRequireDefault(__webpack_require__(/*! ./Onyx */ "./lib/Onyx.js"));var _jsxFileName = "/Users/carlosmartins/Expensidev/react-native-onyx/lib/withOnyx.js";function _createSuper(Derived) {var hasNativeReflectConstruct = _isNativeReflectConstruct();return function _createSuperInternal() {var Super = (0, _getPrototypeOf2.default)(Derived),result;if (hasNativeReflectConstruct) {var NewTarget = (0, _getPrototypeOf2.default)(this).constructor;result = Reflect.construct(Super, arguments, NewTarget);} else {result = Super.apply(this, arguments);}return (0, _possibleConstructorReturn2.default)(this, result);};}function _isNativeReflectConstruct() {if (typeof Reflect === "undefined" || !Reflect.construct) return false;if (Reflect.construct.sham) return false;if (typeof Proxy === "function") return true;try {Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));return true;} catch (e) {return false;}}

/**
 * Returns the display name of a component
 *
 * @param {object} component
 * @returns {string}
 */
function getDisplayName(component) {
  return component.displayName || component.name || 'Component';
}

function _default(mapOnyxToState) {var _this = this;
  // A list of keys that must be present in tempState before we can render the WrappedComponent
  var requiredKeysForInit = _underscore.default.chain(mapOnyxToState).
  omit(function (config) {return config.initWithStoredValues === false;}).
  keys().
  value();

  return function (WrappedComponent) {var
    withOnyx = /*#__PURE__*/function (_React$Component) {(0, _inherits2.default)(withOnyx, _React$Component);var _super = _createSuper(withOnyx);
      function withOnyx(props) {var _this2;(0, _classCallCheck2.default)(this, withOnyx);
        _this2 = _super.call(this, props);

        _this2.setWithOnyxState = _this2.setWithOnyxState.bind((0, _assertThisInitialized2.default)(_this2));

        // This stores all the Onyx connection IDs to be used when the component unmounts so everything can be
        // disconnected. It is a key value store with the format {[mapping.key]: connectionID}.
        _this2.activeConnectionIDs = {};

        // Object holding the temporary initial state for the component while we load the various Onyx keys
        _this2.tempState = {};

        _this2.state = {
          // If there are no required keys for init then we can render the wrapped component immediately
          loading: requiredKeysForInit.length > 0 };return _this2;

      }(0, _createClass2.default)(withOnyx, [{ key: "componentDidMount", value: function componentDidMount()

        {var _this3 = this;
          // Subscribe each of the state properties to the proper Onyx key
          _underscore.default.each(mapOnyxToState, function (mapping, propertyName) {
            _this3.connectMappingToOnyx(mapping, propertyName);
          });
          this.checkEvictableKeys();
        } }, { key: "componentDidUpdate", value: function componentDidUpdate(

        prevProps) {var _this4 = this;
          // If any of the mappings use data from the props, then when the props change, all the
          // connections need to be reconnected with the new props
          _underscore.default.each(mapOnyxToState, function (mapping, propertyName) {
            var previousKey = _str.default.result(mapping.key, prevProps);
            var newKey = _str.default.result(mapping.key, _this4.props);

            if (previousKey !== newKey) {
              _Onyx.default.disconnect(_this4.activeConnectionIDs[previousKey], previousKey);
              delete _this4.activeConnectionIDs[previousKey];
              _this4.connectMappingToOnyx(mapping, propertyName);
            }
          });
          this.checkEvictableKeys();
        } }, { key: "componentWillUnmount", value: function componentWillUnmount()

        {var _this5 = this;
          // Disconnect everything from Onyx
          _underscore.default.each(mapOnyxToState, function (mapping) {
            var key = _str.default.result(mapping.key, _this5.props);
            var connectionID = _this5.activeConnectionIDs[key];
            _Onyx.default.disconnect(connectionID, key);
          });
        }

        /**
         * This method is used externally by sendDataToConnection to prevent unnecessary renders while a component
         * still in a loading state. The temporary initial state is saved to the component instance and setState()
         * only called once all the necessary data has been collected.
         *
         * @param {String} statePropertyName
         * @param {*} val
         */ }, { key: "setWithOnyxState", value: function setWithOnyxState(
        statePropertyName, val) {var _this6 = this;
          if (!this.state.loading) {
            this.setState((0, _defineProperty2.default)({}, statePropertyName, val));
            return;
          }

          this.tempState[statePropertyName] = val;

          // All state keys should exist and at least have a value of null
          if (_underscore.default.some(requiredKeysForInit, function (key) {return _underscore.default.isUndefined(_this6.tempState[key]);})) {
            return;
          }

          this.setState((0, _extends2.default)({}, this.tempState, { loading: false }));
          delete this.tempState;
        }

        /**
         * Makes sure each Onyx key we requested has been set to state with a value of some kind.
         * We are doing this so that the wrapped component will only render when all the data
         * it needs is available to it.
         */ }, { key: "checkEvictableKeys", value: function checkEvictableKeys()
        {var _this7 = this;
          // We will add this key to our list of recently accessed keys
          // if the canEvict function returns true. This is necessary criteria
          // we MUST use to specify if a key can be removed or not.
          _underscore.default.each(mapOnyxToState, function (mapping) {
            if (_underscore.default.isUndefined(mapping.canEvict)) {
              return;
            }

            var canEvict = _str.default.result(mapping.canEvict, _this7.props);
            var key = _str.default.result(mapping.key, _this7.props);

            if (!_Onyx.default.isSafeEvictionKey(key)) {
              // eslint-disable-next-line max-len
              throw new Error("canEvict cannot be used on key '" + key + "'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).");
            }

            if (canEvict) {
              _Onyx.default.removeFromEvictionBlockList(key, mapping.connectionID);
            } else {
              _Onyx.default.addToEvictionBlockList(key, mapping.connectionID);
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
         */ }, { key: "connectMappingToOnyx", value: function connectMappingToOnyx(
        mapping, statePropertyName) {
          var key = _str.default.result(mapping.key, this.props);

          this.activeConnectionIDs[key] = _Onyx.default.connect((0, _extends2.default)({},
          mapping, {
            key: key,
            statePropertyName: statePropertyName,
            withOnyxInstance: this }));

        } }, { key: "render", value: function render()

        {
          if (this.state.loading) {
            return null;
          }

          // Remove any internal state properties used by withOnyx
          // that should not be passed to a wrapped component
          var stateToPass = _underscore.default.omit(this.state, 'loading');
          stateToPass = _underscore.default.omit(stateToPass, function (value) {return _underscore.default.isNull(value);});

          // Remove any null values so that React replaces them with default props
          var propsToPass = _underscore.default.omit(this.props, function (value) {return _underscore.default.isNull(value);});

          // Spreading props and state is necessary in an HOC where the data cannot be predicted
          return /*#__PURE__*/(
            _react.default.createElement(WrappedComponent
            // eslint-disable-next-line react/jsx-props-no-spreading
            , (0, _extends2.default)({}, propsToPass,

            stateToPass, {
              ref: this.props.forwardedRef, __self: this, __source: { fileName: _jsxFileName, lineNumber: 173, columnNumber: 21 } })));


        } }]);return withOnyx;}(_react.default.Component);


    withOnyx.propTypes = {
      forwardedRef: _propTypes.default.oneOfType([
      _propTypes.default.func,
      _propTypes.default.shape({ current: _propTypes.default.instanceOf(_react.default.Component) })]) };


    withOnyx.defaultProps = {
      forwardedRef: undefined };

    withOnyx.displayName = "withOnyx(" + getDisplayName(WrappedComponent) + ")";
    return _react.default.forwardRef(function (props, ref) {
      var Component = withOnyx;
      // eslint-disable-next-line react/jsx-props-no-spreading
      return /*#__PURE__*/_react.default.createElement(Component, (0, _extends2.default)({}, props, { forwardedRef: ref, __self: _this, __source: { fileName: _jsxFileName, lineNumber: 197, columnNumber: 20 } }));
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

/***/ "expensify-common/lib/str":
/*!*******************************************!*\
  !*** external "expensify-common/lib/str" ***!
  \*******************************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_expensify_common_lib_str__;

/***/ }),

/***/ "localforage":
/*!******************************!*\
  !*** external "localforage" ***!
  \******************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_localforage__;

/***/ }),

/***/ "lodash/merge":
/*!*******************************!*\
  !*** external "lodash/merge" ***!
  \*******************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_lodash_merge__;

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

"use strict";
module.exports = __WEBPACK_EXTERNAL_MODULE_react__;

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
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
var _interopRequireDefault = __webpack_require__(/*! @babel/runtime/helpers/interopRequireDefault */ "./node_modules/@babel/runtime/helpers/interopRequireDefault.js");Object.defineProperty(exports, "__esModule", ({ value: true }));Object.defineProperty(exports, "withOnyx", ({ enumerable: true, get: function get() {return _withOnyx.default;} }));exports["default"] = void 0;var _Onyx = _interopRequireDefault(__webpack_require__(/*! ./Onyx */ "./lib/Onyx.js"));
var _withOnyx = _interopRequireDefault(__webpack_require__(/*! ./withOnyx */ "./lib/withOnyx.js"));var _default =

_Onyx.default;exports["default"] = _default;
})();

/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=web.development.js.map