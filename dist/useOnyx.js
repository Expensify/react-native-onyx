"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fast_equals_1 = require("fast-equals");
const react_1 = require("react");
const Onyx_1 = __importDefault(require("./Onyx"));
const OnyxCache_1 = __importDefault(require("./OnyxCache"));
const OnyxUtils_1 = __importDefault(require("./OnyxUtils"));
const useLiveRef_1 = __importDefault(require("./useLiveRef"));
const usePrevious_1 = __importDefault(require("./usePrevious"));
function getCachedValue(key, selector) {
    var _a;
    return ((_a = OnyxUtils_1.default.tryGetCachedValue(key, { selector })) !== null && _a !== void 0 ? _a : undefined);
}
function useOnyx(key, options) {
    const connectionIDRef = (0, react_1.useRef)(null);
    const previousKey = (0, usePrevious_1.default)(key);
    // Used to stabilize the selector reference and avoid unnecessary calls to `getSnapshot()`.
    const selectorRef = (0, useLiveRef_1.default)(options === null || options === void 0 ? void 0 : options.selector);
    // Stores the previous cached value as it's necessary to compare with the new value in `getSnapshot()`.
    // We initialize it to `null` to simulate that we don't have any value from cache yet.
    const previousValueRef = (0, react_1.useRef)(null);
    // Stores the newest cached value in order to compare with the previous one and optimize `getSnapshot()` execution.
    const newValueRef = (0, react_1.useRef)(null);
    // Stores the previously result returned by the hook, containing the data from cache and the fetch status.
    // We initialize it to `undefined` and `loading` fetch status to simulate the initial result when the hook is loading from the cache.
    // However, if `initWithStoredValues` is `true` we set the fetch status to `loaded` since we want to signal that data is ready.
    const resultRef = (0, react_1.useRef)([
        undefined,
        {
            status: (options === null || options === void 0 ? void 0 : options.initWithStoredValues) === false ? 'loaded' : 'loading',
        },
    ]);
    // Indicates if it's the first Onyx connection of this hook or not, as we don't want certain use cases
    // in `getSnapshot()` to be satisfied several times.
    const isFirstConnectionRef = (0, react_1.useRef)(true);
    // Indicates if we should get the newest cached value from Onyx during `getSnapshot()` execution.
    const shouldGetCachedValueRef = (0, react_1.useRef)(true);
    (0, react_1.useEffect)(() => {
        // These conditions will ensure we can only handle dynamic collection member keys from the same collection.
        if (previousKey === key) {
            return;
        }
        try {
            const previousCollectionKey = OnyxUtils_1.default.splitCollectionMemberKey(previousKey)[0];
            const collectionKey = OnyxUtils_1.default.splitCollectionMemberKey(key)[0];
            if (OnyxUtils_1.default.isCollectionMemberKey(previousCollectionKey, previousKey) && OnyxUtils_1.default.isCollectionMemberKey(collectionKey, key) && previousCollectionKey === collectionKey) {
                return;
            }
        }
        catch (e) {
            throw new Error(`'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`);
        }
        throw new Error(`'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`);
    }, [previousKey, key]);
    const getSnapshot = (0, react_1.useCallback)(() => {
        var _a, _b, _c;
        // We get the value from cache while the first connection to Onyx is being made,
        // so we can return any cached value right away. After the connection is made, we only
        // update `newValueRef` when `Onyx.connect()` callback is fired.
        if (isFirstConnectionRef.current || shouldGetCachedValueRef.current) {
            // If `newValueRef.current` is `undefined` it means that the cache doesn't have a value for that key yet.
            // If `newValueRef.current` is `null` or any other value it means that the cache does have a value for that key.
            // This difference between `undefined` and other values is crucial and it's used to address the following
            // conditions and use cases.
            newValueRef.current = getCachedValue(key, selectorRef.current);
            // We set this flag to `false` again since we don't want to get the newest cached value every time `getSnapshot()` is executed,
            // and only when `Onyx.connect()` callback is fired.
            shouldGetCachedValueRef.current = false;
        }
        const hasCacheForKey = OnyxCache_1.default.hasCacheForKey(key);
        // Since the fetch status can be different given the use cases below, we define the variable right away.
        let newFetchStatus;
        // If we have pending merge operations for the key during the first connection, we set the new value to `undefined`
        // and fetch status to `loading` to simulate that it is still being loaded until we have the most updated data.
        // If `allowStaleData` is `true` this logic will be ignored and cached value will be used, even if it's stale data.
        if (isFirstConnectionRef.current && OnyxUtils_1.default.hasPendingMergeForKey(key) && !(options === null || options === void 0 ? void 0 : options.allowStaleData)) {
            newValueRef.current = undefined;
            newFetchStatus = 'loading';
        }
        // If data is not present in cache and `initialValue` is set during the first connection,
        // we set the new value to `initialValue` and fetch status to `loaded` since we already have some data to return to the consumer.
        if (isFirstConnectionRef.current && !hasCacheForKey && (options === null || options === void 0 ? void 0 : options.initialValue) !== undefined) {
            newValueRef.current = ((_a = options === null || options === void 0 ? void 0 : options.initialValue) !== null && _a !== void 0 ? _a : undefined);
            newFetchStatus = 'loaded';
        }
        // We do a deep equality check if we are subscribed to a collection key and `selector` is defined,
        // since each `OnyxUtils.tryGetCachedValue()` call will generate a plain new collection object with new records as well,
        // all of them created using the `selector` function.
        // For the other cases we will only deal with object reference checks, so just a shallow equality check is enough.
        let areValuesEqual;
        if (OnyxUtils_1.default.isCollectionKey(key) && selectorRef.current) {
            areValuesEqual = (0, fast_equals_1.deepEqual)((_b = previousValueRef.current) !== null && _b !== void 0 ? _b : undefined, newValueRef.current);
        }
        else {
            areValuesEqual = (0, fast_equals_1.shallowEqual)((_c = previousValueRef.current) !== null && _c !== void 0 ? _c : undefined, newValueRef.current);
        }
        // If the previously cached value is different from the new value, we update both cached value
        // and the result to be returned by the hook.
        // If the cache was set for the first time, we also update the cached value and the result.
        const isCacheSetFirstTime = previousValueRef.current === null && hasCacheForKey;
        if (isCacheSetFirstTime || !areValuesEqual) {
            previousValueRef.current = newValueRef.current;
            // If the new value is `null` we default it to `undefined` to ensure the consumer gets a consistent result from the hook.
            resultRef.current = [previousValueRef.current, { status: newFetchStatus !== null && newFetchStatus !== void 0 ? newFetchStatus : 'loaded' }];
        }
        return resultRef.current;
    }, [key, selectorRef, options === null || options === void 0 ? void 0 : options.allowStaleData, options === null || options === void 0 ? void 0 : options.initialValue]);
    const subscribe = (0, react_1.useCallback)((onStoreChange) => {
        connectionIDRef.current = Onyx_1.default.connect({
            key,
            callback: () => {
                // Signals that the first connection was made, so some logics in `getSnapshot()`
                // won't be executed anymore.
                isFirstConnectionRef.current = false;
                // Signals that we want to get the newest cached value again in `getSnapshot()`.
                shouldGetCachedValueRef.current = true;
                // Finally, we signal that the store changed, making `getSnapshot()` be called again.
                onStoreChange();
            },
            initWithStoredValues: options === null || options === void 0 ? void 0 : options.initWithStoredValues,
            waitForCollectionCallback: OnyxUtils_1.default.isCollectionKey(key),
        });
        return () => {
            if (!connectionIDRef.current) {
                return;
            }
            Onyx_1.default.disconnect(connectionIDRef.current);
            isFirstConnectionRef.current = false;
        };
    }, [key, options === null || options === void 0 ? void 0 : options.initWithStoredValues]);
    // Mimics withOnyx's checkEvictableKeys() behavior.
    (0, react_1.useEffect)(() => {
        if ((options === null || options === void 0 ? void 0 : options.canEvict) === undefined || !connectionIDRef.current) {
            return;
        }
        if (!OnyxUtils_1.default.isSafeEvictionKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
        }
        if (options.canEvict) {
            OnyxUtils_1.default.removeFromEvictionBlockList(key, connectionIDRef.current);
        }
        else {
            OnyxUtils_1.default.addToEvictionBlockList(key, connectionIDRef.current);
        }
    }, [key, options === null || options === void 0 ? void 0 : options.canEvict]);
    const result = (0, react_1.useSyncExternalStore)(subscribe, getSnapshot);
    return result;
}
exports.default = useOnyx;
